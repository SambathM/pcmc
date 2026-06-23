
using Library.Models;
using Localize.Helper.Extensions;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
using TelegramEngine.Data;

namespace TelegramRoom.Services;

public interface IUtilityService
{
    bool RequiredOTP { get; }

    /// <summary>
    /// Get authorization config for every user, this method will never return null
    /// </summary>
    /// <returns></returns>
    Task<AuthConfigPair> GetAuthConfigAsync();
}

public class UtilityService(TelegramContext dbContext) : IUtilityService
{
    private bool? _isRequireOTP;
    public bool RequiredOTP => _isRequireOTP ??= IsRequireOTP();
    private bool IsRequireOTP()
    {
        var utility = dbContext.IdentityUtilities.AsNoTracking().FirstOrDefault(x => x.Name.ToLower().Equals("user_otp"));
        if (utility != null)
        {
            JObject jObject = JObject.Parse(utility.Value);
            return jObject["enabled"]!.Value<bool>();
        }
        return false;
    }

    public async Task<AuthConfigPair> GetAuthConfigAsync()
    {
        var utility = await dbContext.IdentityUtilities
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Name.ToLower().Equals("user_token"));

        var config = utility?.Value.FromJson<AuthConfig[]>();
        if (config != null)
        {
            return new()
            {
                AccessTokenConfig = config.GetConfig(ETokenType.Access)!,
                RefreshTokenConfig = config.GetConfig(ETokenType.Refresh)!,
            };
        }
        return new();
    }

}

public class AuthConfigPair
{
    public AuthConfig AccessTokenConfig { get; set; } = new() { Type = ETokenType.Access, LifeType = EExpiryType.Minutes, Lifetime = 30 };
    public AuthConfig RefreshTokenConfig { get; set; } = new() { Type = ETokenType.Refresh, LifeType = EExpiryType.Days, Lifetime = 1 };
}
