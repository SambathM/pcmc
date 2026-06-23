using IdentityModel;
using Library.Extensions;
using Library.Jwt;
using Library.Models;
using Library.Services;
using Localize.Helper.Extensions.Helpers;
using Localize.Logger;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TelegramEngine.Data;

namespace TelegramRoom.Services
{
    public interface IUserSessionService
    {
        IEnumerable<Claim>? RefreshToken { get; }

        Task<UserSession> AddNewAsync(long userId, ESessionType type, bool terminateAll = false);
        Task<int> PurgeStaleAsync(long? userId = null, ESessionType? type = null);
        Task<UserSessionTenant> AddOrGetTenantAsync(Guid sessionId, long businessId);
        Task<UserSession?> GetAsync();
        Task<bool> IsValidRefreshTokenAsync();
        Task<UserSession?> OnRenewAsync(long? userId = null, string? refreshToken = null);
        Task<UserSession?> TerminateAsync();
        Task<UserSession?> TryGetUserSessionAsync(string username, ESessionType sessionType, long? businessId = null);
        Task<UserSession?> TryGetUserSessionAsync(long userId, ESessionType sessionType, long? businessId = null);
    }

    public class UserSessionService(
        TelegramContext dbContext,
        ILocalizeLogger<UserSessionService> logger,
        IHttpContextAccessor accessor,
        IWebService webService) : IUserSessionService
    {
        private IEnumerable<Claim>? _refreshToken;
        public IEnumerable<Claim>? RefreshToken => _refreshToken ??= GetRefreshToken();
        private IEnumerable<Claim>? GetRefreshToken()
        {
            var token = webService.GetRefreshToken();
            return DefaultAuthentication.ValidateJwtToken(token)?.Claims;
        }

        private string? _refreshTokenId;
        public string? RefreshTokenId => _refreshTokenId ??= RefreshToken?.FirstOrDefault(x => x.Type == JwtClaimTypes.SessionId)?.Value;

        private long ResolveUserId()
        {
            if (webService.CurrentUserId != 0)
                return webService.CurrentUserId;

            var userIdStr = RefreshToken?.FirstOrDefault(x => x.Type == ClaimTypes.Name)?.Value.Decrypt();
            return long.TryParse(userIdStr, out var parsedId) ? parsedId : 0;
        }


        public async Task<UserSession?> TerminateAsync()
        {
            var userId = webService.CurrentUserId;
            if (userId == 0)
                return null;

            // Identify the current session by its refresh token (cookie/header) when
            // present; otherwise fall back to the access token's session id from the
            // bearer — clients that don't send the refresh cookie still send the
            // access token, so logout can always find the right session to delete.
            UserSession? session = null;

            if (Guid.TryParse(RefreshTokenId, out var refreshGuid))
            {
                session = await dbContext.UserSessions.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.UserId == userId
                        && x.Tokens.Any(tx => tx.TokenType == ETokenType.Refresh && tx.Id == refreshGuid));
            }

            if (session == null)
            {
                var principal = DefaultAuthentication.ValidateJwtToken(validateLifetime: false);
                var accessId = principal?.Claims.FirstOrDefault(x => x.Type == JwtClaimTypes.SessionId)?.Value;
                if (Guid.TryParse(accessId, out var accessGuid))
                {
                    session = await dbContext.UserSessions.AsNoTracking()
                        .FirstOrDefaultAsync(x => x.UserId == userId
                            && x.Tokens.Any(tx => tx.TokenType == ETokenType.Access && tx.Id == accessGuid));
                }
            }

            if (session == null)
                return null;

            // Delete the session; its tokens/tenants cascade via the FK.
            await dbContext.UserSessions.Where(x => x.Id == session.Id).ExecuteDeleteAsync();
            return session;
        }

        private bool TryResolveRefreshToken(string? refreshToken, out Guid refreshTokenGuid)
        {
            static bool TryParse(string token, out Guid guid)
            {
                guid = Guid.Empty;
                if (string.IsNullOrWhiteSpace(token))
                    return false;
                return Guid.TryParse(token, out guid);
            }

            if (!TryParse(RefreshTokenId ?? string.Empty, out refreshTokenGuid))
            {
                if (string.IsNullOrWhiteSpace(refreshToken))
                    return false;

                var claims = DefaultAuthentication.ValidateJwtToken(refreshToken)?.Claims;
                if (claims == null)
                    return false;

                var sessionId = claims?.FirstOrDefault(x => x.Type == JwtClaimTypes.SessionId)?.Value;
                if (!TryParse(sessionId ?? string.Empty, out refreshTokenGuid))
                    return false;
            }

            return true;
        }

        public async Task<UserSession?> OnRenewAsync(long? userId = null, string? refreshToken = null)
        {
            if (!TryResolveRefreshToken(refreshToken, out var refreshTokenGuid))
                return null;

            userId ??= ResolveUserId();
            if (userId == 0) return null;

            var session = await dbContext.UserSessions
                .Include(x => x.Tokens)
                .FirstOrDefaultAsync(x => x.Tokens.Any(tx => tx.Id == refreshTokenGuid) && x.UserId == userId);

            if (session == null) return null;

            var accessToken = session.GetToken(ETokenType.Access);
            if (accessToken == null)
                return session;

            // Set last modified date
            accessToken.LastModified = DateTime.UtcNow;
            session.RevokeCount++;

            await dbContext.SaveChangesAsync();
            return session;
        }

        public async Task<UserSession> AddNewAsync(long userId,
            ESessionType type,
            bool terminateAll = false)
        {
            try
            {
                var userSession = new UserSession
                {
                    UserId = userId,
                    UserAgent = accessor.HttpContext!.Request.Headers.UserAgent,
                    IpAddress = accessor.HttpContext!.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
                    DeviceId = accessor.HttpContext!.Request.Headers["DeviceId"].ToString(),
                    DeviceType = accessor.HttpContext!.Request.Headers["DeviceType"].ToString(),
                    DeviceName = accessor.HttpContext!.Request.Headers["DeviceName"].ToString(),
                    SessionType = type,
                    Tokens = [
                        new()
                        {
                            TokenType = ETokenType.Access,
                            ExpiredAt = DateTime.UtcNow.AddMinutes(30)
                        },
                        new()
                        {
                            TokenType = ETokenType.Refresh,
                            ExpiredAt = DateTime.UtcNow.AddMinutes(60 * 24)
                        }
                    ]
                };

                await dbContext.UserSessions.AddAsync(userSession);
                await dbContext.SaveChangesAsync();

                if (terminateAll)
                {
                    await dbContext.UserSessions.Where(x => x.Id != userSession.Id
                        && x.UserId == userId
                        && x.SessionType == type)
                    .ExecuteDeleteAsync();
                }
                else
                {
                    // Reap this user's dead sessions so the table doesn't accumulate
                    // stale rows on every login. The freshly-created session is safe
                    // (its refresh token is still valid).
                    await PurgeStaleAsync(userId, type);
                }

                return userSession;
            }
            catch (Exception ex)
            {
                logger.Error(ex.ToString());
                throw;
            }
        }

        /// <summary>
        /// Deletes "dead" sessions — those whose refresh token (the longest-lived
        /// token) has expired, so the session can never be renewed again. Tokens and
        /// tenants are removed via the ON DELETE CASCADE FK. Scope to a single user /
        /// session type when provided; otherwise sweeps every user.
        /// </summary>
        public async Task<int> PurgeStaleAsync(long? userId = null, ESessionType? type = null)
        {
            var now = DateTime.UtcNow;

            var query = dbContext.UserSessions.AsQueryable();
            if (userId is long uid)
                query = query.Where(x => x.UserId == uid);
            if (type is ESessionType t)
                query = query.Where(x => x.SessionType == t);

            // A session is dead when it has no still-valid refresh token.
            query = query.Where(x =>
                !x.Tokens.Any(tx => tx.TokenType == ETokenType.Refresh && tx.ExpiredAt > now));

            return await query.ExecuteDeleteAsync();
        }

        public async Task<UserSession?> GetAsync()
        {
            try
            {
                var principal = DefaultAuthentication.ValidateJwtToken(validateLifetime: false);
                var sessionId = principal?.Claims.FirstOrDefault(x => x.Type == JwtClaimTypes.SessionId)?.Value;
                var session = await dbContext.UserSessions.FirstOrDefaultAsync(x => x.UserId == webService.CurrentUserId
                    && x.Tokens.Any(tx => tx.Id.ToString() == sessionId && tx.TokenType == ETokenType.Access));
                return session;
            }
            catch (Exception ex)
            {
                logger.Warn(ex.ToString());
                return null;
            }
        }

        public async Task<bool> IsValidRefreshTokenAsync()
        {
            if (string.IsNullOrEmpty(RefreshTokenId) || !Guid.TryParse(RefreshTokenId, out var paredRefreshToken))
                return false;

            return await dbContext.UserSessions.AnyAsync(x =>
                x.Tokens.Any(tx => tx.TokenType == ETokenType.Refresh && tx.Id == paredRefreshToken));
        }

        public async Task<UserSessionTenant> AddOrGetTenantAsync(Guid sessionId, long businessId)
        {
            var existTenant = await dbContext.UserSessionTenants
                .FirstOrDefaultAsync(x => x.TenantId == businessId && x.UserSessionId == sessionId);

            if (existTenant != null)
                return existTenant;

            if (!await dbContext.UserSessions.AnyAsync(x => x.Id == sessionId))
                throw new Exception("User session not found");

            var sessionTenant = new UserSessionTenant
            {
                TenantId = businessId,
                UserSessionId = sessionId
            };

            await dbContext.UserSessionTenants.AddAsync(sessionTenant);
            await dbContext.SaveChangesAsync();
            return sessionTenant;
        }


        public async Task<UserSession?> TryGetUserSessionAsync(string username, ESessionType sessionType, long? businessId = null)
        {
            username = username.LowerNoSpaces() ?? string.Empty;
            return await dbContext.UserSessions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.SessionType == sessionType
                    && x.User.Username.Trim().ToLower() == username
                    && x.IsActive
                    && x.Tenants.Any(tx => tx.TenantId == businessId))
                ?? await dbContext.UserSessions.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.SessionType == sessionType && x.User.Email.Trim().ToLower() == username && x.IsActive);
        }

        public async Task<UserSession?> TryGetUserSessionAsync(long userId, ESessionType sessionType, long? businessId = null)
        {
            return await dbContext.UserSessions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserId == userId
                    && x.SessionType == sessionType
                    && x.IsActive
                    && x.Tenants.Any(tx => tx.TenantId == businessId))
                ?? await dbContext.UserSessions.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.UserId == userId && x.SessionType == sessionType && x.IsActive);
        }

    }
}
