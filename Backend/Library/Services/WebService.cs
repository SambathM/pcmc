using IdentityModel;
using Library.Extensions;
using Library.Jwt;
using Library.Models;
using Localize.Helper.Extensions.Helpers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;

namespace Library.Services
{
    public interface IWebService
    {
        HttpContext? HttpContext { get; }
        long CurrentUserId { get; }
        string? GetBankFeedClientIdFromBearer();
        string? GetClientOrigin();
        string? GetCookie(string key);
        string? GetHost();
        string? GetNameFromJwtCookieToken();
        string? GetRequestHeader(string key);
        string? GetTokenValueFromHeaderByKey(string headerName);
        int? GetUserIdFromCookieToken();
        long GetUserIdFromJwtBearer();
        void SetCookies(List<CustomCookie> cookies);
        void SetCookies(string cookieName, string cookieValue, CookieOptions? options = null);
        void DeleteCookies(params string[] cookieNames);
        bool IsBackendRequest();

        bool VerifyPasswordHash(string password, byte[] passwordHash, byte[] passwordSalt);

        /// <summary>
        /// Creates a password hash and salt asynchronously.
        /// </summary>
        /// <param name="password"></param>
        /// <returns><see cref="Task"/> of Tuple(PasswordHashed, PasswordSalted)</returns>
        (byte[], byte[]) CreatePasswordHash(string password);

        /// <summary>
        /// Creates a password hash and salt asynchronously.
        /// </summary>
        /// <param name="password"></param>
        /// <returns><see cref="Task"/> of Tuple(PasswordHashed, PasswordSalted)</returns>
        Task<(byte[], byte[])> CreatePasswordHashAsync(string password);
        /// <summary>
        /// Gets the tenant token from either the request header or cookie.
        /// </summary>
        /// <returns></returns>
        string? GetTenantToken();
        string? GetBearerToken();
        string? GetRefreshToken();
        string? GetBearerTokenFromHeader();
    }

    public class WebService(
        IHttpContextAccessor httpContextAccessor,
        IWebHostEnvironment env,
        AppSettings appSettings) : IWebService
    {
        public HttpContext? HttpContext => httpContextAccessor.HttpContext;

        public void SetCookies(List<CustomCookie> cookies)
        {
            foreach (var cookie in cookies)
                SetCookies(cookie.CookieName, cookie.CookieValue, cookie.Options);
        }

        public void SetCookies(string cookieName, string cookieValue, CookieOptions? options = null)
        {
            options ??= new CustomCookie().Options;
            if (env.IsDevelopment())
                options.HttpOnly = false;

            options.Domain = appSettings.MainDomain;

            if (HttpContext?.Response?.HasStarted == true)
                throw new InvalidOperationException("Cannot set cookies, the response has already started.");

            HttpContext?.Response.Cookies.Delete(cookieName);
            HttpContext?.Response.Cookies.Append(cookieName, cookieValue, options);
        }


        public void DeleteCookies(params string[] cookieNames)
        {
            if (HttpContext?.Response?.HasStarted == true)
                return;

            // Delete options must match the Domain the cookies were written with,
            // otherwise the browser keeps them.
            var options = new CookieOptions { Domain = appSettings.MainDomain, Path = "/" };
            foreach (var name in cookieNames)
                HttpContext?.Response.Cookies.Delete(name, options);
        }

        public string? GetCookie(string key)
            => HttpContext?.Request?.Cookies?[key];

        public string? GetTenantToken()
        {
            var fromHeader = GetRequestHeader(appSettings.Configs.Headers.XTenant);
            if (!string.IsNullOrWhiteSpace(fromHeader))
                return fromHeader;

            return GetCookie(appSettings.Configs.Keys.TenantNameToken);
        }

        public string? GetBearerToken()
        {
            var authHeader = GetRequestHeader("Authorization");
            if (!string.IsNullOrWhiteSpace(authHeader) && authHeader.StartsWith("Bearer "))
                return authHeader.Trim();

            return GetCookie(appSettings.Configs.Keys.ApiToken);
        }

        public string? GetRefreshToken()
        {
            var refreshToken = GetCookie(appSettings.Configs.Keys.RefreshToken);
            if (!string.IsNullOrWhiteSpace(refreshToken))
                return refreshToken;

            return GetRequestHeader(appSettings.Configs.Headers.XRefreshToken);
        }

        public string? GetHost()
            => HttpContext?.Request?.Host.Value;

        public string? GetClientOrigin()
            => GetRequestHeader("Origin");

        public string? GetNameFromJwtCookieToken()
        {
            var token = GetCookie(appSettings.Configs.Keys.RefreshToken);
            return string.IsNullOrWhiteSpace(token) ? null : DefaultAuthentication.ReadJwtToken(token)?.GetUserId().ToString();
        }

        public string? GetNameFromJwtBearer()
            => ExtractClaimValue(ClaimTypes.Name)?.Decrypt();

        private long? _currentUserId;
        public long CurrentUserId
        {
            get
            {
                if (_currentUserId.HasValue && _currentUserId != 0) return _currentUserId.Value;
                _currentUserId = GetUserIdFromCookieToken() ?? GetUserIdFromJwtBearer();
                return _currentUserId ?? 0;
            }
        }

        public long GetUserIdFromJwtBearer()
            => GetNameFromJwtBearer().ToLongOrDefault();

        public int? GetUserIdFromCookieToken()
            => GetNameFromJwtCookieToken().ToIntNullable();


        public string? GetTokenValueFromHeaderByKey(string headerName)
            => HttpContext?.Request?.Headers.TryGetValue(headerName, out var value) == true ? value.FirstOrDefault()?.Decrypt() : null;

        public string? GetRequestHeader(string key)
            => HttpContext?.Request?.Headers.FirstOrDefault(h => string.Equals(h.Key, key, StringComparison.OrdinalIgnoreCase)).Value;

        public string? GetBankFeedClientIdFromBearer()
            => ExtractClaimValue(JwtClaimTypes.Actor);

        private bool? _isBackendRequest;

        public bool IsBackendRequest()
        {
            return _isBackendRequest ??=
                string.Equals(
                    GetRequestHeader(appSettings.Configs.Headers.XBackend),
                    appSettings.Configs.Secrets.BackendSecret,
                    StringComparison.OrdinalIgnoreCase);
        }


        public async Task<(byte[], byte[])> CreatePasswordHashAsync(string password)
        {
            if (string.IsNullOrWhiteSpace(password))
                throw new ArgumentNullException(nameof(password), "Password cannot be null or empty.");

            using var hMac = new HMACSHA512();
            var passwordBytes = password.ToBytes();
            using var stream = new MemoryStream(passwordBytes);
            var passwordHash = await hMac.ComputeHashAsync(stream);
            return (passwordHash, hMac.Key);
        }

        public (byte[], byte[]) CreatePasswordHash(string password)
        {
            if (string.IsNullOrWhiteSpace(password))
                throw new ArgumentNullException(nameof(password), "Password cannot be null or empty.");
            using var hMac = new HMACSHA512();
            var passwordHash = hMac.ComputeHash(password.ToBytes());

            return (passwordHash, hMac.Key);
        }

        public bool VerifyPasswordHash(string password, byte[] passwordHash, byte[] passwordSalt)
        {
            if (string.IsNullOrWhiteSpace(password) || passwordHash?.Length != 64 || passwordSalt?.Length != 128)
                throw new ArgumentException("Invalid password, hash, or salt.");
            using var hMac = new HMACSHA512(passwordSalt);
            var computedHash = hMac.ComputeHash(password.ToBytes());
            return computedHash.SequenceEqual(passwordHash);
        }

        // --- Private helpers ---

        private string? ExtractClaimValue(params string[] claimTypes)
        {
            var claims = HttpContext?.User?.Claims;
            return claims?.FirstOrDefault(x => claimTypes.Contains(x.Type))?.Value;
        }

        public string? GetBearerTokenFromHeader()
            => HttpContext?.Request.Headers[HeaderNames.Authorization].ToString()
                .Split(" ")
                .LastOrDefault()
            ?? GetCookie(appSettings.Configs.Keys.ApiToken);
    }

    // Extension methods for conversions
    public static class ConversionExtensions
    {
        public static int ToIntOrDefault(this string? value) => int.TryParse(value, out var i) ? i : 0;
        public static long ToLongOrDefault(this string? value) => long.TryParse(value, out var l) ? l : 0;
        public static int? ToIntNullable(this string? value) => int.TryParse(value, out var i) ? i : null;
    }
}
