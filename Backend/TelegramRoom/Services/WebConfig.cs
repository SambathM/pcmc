using IdentityModel;
using Library;
using Library.Extensions;
using Library.Jwt;
using Library.Models;
using Library.Services;
using Localize.Logger;
using System.Security.Claims;

namespace TelegramRoom.Services
{
    public interface IWebConfig
    {
        Task<string?> AccessTokenAsync(
            ESessionType sessionType,
            User user, string sessionId, /*string clientId = null,*/
            TimeSpan? lifetime = null,
            List<Claim>? customClaims = null);

        string? RefreshToken(
            ESessionType sessionType,
            User user,
            string sessionId,
            TimeSpan? lifetime = null,
            List<Claim>? customClaims = null);

        Task<TokenPair> SetApiTokenClaimsAsync(
            ESessionType sessionType,
            User user, TimeSpan?
            lifeTime = null,
            //string clientId = null,
            TimeSpan? refreshTokenTtl = null);
        void SetApiTokenCookie(string token);
        void ClearAuthCookies();
        bool ValidateRefreshTokenAsync(string? token, out ClaimsPrincipal? principal);
    }

    public class WebConfig(IWebService webService,
        ILocalizeLogger<WebConfig> logger,
        IUserSessionService userSessionService,
        AppSettings appSettings,
        IUtilityService utilityService) : IWebConfig
    {
        public async Task<TokenPair> SetApiTokenClaimsAsync(
            ESessionType sessionType,
            User user,
            TimeSpan? lifeTime = null,
            //string clientId = null,
            TimeSpan? refreshTokenTtl = null)
        {
            try
            {
                var session = await userSessionService.AddNewAsync(user.Id, sessionType);
                var accessTokenId = session.GetToken(ETokenType.Access)!.Id.ToString();
                var refreshTokenId = session.GetToken(ETokenType.Refresh)!.Id.ToString();
                var authConfig = await utilityService.GetAuthConfigAsync();

                var accessTokenTtl = await AccessTokenLifetimeInterceptorAsync(lifeTime/*, clientId*/);
                refreshTokenTtl ??= authConfig.RefreshTokenConfig.GetLifetime();

                List<Claim> customClaims = [
                    new(LocalizeClaimTypes.SessionType, $"{(int)sessionType}")
                ];

                //if (!clientId.IsNullOrEmpty())
                //{
                //    customClaims = [
                //        .. customClaims,
                //            new(LocalizeClaimTypes.ClientConnectId, clientId)
                //    ];
                //}

                var accessToken = await AccessTokenAsync(
                    sessionType,
                    user,
                    accessTokenId/*, clientId*/,
                    accessTokenTtl,
                    customClaims);

                var refreshToken =
                    RefreshToken(
                        sessionType,
                        user,
                        refreshTokenId,
                        refreshTokenTtl,
                        customClaims);

                SetAuthTokenCookie(accessToken!);
                SetRefreshTokenCookie(refreshToken!);

                return new TokenPair
                {
                    SessionId = session.Id,
                    AccessToken = accessToken!,
                    RefreshToken = refreshToken!
                };

            }
            catch (Exception ex)
            {
                logger.Error("Error setting api token claims: {0}", ex.ToString());
                throw;
            }
        }

        private async Task<TimeSpan> AccessTokenLifetimeInterceptorAsync(TimeSpan? lifeTime/*, string clientId*/)
        {
            var authConfig = await utilityService.GetAuthConfigAsync();
            var accessTokenTtl = authConfig.AccessTokenConfig.GetLifetime();

            if (lifeTime != null /*&& !clientId.IsNullOrEmpty()*/)
                accessTokenTtl = lifeTime.Value;

            return accessTokenTtl;
        }

        public string? RefreshToken(
            ESessionType sessionType,
            User user,
            string sessionId,
            TimeSpan? lifetime = null,
            List<Claim>? customClaims = null)
        {
            var claims = DefaultTokenClaims(sessionType, user, sessionId, appSettings.Configs.Secrets.RefreshTokenKey);
            if (customClaims != null && customClaims.Count != 0)
                claims = [.. claims, .. customClaims];

            var token = JwtToken.GenerateToken(claims, lifetime);
            return token;
        }

        public async Task<string?> AccessTokenAsync(
            ESessionType sessionType,
            User user,
            string sessionId,
            //string clientId = null,
            TimeSpan? lifetime = null,
            List<Claim>? customClaims = null)
        {
            try
            {
                lifetime ??= TimeSpan.FromDays(1);
                //int? adminRoleId = await dbContext.AdminUser.AsNoTracking()
                //    .Where(x => x.userId == user.id)
                //    .Select(x => x.roleId)
                //    .FirstOrDefaultAsync();

                //var roleId = adminRoleId ?? 0;

                // generate token to cookie
                var claims = DefaultTokenClaims(sessionType, user, sessionId, 0);
                if (customClaims != null && customClaims.Count > 0)
                    claims = [.. claims, .. customClaims];

                //if (!string.IsNullOrWhiteSpace(clientId) && !claims.Any(c => c.Type == LocalizeClaimTypes.ClientConnectId))
                //    claims = [.. claims, new(LocalizeClaimTypes.ClientConnectId, clientId)];

                var token = JwtToken.GenerateToken(claims, lifetime);
                return token;
            }
            catch
            {
                throw;
            }
        }

        private static List<Claim> DefaultTokenClaims(ESessionType sessionType, User user, string sessionId, object roleId)
            => [
                new(JwtClaimTypes.Subject, user.SubJectId.ToString()),
                new(ClaimTypes.Name, $"{user.Id}".Encrypt()),
                new(JwtClaimTypes.SessionId, $"{sessionId}"),
                new(ClaimTypes.Role, $"{roleId}"),
                //new(JwtClaimTypes.Email, user.Email.LowerNoSpaces()),
                new(LocalizeClaimTypes.SessionType, $"{(int)sessionType}")
            ];

        public void ClearAuthCookies()
            => webService.DeleteCookies(
                "auth-token",
                appSettings.Configs.Keys.ApiToken,
                appSettings.Configs.Keys.RefreshToken);

        public void SetApiTokenCookie(string token)
            => SetTokenCookie(appSettings.Configs.Keys.ApiToken, token);

        public void SetRefreshTokenCookie(string token)
            => SetTokenCookie(appSettings.Configs.Keys.RefreshToken, token);

        public void SetAuthTokenCookie(string accessToken)
        {
            SetTokenCookie("auth-token", accessToken);
        }

        private void SetTokenCookie(string key, string token)
            => webService.SetCookies(key, token, new CookieOptions
            {
                Expires = DateTime.UtcNow.AddYears(1),
                Secure = true,
                HttpOnly = false
            });

        public bool ValidateRefreshTokenAsync(string? token, out ClaimsPrincipal? principal)
        {
            token ??= webService.GetRefreshToken();
            principal = DefaultAuthentication.ValidateJwtToken(token);
            return principal != null;
        }
    }

    public record RecUserClaims(long Id, string SubjId, string Email);

    public class TokenPair
    {
        public Guid? SessionId { get; set; } = null;
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
    }

    public class AuthConfig
    {
        public ETokenType Type { get; set; }
        public EExpiryType LifeType { get; set; } = EExpiryType.Days;
        public int Lifetime { get; set; } = 1;
        public TimeSpan GetLifetime()
        {
            return LifeType switch
            {
                EExpiryType.Seconds => TimeSpan.FromSeconds(Lifetime),
                EExpiryType.Minutes => TimeSpan.FromMinutes(Lifetime),
                EExpiryType.Hours => TimeSpan.FromHours(Lifetime),
                _ => TimeSpan.FromDays(Lifetime)
            };
        }
    }

    public enum EExpiryType
    {
        Seconds = 1,
        Minutes = 2,
        Hours = 3,
        Days = 4,
    }

    public static class Extension
    {
        public static AuthConfig? GetConfig(this IEnumerable<AuthConfig> configs, ETokenType type)
            => configs?.FirstOrDefault(x => x.Type == type);
    }
}

