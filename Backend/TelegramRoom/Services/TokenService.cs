using IdentityModel;
using Library;
using Library.Models;
using Localize.Logger;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using StackExchange.Redis;
using System.Security.Claims;
using TelegramEngine.Data;
using TelegramRoom.Controllers;

namespace TelegramRoom.Services;

public interface ITokenService
{
    //bool IsVerifiedPhone();
    Task<TokenResponse> RenewTokenAsync(string? refreshToken = null);
    Task<TokenResponse> LogoutAsync();
}

public class TokenService(
    ILocalizeLogger<TokenService> logger,
    IWebConfig webConfig,
    //ITenantUtility tenantUtility,
    //ISessionService sessionService,
    TelegramContext dbContext,
    IUserSessionService userSessionService,
    IUtilityService utilityService,
    //IWebService webService,
    IConnectionMultiplexer mux,
    IMemoryCache cache
    /*IUserService userService*/) : ITokenService
{
    private static readonly Random random = new();
    private static string BuildKey(long userId, ESessionType type)
        => AppSettings.EnvKeyPrefix + $"telegramroom:tokenservice:revoketoken:v3:jwt:{userId}:{type}";

    private readonly IDatabase _redis = mux.GetDatabase();

    public async Task<TokenResponse> RenewTokenAsync(string? refreshToken = null)
    {
        try
        {
            long? userId = null;
            var session = await userSessionService.OnRenewAsync(userId, refreshToken);
            if (session == null)
                return new(false, "Unauthorized");

            var (status, cachedToken) = await TryGetCacheAsync(session.UserId, session.SessionType);
            if (status && cachedToken != null && Library.Jwt.DefaultAuthentication.ValidateJwtToken(cachedToken, true) is ClaimsPrincipal principal)
            {
                var value = principal.Claims.FirstOrDefault(x => x.Type == JwtClaimTypes.SessionId)?.Value;
                if (Guid.TryParse(value, out var sessionId) && session.Id == sessionId)
                {
                    return new(status, cachedToken);
                }
                else
                {
                    await ClearCacheAsync(session.UserId, session.SessionType);
                }
            }

            var sessionToken = session.Tokens.FirstOrDefault(x => x.TokenType == ETokenType.Access)
                ?? await dbContext.UserSessionTokens.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.UserSessionId == session.Id && x.TokenType == ETokenType.Access);

            if (sessionToken == null)
                return new(false, "Unauthorized");

            var authConfig = await utilityService.GetAuthConfigAsync();
            var ttl = authConfig.AccessTokenConfig.GetLifetime();

            userId ??= session.UserId;
            var user = await dbContext.Users.AsNoTracking()
                .Where(x => x.Id == userId)
                .Select(x => new User
                {
                    Id = x.Id,
                    SubJectId = x.SubJectId,
                    Email = x.Email,
                    Username = x.Username,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                })
                .FirstOrDefaultAsync();

            if (user == null)
                return new(false, "Unauthorized");

            var token = await webConfig.AccessTokenAsync(session.SessionType, user, sessionToken.Id.ToString(), ttl);
            if (token == null)
                return new(false, "Unauthorized");

            await TryAcquireAsync(session.UserId, session.SessionType, ttl, token);

            return new(true, token, (int)ttl.TotalSeconds);
        }
        catch (Exception ex)
        {
            logger.Error(ex.ToString());
            return new(false, "Unauthorized");
        }
    }

    /// <summary>
    /// Logs the current session out: deletes it from the DB (tokens/tenants cascade)
    /// and evicts its cached access token. Idempotent — succeeds even if the session
    /// is already gone (so a stale client can always clear itself).
    /// </summary>
    public async Task<TokenResponse> LogoutAsync()
    {
        try
        {
            var session = await userSessionService.TerminateAsync();
            if (session != null)
                await ClearCacheAsync(session.UserId, session.SessionType);

            return new(true, "Logged out");
        }
        catch (Exception ex)
        {
            logger.Error(ex.ToString());
            return new(false, "Logout failed");
        }
    }

    private async Task ClearCacheAsync(long userId, ESessionType type)
    {
        var cacheKey = BuildKey(userId, type);
        cache.Remove(cacheKey);
        await _redis.KeyDeleteAsync(cacheKey);
    }

    private async Task<(bool status, string? token)> TryGetCacheAsync(long userId, ESessionType type)
    {
        var cacheKey = BuildKey(userId, type);
        if (cache.TryGetValue(cacheKey, out string? token))
            return (true, token);

        var redis = await _redis.StringGetAsync(cacheKey);
        return redis.HasValue ? (true, redis.ToString()) : (false, null);
    }

    private async Task<bool> TryAcquireAsync(long userId, ESessionType type, TimeSpan ttl, string token)
    {
        // Subtract buffer time to avoid edge cases where token is expired but still in cache
        ttl -= TimeSpan.FromSeconds(10);
        if (await _redis.StringSetAsync(BuildKey(userId, type), token, ttl, When.NotExists))
        {
            cache.Set(BuildKey(userId, type), token, ttl);
            return true;
        }

        return false;
    }


    //#region Phone Token

    //public bool IsVerifiedPhone()
    //{
    //    return dbContext.VerificationToken
    //        .Any(x => x.UserId == webService.CurrentUserId && x.VerificationType == EVerificationType.Phone && x.IsVerified);
    //}
    //#endregion


}
