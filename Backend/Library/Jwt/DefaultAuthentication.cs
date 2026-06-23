using Library.Jwt.Authenticators;
using Localize.Logger;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Library.Jwt
{
    public sealed class LocalizeJwtOptions
    {
        public JwtBearerEvents? Events { get; set; }
        public bool AcceptClientConnect { get; set; } = false;
        public bool ValidateRoleAddSession { get; set; } = true;
        public CustomJwtBearerEvents? CustomEvents { get; set; }
    }

    public static class DefaultAuthentication
    {
        private readonly static LocalizeLogger _logger = new(typeof(DefaultAuthentication));
        public static IServiceCollection AddDefaultLocalizeJwtAuthentication(this IServiceCollection services,
            IConfiguration configuration,
            Action<LocalizeJwtOptions>? options = null)
        {
            var opts = new LocalizeJwtOptions();
            options?.Invoke(opts);

            // prevent jwt claimType {"sub"} automapping to jwt { "useridentifire" } by aspNetCore
            JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
            JwtSecurityTokenHandler.DefaultOutboundClaimTypeMap.Clear();
            JsonWebTokenHandler.DefaultInboundClaimTypeMap.Clear();

            // Add the authentication services to the service collection
            return new Authenticator(services, configuration, opts).Build();
        }

        public static TokenValidationParameters DefaultParameters(bool validateLifetime)
            => new()
            {
                ValidTypes = ["at+jwt"],
                ValidateAudience = false,
                ValidateIssuer = false,
                ValidateActor = false,
                ValidAudience = "AppApi",
                NameClaimType = ClaimTypes.Name,
                RoleClaimType = ClaimTypes.Role,
                IssuerSigningKey = CertificateHelper.GetIssuerSigningKey,
                ClockSkew = TimeSpan.FromMinutes(2),
                ValidateLifetime = validateLifetime
            };

        public static async Task<(IDictionary<string, object> claims, bool isValid)> ValidateTokenAsync(string token,
            bool validateLifetime = true,
            bool throwOnError = false)
        {
            var (parameters, handler) = BuildParameters(token, validateLifetime);
            var result = await handler.ValidateTokenAsync(token, parameters);

            if (!result.IsValid && throwOnError && result.Exception != null)
                throw result.Exception;

            return (result.Claims, result.IsValid);
        }


        public static ClaimsPrincipal? ValidateJwtToken(string? token = null,
            bool validateLifetime = true,
            bool throwOnError = false)
        {
            try
            {
                var (parameters, handler) = BuildParameters(token, validateLifetime);
                token = NormalizeToken(token);
                return handler.ValidateToken(token, parameters, out SecurityToken validatedToken);
            }
            catch (Exception)
            {
                if (throwOnError)
                    throw;

                return null;
            }
        }

        private static (TokenValidationParameters parameters, JwtSecurityTokenHandler handler)
            BuildParameters(string? token, bool validateLifetime)
        {
            token = NormalizeToken(token)
                ?? throw new ArgumentException("Token cannot be null or empty.", nameof(token));

            var parameters = DefaultParameters(validateLifetime);
            if (validateLifetime)
                parameters.LifetimeValidator = (_, expire, __, ___) => expire.HasValue && expire.Value > DateTime.UtcNow;

            return (parameters, new());
        }

        public static List<Claim>? ReadJwtToken(string? token)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(token))
                    return null;

                token = NormalizeToken(token);

                var handler = new JwtSecurityTokenHandler();
                var securityToken = handler.ReadJwtToken(token);

                return [.. securityToken.Claims];
            }
            catch (Exception ex)
            {
                _logger.Warn(ex.ToString());

                return null;
            }
        }

        public static string? NormalizeToken(string? bearerToken)
        {
            if (string.IsNullOrWhiteSpace(bearerToken)) return null;
            return bearerToken.Trim().Split(' ').Last();
        }

    }

    public class LocalizeClaimTypes
    {
        public static string ClientConnectId => ClaimTypes.UserData;
        public static string SessionType => "session_type";
    }

}
