using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Library.Jwt
{
    public class JwtToken
    {
        // Generates a JWT token with the given claims, lifetime, and scopes
        public static string? GenerateToken(IEnumerable<Claim> claims,
            TimeSpan? lifetime = null,
            IEnumerable<string>? scopes = null)
        {
            try
            {
                lifetime ??= TimeSpan.FromDays(1);
                claims = claims.DistinctBy(x => x.Type);

                // Default scopes if none are provided
                var defaultScopes = new[] {
                    "Sb999TelegramEngine",
                    "OpenId"
                };

                var expire = DateTime.UtcNow.AddSeconds(lifetime.Value.TotalSeconds);
                scopes ??= defaultScopes;

                // Create claims dictionary
                var claimsDictionary = new Dictionary<string, object>
                {
                    { "client_id", "Sb999TelegramEngine" },
                    { "aud", "AppApi" },
                    { "scope", scopes }
                };

                // Add provided claims to the dictionary
                foreach (var claim in claims)
                    claimsDictionary[claim.Type] = claim.Value;

                //using var scope = TelegramInstances.ScopeFactory.CreateScope();
                //var appSettings = scope.ServiceProvider.GetRequiredService<AppSettings>();

                // Create security token descriptor
                var descriptor = new SecurityTokenDescriptor
                {
                    Expires = expire,
                    SigningCredentials = CertificateHelper.GetSigningCredentials,
                    Issuer = "0.0.0.0",
                    Claims = claimsDictionary,
                    TokenType = "at+jwt",
                };

                // Create and write the token
                var hanlder = new JwtSecurityTokenHandler();
                var token = hanlder.CreateToken(descriptor);
                return hanlder.WriteToken(token);
            }
            catch (Exception ex)
            {
                // Log the exception (consider using a logging framework)
                Console.WriteLine($"Token generation error: {ex}");
                return null;
            }
        }

    }
}

