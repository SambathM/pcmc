using IdentityModel;
using Library.Models;
using Library.PgBouncer;
using Library.Services.QueueBackgroundTasks;
using Localize.Logger;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;

namespace Library.Jwt.Authenticators
{
    internal readonly struct Validator
    {
        private readonly IPgBouncerContextHandler<UserSessionDbContext> _handler;
        private readonly IBackgroundTaskQueueService _queue;
        //private readonly ILocalizeConfig _config;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IMemoryCache _memoryCache;
        private readonly TokenValidatedContext _context;
        private readonly ValidatedValidators _validatedCtx;
        private readonly LocalizeJwtOptions _options;
        private readonly AppSettings _appSettings;
        private System.Security.Claims.ClaimsPrincipal Principal
            => _context.Principal ?? throw new InvalidOperationException("Validated token has no principal.");

        public Validator(TokenValidatedContext context, LocalizeJwtOptions options)
        {
            _context = context;
            _appSettings = context.HttpContext.RequestServices.GetRequiredService<AppSettings>();
            _handler = context.GetService<IPgBouncerContextHandler<UserSessionDbContext>>();
            _queue = context.GetService<IBackgroundTaskQueueService>();
            //_config = context.GetService<ILocalizeConfig>();
            _scopeFactory = context.GetService<IServiceScopeFactory>();
            _memoryCache = context.GetService<IMemoryCache>();
            _options = options;

            _validatedCtx = new(
                //_context.GetService<ITenantUtility>().Tenant,
                _context.HttpContext.Request.IsBackendRequest()
            );
        }

        //private readonly string EnvPrefix;
        private static string GetThrottleCacheKey(Guid sessionId) => $"{AppSettings.Branch}:identity:session:lastaccess:{sessionId}";
        private static readonly LocalizeLogger<Validator> logger = new();

        public ValidatedValidators Validated => _validatedCtx;

        public async Task ValidateAsync()
        {
            ValidateLifetime();
            ValidateUserRoles();

            await ValidateUserSessionsAsync();
            //await ValidateClientConnectAsync();
        }

        private void ValidateLifetime()
        {
            if (Validated.IsBackendRequest) return;

            var expClaim = Principal.Claims.FirstOrDefault(x => x.Type == JwtClaimTypes.Expiration)?.Value;

            if (!long.TryParse(expClaim, out var expSeconds))
                throw new InvalidOperationException("Token expiration claim is missing or invalid.");

            var expDateTime = DateTimeOffset.FromUnixTimeSeconds(expSeconds).UtcDateTime;
            if (expDateTime < DateTime.UtcNow)
                throw new SecurityTokenExpiredException("Token has expired.");
        }

        private async Task ValidateClientConnectAsync()
        {
            if (Validated.IsBackendRequest || !_options.AcceptClientConnect) return;

            var clientId = ResolveClientId(_context);
            if (string.IsNullOrWhiteSpace(clientId)) return; // Skip if no ClientId provided

            //var client = await _handler.ExecuteWithRetryAsync(db =>
            //     db.ClientConnect.AsNoTracking().FirstOrDefaultAsync(x => x.client_id == clientId))
            //     ?? throw new InvalidOperationException("INVALID_CLIENT");

            //var tenant = _validatedCtx.Tenant;
            //var userId = _validatedCtx.User.User?.Id ?? 0;

            //if (tenant != null)
            //{
            //    var hasAccess = await _handler.ExecuteWithRetryAsync(db =>
            //        db.BusinessMember.AnyAsync(x => x.status_activation_id == EINVITAION_STATUS.accepted
            //            && x.is_active
            //            && x.business_id == tenant.BusinessId
            //            && x.user_id == userId));
            //    if (!hasAccess)
            //    {
            //        logger.Warn("User: {UserId} from origin: {Origin} attempted to access client: {ClientId} without access to tenant: {Business}",
            //            userId, GetUserOrigin(), clientId, tenant.Name);
            //        throw new InvalidOperationException("INVALID_CLIENT");
            //    }
            //}

            //_validatedCtx.ClientConnect = new(true, clientId) { Client = client };
        }

        public void ValidateUserRoles()
        {
            var role = Principal.Claims.GetRole();
            var refreshTokenKey = _appSettings.Configs.Secrets.RefreshTokenKey;

            if ((string.IsNullOrWhiteSpace(role) || role == refreshTokenKey) && !Validated.IsBackendRequest)
                throw new InvalidOperationException("INVALID_USER_ROLE");

            _validatedCtx.Roles = new(true, role);
        }

        private async Task ValidateUserSessionsAsync()
        {
            var (userId, userEmail, sessionId, sessionType) = GetUserSessionInfo();
            _validatedCtx.User = new(null, userId.ToString());
            if (_validatedCtx.IsBackendRequest) return;

            // First, lightweight check for session token existence
            var sessionToken = await _handler.ExecuteWithRetryAsync(db =>
                db.UserSessionToken
                .AsNoTracking()
                .Where(t => t.Id == sessionId
                    && t.TokenType == ETokenType.Access
                    && t.UserSession.UserId == userId
                    && t.UserSession.SessionType == sessionType)
                .Select(t => new
                {
                    t.Id,
                    t.UserSessionId,
                    t.LastAccess
                })
                .FirstOrDefaultAsync())
                    ?? throw new InvalidOperationException($"User: {userEmail}'s session not found from origin: null");

            // Then load full data separately (less lock contention)
            var userSession = await _handler.ExecuteWithRetryAsync(db =>
                db.UserSession
                .Include(us => us.User)
                .Where(us => us.Id == sessionToken.UserSessionId)
                .AsNoTracking()
                .Select(x => new UserSession
                {
                    Id = x.Id,
                    UserId = x.UserId,
                    LastAccessed = x.LastAccessed,
                    IpAddress = x.IpAddress,
                    User = new User
                    {
                        Id = x.User.Id,
                        Email = x.User.Email,
                        Username = x.User.Username
                    }
                })
                .FirstOrDefaultAsync())
                ?? throw new InvalidOperationException($"User: {userEmail}'s session not found from origin: null");

            await PerformLastAccessUpdateAsync(userId, sessionId);

            var user = userSession.User;
            userSession.User = null!;

            _validatedCtx.User.User = user;
            _validatedCtx.User.UserSession = userSession;
        }


        private async Task PerformLastAccessUpdateAsync(
            long userId,
            Guid sessionId)
        {
            var window = TimeSpan.FromSeconds(30);
            var cacheKey = GetThrottleCacheKey(sessionId);
            // In-memory throttle to prevent calling to redis for acquiring
            if (_memoryCache.TryGetValue(cacheKey, out _)) return;

            var factory = _scopeFactory;
            await _queue.EnqueueFunc(async () =>
            {
                try
                {
                    using var scope = factory.CreateScope();
                    var redis = scope.ServiceProvider.GetRequiredService<IConnectionMultiplexer>().GetDatabase();
                    var handler = scope.ServiceProvider.GetRequiredService<IPgBouncerContextHandler<UserSessionDbContext>>();
                    var memCache = scope.ServiceProvider.GetRequiredService<IMemoryCache>();

                    var utcNow = DateTime.UtcNow;
                    var acquired = await redis.StringSetAsync(cacheKey, utcNow.ToString("O"), window, When.NotExists);
                    if (!acquired)
                    {
                        memCache.Set(cacheKey, true, window);
                        return;
                    }

                    await handler.ExecuteWithRetryAsync(db =>
                        db.UserSessionToken
                        .Where(x => x.Id == sessionId
                            && x.TokenType == ETokenType.Access
                            && x.UserSession.UserId == userId)
                        .ExecuteUpdateAsync(x => x.SetProperty(sx => sx.LastAccess, sx => utcNow)));

                    memCache.Set(cacheKey, true, window);
                }
                catch (Exception ex)
                {
                    logger.Error("Error updating last access time for userId: {UserId}, sessionId: {SessionId}. Exception: {Exception}",
                        userId, sessionId, ex);
                }
            });
        }

        private static string ResolveClientId(TokenValidatedContext ctx)
        {
            var clientId = ctx.Principal?.Claims.FirstOrDefault(x => x.Type == LocalizeClaimTypes.ClientConnectId)?.Value;
            if (string.IsNullOrWhiteSpace(clientId))
                clientId = ctx.HttpContext.Request.Headers["X-Client"].ToString();

            return clientId;
        }

        private (long userId, string? userEmail, Guid sessionId, ESessionType? sessionType) GetUserSessionInfo()
        {
            var userEmail = Principal.Claims.GetUserEmail();
            string? userOrigin =/* GetUserOrigin();*/ null;

            if (!ResolveSessionId(out var sessionId) && !Validated.IsBackendRequest)
                throw new InvalidOperationException($"Session ID missing from: {userOrigin}");

            if (!ResolveUserId(out var userId) && !Validated.IsBackendRequest)
                throw new InvalidOperationException($"User ID missing from: {userOrigin}");

            if (!ResolveSessionType(out var sessionType) && !Validated.IsBackendRequest)
                throw new InvalidOperationException($"Session type missing or invalid from: {userOrigin}");

            return (userId, userEmail, sessionId, sessionType);
        }

        private bool ResolveUserId(out long userId)
        {
            userId = Principal.Claims.GetUserId();
            return userId != 0;
        }

        private bool ResolveSessionId(out Guid sessionId)
        {
            sessionId = Guid.Empty;
            var value = Principal.Claims.GetSessionId();
            if (string.IsNullOrWhiteSpace(value) || !Guid.TryParse(value, out sessionId) || sessionId == Guid.Empty)
                return false;
            return true;
        }

        private bool ResolveSessionType(out ESessionType? sessionType)
        {
            sessionType = null;
            var value = _context.Principal?.Claims?.FirstOrDefault(x => x.Type == LocalizeClaimTypes.SessionType)?.Value;
            if (string.IsNullOrWhiteSpace(value) || !int.TryParse(value, out var valueInt) || valueInt == 0)
                return false;

            sessionType = (ESessionType)valueInt;
            return true;
        }

        //private string GetUserOrigin() => $"{_context.HttpContext.GetOrigin()}, IP: {_context.HttpContext.GetUserIp()}.";

    }

    public class ValidatedBase(bool? validated = null, string? id = null)
    {
        public bool? Validated { get; internal set; } = validated;
        public string? Id { get; internal set; } = id;
        public bool ToValidate => Validated != null;
        public bool IsValidated => Validated == true;
    }

    public sealed class ValidatedUser(bool? validated = null, string? id = null) : ValidatedBase(validated, id)
    {
        public User? User { get; internal set; }
        public UserSession? UserSession { get; internal set; }
    }

    //public sealed class ValidatedClientConnect(bool? validated = null, string id = null) : ValidatedBase(validated, id)
    //{
    //    public ClientConnect Client { get; internal set; }
    //}

    public sealed class ValidatedValidators(/*TenantObject tenant, */bool isBackendRequest)
    {
        //public ValidatedClientConnect ClientConnect { get; internal set; } = new();
        public ValidatedBase Roles { get; internal set; } = new();
        public ValidatedUser User { get; internal set; } = new();
        //public TenantObject Tenant { get; internal set; } = tenant;
        public bool IsBackendRequest { get; internal set; } = isBackendRequest;
    }

    internal static class InternalExtensions
    {
        internal static TService GetService<TService>(this TokenValidatedContext ctx) where TService : class
            => ctx.HttpContext.RequestServices.GetRequiredService<TService>();
    }
}
