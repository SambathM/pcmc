using IdentityModel;
using Library.Extensions;
using Localize.Helper.Extensions;
using Localize.Helper.Extensions.Helpers;
using Localize.Logger;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;

namespace Library.Jwt;

public static class JwtTokenExtensions
{
    private static readonly LocalizeLogger logger = new(typeof(JwtTokenExtensions));
    public const string AccessTokenObjectKey = "AccessTokenObject";
    public static void OnResponseStatedAsync(this HttpResponse response, int statusCode, string message)
    {
        response.StatusCode = statusCode;
        response.OnStarting(async () =>
        {
            try
            {
                if (response.HasStarted)
                {
                    logger.Info("Response has already started, the response will not be modified.");
                    return;
                }

                var jsonMessage = (new { StatusCode = statusCode, Message = message }).ToJson();
                await response.Body.FlushAsync();
                response.ContentType = "application/json; charset=UTF-8";
                response.ContentLength = jsonMessage?.ToBytes().Length ?? 0;
                await response.WriteAsync(jsonMessage ?? "{}");
            }
            catch { }
        });
    }

    public static bool IsBackendRequest(this HttpRequest request)
    {
        if (request == null)
            return false;

        var appSettings = request.HttpContext.RequestServices.GetRequiredService<AppSettings>();

        var backendHeader = request.Headers[appSettings.Configs.Headers.XBackend].ToString();
        return backendHeader == appSettings.Configs.Secrets.BackendSecret;
    }

    public static string? GetSubjectId(this IEnumerable<Claim> claims)
        => claims.FirstOrDefault(x => x.Type == JwtClaimTypes.Subject)?.Value;

    /// <summary>
    /// Get localize user ID from JWT claim list
    /// </summary>
    /// <param name="claims"></param>
    /// <returns></returns>
    public static long GetUserId(this IEnumerable<Claim> claims)
    {
        var userIdStr = claims.FirstOrDefault(x => x.Type == ClaimTypes.Name)?.Value?.Decrypt();
        if (userIdStr == null) return 0;
        return long.TryParse(userIdStr, out var userId)
            ? userId : 0;
    }

    public static bool TryGetUserId(this IEnumerable<Claim> claims, out long userId)
    {
        userId = 0;
        var userIdStr = claims.FirstOrDefault(x => x.Type == ClaimTypes.Name)?.Value?.Decrypt();
        if (userIdStr == null) return false;
        return long.TryParse(userIdStr, out userId);
    }

    /// <summary>
    /// Get localize user email from JWT claim list
    /// </summary>
    /// <param name="claims"></param>
    /// <returns></returns>
    public static string? GetUserEmail(this IEnumerable<Claim> claims)
        => claims.FirstOrDefault(x => x.Type == ClaimTypes.Email)?.Value;

    public static string? GetSessionId(this IEnumerable<Claim> claims)
        => claims.FirstOrDefault(x => x.Type == JwtClaimTypes.SessionId)?.Value;

    public static string? GetRole(this IEnumerable<Claim> claims)
        => claims.FirstOrDefault(x => x.Type == ClaimTypes.Role)?.Value;

    public static string GetRefreshToken(this HttpRequest request)
    {

        var appSettings = request.HttpContext.RequestServices.GetRequiredService<AppSettings>();

        var rfToken = request.Cookies[appSettings.Configs.Keys.RefreshToken]?.ToString();
        if (!string.IsNullOrWhiteSpace(rfToken))
            return rfToken;

        return request.Headers[appSettings.Configs.Headers.XRefreshToken].ToString();
    }

    public static IEnumerable<Claim>? GetRefreshTokenClaims(this HttpRequest request, bool validateLifetime = true)
    {
        var refreshToken = request.GetRefreshToken();
        if (string.IsNullOrWhiteSpace(refreshToken))
            return null;

        return DefaultAuthentication.ValidateJwtToken(refreshToken, validateLifetime)?.Claims;
    }

    public static string? GetAccessTokenFromCookie(this HttpRequest request)
    {
        try
        {
            if (request.Cookies.Count == 0)
                return null;

            if (!request.Cookies.TryGetValue("auth-token", out var token))
                return null;

            var decodedToken = token.Base64Decode();
            if (string.IsNullOrWhiteSpace(decodedToken))
                return null;

            var tokenObject = decodedToken.ToJObject();
            if (tokenObject is null)
                return null;

            return tokenObject["token"]?.ToString();
        }
        catch
        {
            return null;
        }
    }

}
