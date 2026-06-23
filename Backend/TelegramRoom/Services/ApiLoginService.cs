using Library.Jwt;
using Library.Models;
using Library.Services;
using Localize.Helper.Extensions.Helpers;
using Localize.Logger;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics.CodeAnalysis;
using TelegramEngine.Data;
using TelegramRoom.Controllers;

namespace TelegramRoom.Services
{
    public interface IApiLoginService
    {
        Task<IDILoginResult> LoginAsync(
            LoginRequest model,
            ESessionType sessionType,
            EAuthGrantType grantType);
    }

    public class ApiLoginService(
        TelegramContext dbContext,
        ILocalizeLogger<ApiLoginService> logger,
        IWebService webService,
        IWebConfig webConfig,
        //ITenantUtility tenantUtility,
        //ISessionService sessionService,
        IHttpContextAccessor accessor
    //ILocalizeConfig config
    ) : IApiLoginService
    {

        public async Task<IDILoginResult> LoginAsync(
            LoginRequest model,
            ESessionType sessionType,
            EAuthGrantType grantType)
        {
            try
            {
                var user = await ResolveUserByGrantTypeAsync(grantType, model);
                if (user == null)
                {
                    return grantType == EAuthGrantType.Password
                        ? new(Message: "Invalid Username or Password!")
                        : new(Error: "Unauthorized");
                }

                if (!webService.VerifyPasswordHash(model.Password ?? string.Empty, user.PasswordHash!, user.PasswordSalt!))
                    return new(Message: "Invalid Username or Password!");

                var tokens = await webConfig.SetApiTokenClaimsAsync(sessionType, user);

                await SetUserSessionByTenantAsync(sessionType, user.Email, tokens.AccessToken);

                return new(Status: true, Tokens: tokens);
            }
            catch (Exception e)
            {
                logger.Error("{ex}", e.ToString());
                return new(Message: e.Message, Code: 400);
            }
        }

        private async Task<User?> ResolveUserByGrantTypeAsync(EAuthGrantType grantType, LoginRequest model)
        {
            switch (grantType)
            {
                case EAuthGrantType.Password:
                    {
                        if (string.IsNullOrWhiteSpace(model.Username))
                        {
                            logger.Warn("Username is empty, grantType={grantType}", grantType);
                            return null;
                        }

                        var normUsername = model.Username.LowerNoSpaces();
                        return await dbContext.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Email.Trim().ToLower() == normUsername);
                    }

                case EAuthGrantType.RefreshToken:
                    {
                        var claims = accessor.HttpContext?.Request.GetRefreshTokenClaims(validateLifetime: false);
                        if (claims == null)
                        {
                            logger.Warn("Invalid Refresh Token Claims, grantType={grantType}", grantType);
                            return null;
                        }

                        if (!claims.TryGetUserId(out var userId))
                        {
                            logger.Warn("UserId claim not found in Refresh Token, grantType={grantType}", grantType);
                            return null;
                        }

                        return await dbContext.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId);
                    }
            }

            return null;

        }


        private async Task<bool> SetUserSessionByTenantAsync(ESessionType sessionType, string userEmail, string accessToken)
        {
            //var tenantList = ResolveTenants();
            //foreach (var tenant in tenantList)
            //{
            //    if (tenant.PassThrough == false)
            //    {
            //        var business = await dbContext.Businesses.AsNoTracking().FirstOrDefaultAsync(x => x.id == tenant.BusinessId);
            //        if (business == null)
            //            return false;

            //await sessionService.SetUserSessionAsync(sessionType, /*business,*/ userEmail.LowerNoSpaces(), accessToken);
            //    }
            //}

            return true;
        }

        //private List<TenantObject> ResolveTenants()
        //{
        //    List<TenantObject> tenants = [];
        //    var tenant = tenantUtility?.Tenant;
        //    if (tenant != null)
        //        tenants.Add(tenant);

        //    var tenantKeys = config.GetTenantCookieNames();

        //    foreach (var key in tenantKeys)
        //    {
        //        var tenantToken = accessor.HttpContext.Request.Cookies[key];
        //        if (string.IsNullOrWhiteSpace(tenantToken))
        //            continue;
        //        var tenantObj = tenantToken.Decrypt().FromJson<TenantObject>();
        //        if (tenantObj != null)
        //            tenants.Add(tenantObj);
        //    }
        //    if (tenants.Count > 0)
        //        tenants = [.. tenants.DistinctBy(x => x.Type)];

        //    return tenants;
        //}
    }

    public sealed record IDILoginResult
    (
         bool Status = false,
         int Code = 200,
         string? Message = null,
         string? Error = null,
         TokenPair? Tokens = null
    );

    public class IDILoginModel
    {
        //[LocalizeModelState(6, 50)]
        public string Password { get; set; } = string.Empty;
        [AllowNull]
        public string Username { get; set; } = string.Empty;
    }
}
