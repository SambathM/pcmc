using IdentityModel;
using Library.Http;
using Library.Jwt;
using Library.Models;
using Library.PgBouncer;
using Library.Services;
using Localize.Logger;
using Npgsql;
using System.Security.Claims;

namespace TelegramRoom.Services
{
    public interface ISessionService
    {
        //Task<object> SetUserSessionAsync(
        //    ESessionType sessionType,
        //    //Business business,
        //    string username,
        //    string accessToken = null,
        //    bool passThrough = false,
        //    bool skipAuditLog = false,
        //    bool skipMigration = false,
        //    UserSessionTenant sessionTenant = null);

        //Task SetUserSessionAsync(ESessionType sessionType,
        //    //Business business,
        //    long userId,
        //    Guid? sessionId = null,
        //    bool passThrough = false,
        //    bool skipAuditLog = false);
    }

    public class SessionService(
        //IdentityDbContext identityDbContext,
#pragma warning disable CS9113
        IPgBouncerContextHandler pgBouncer,
        IHttpHelper httpHelper,
        IUserSessionService userSessionService,
        ILocalizeLogger<SessionService> logger,
#pragma warning restore CS9113
        IWebService webService) : ISessionService
    {
        #region Direct call to db for session handling (Deprecated)
        private bool ResolveTokenId(out Guid tokenId)
        {
            tokenId = Guid.Empty;
            var token = webService.GetBearerToken();
            if (string.IsNullOrWhiteSpace(token)) return false;

            if (DefaultAuthentication.ValidateJwtToken(token) is ClaimsPrincipal principal)
            {
                var sessionString = principal.Claims.FirstOrDefault(x => x.Type == JwtClaimTypes.SessionId)?.Value;
                if (sessionString != null && Guid.TryParse(sessionString, out tokenId))
                {
                    // Get session id from given token id
                    //var userSessionId = await identityDbContext.UserSessionToken
                    //    .AsNoTracking()
                    //    .Where(x => x.Id == tokenId)
                    //    .Select(x => x.UserSessionId)
                    //    .FirstOrDefaultAsync();

                    //return userSessionId;
                    return true;
                }
            }

            return false;
        }

        public async Task SetUserSessionAsync(
            ESessionType sessionType,
            //Business business,
            long userId,
            Guid? sessionId = null,
            bool passThrough = false,
            bool skipAuditLog = false)
        {
            //if (passThrough) return;

            //var (factory, connString) = pgBouncer.GetConnectionFactory(business.db_name);
            //using var connection = await factory();

            //var userRoleId = await ValidateUserRoleAsync(connection, userId);

            //await UpdateUserRoleSessionAsync(
            //    userRoleId,
            //    connection,
            //    sessionId,
            //    sessionType,
            //    //business,
            //    userId);

            //if (skipAuditLog || business.app_type != EProductType.ACCOUNTING_SYSTEM) return;

            //await AuditTrailLogAsync(connString, userId, business);
        }

        private static async Task<int> ValidateUserRoleAsync(NpgsqlConnection connection, long userId)
        {
            using var command = connection.CreateCommand();
            command.CommandText = @"
                SELECT ""Id"" AS row FROM public.""UserRole"" 
                WHERE ""UserId"" = @userId AND ""IsActive"";";
            command.Parameters.AddWithValue("@userId", userId);
            using var reader = await command.ExecuteReaderAsync();
            if (!reader.HasRows)
                throw new Exception("User role not found or removed!");
            reader.Read();
            return reader.GetInt32(0);
        }

        //private async Task UpdateUserRoleSessionAsync(
        //    int userRoleId,
        //    NpgsqlConnection connection,
        //    Guid? sessionId,
        //    ESessionType sessionType,
        //    Business business,
        //    long userId)
        //{
        //    if (business.app_type == EProductType.ACCOUNTING_SYSTEM)
        //    {
        //        // Prepare to perform database migration
        //        var baseUrl = RouteHelper.GetBackendTenantBaseUrl(business);
        //        var tenantToken = await ResolveTenantTokenAsync(sessionType, business, username: null, userId);
        //        var response = await httpHelper.BackendRequest(baseUrl, new()
        //        {
        //            Path = "job/migrateDb",
        //            BearerToken = AdminTokenService.AdminToken
        //        });

        //        if (!response.IsSuccessStatusCode)
        //        {
        //            throw new InvalidOperationException(response.ErrorMessage ?? "Unable to perform database migration before update user role");
        //        }

        //        if (!sessionId.HasValue && ResolveTokenId(out var tokenId))
        //        {
        //            sessionId = tokenId;
        //        }
        //        else
        //        {
        //            throw new Exception("Unable to resolve session id from token!");
        //        }

        //        //await pgBouncer.ExecuteWithRetryAsync<TelegramContext>(business.db_name, async ctx =>
        //        //{
        //        //    var roleSession = await ctx.UserRoleSession
        //        //        .FirstOrDefaultAsync(x => x.UserRole.Id == userRoleId && x.SessionType == sessionType);

        //        //    if (roleSession == null)
        //        //    {
        //        //        roleSession = new()
        //        //        {
        //        //            UserRoleId = userRoleId,
        //        //            SessionId = sessionId.Value,
        //        //            SessionType = sessionType,
        //        //            LastAccess = DateTime.UtcNow
        //        //        };
        //        //        await ctx.UserRoleSession.AddAsync(roleSession);
        //        //    }
        //        //    else
        //        //    {
        //        //        roleSession.SessionId = sessionId.Value;
        //        //        roleSession.LastAccess = DateTime.UtcNow;
        //        //    }
        //        //    await ctx.SaveChangesAsync();

        //        //});
        //    }
        //    else
        //    {
        //        using var command = connection.CreateCommand();
        //        command.CommandText = @"
        //        UPDATE public.""UserRole"" 
        //            SET ""sessionId"" = @session 
        //        WHERE ""Id"" = @id;";
        //        command.Parameters.AddWithValue("@session", sessionId.ToString());
        //        command.Parameters.AddWithValue("@id", userRoleId);
        //        var result = await command.ExecuteNonQueryAsync();
        //        if (result < 0) throw new Exception("Unable to set user session!");
        //    }
        //}

        //private static async Task AuditTrailLogAsync(string connString, long userId, Business business)
        //{
        //    await AdminTokenService.ServiceScopeFactory.DelegateDbContextAsync<AccountContext>(connString, async (context, _) =>
        //    {
        //        var userRole = await context.UserRole.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId)
        //            ?? throw new Exception("User role not found!");

        //        var timezoneName = TimezoneStore.GetTimezoneById((int)business.timezone_id);
        //        var dateByTimezone = DateUtility.GetDateByTimezone(zone: timezoneName);

        //        Audittrial objAuditInfo = new()
        //        {
        //            AuditGroupId = (int)EAuditTrialGroup.LOGIN,
        //            Context = $"{EOperation.LOGIN}",
        //            AuditDate = dateByTimezone,
        //            LoginId = (int)userId,
        //            Operator = userRole.username ?? userRole.email,
        //            Operation = EOperation.LOGIN,
        //            Description = "User opened the business to access the application"
        //        };
        //        context.Audittrial.Add(objAuditInfo);
        //        await context.SaveChangesAsync();
        //    });
        //}
        #endregion

        //private async Task<string> ResolveTenantTokenAsync(
        //    ESessionType sessionType,
        //    //Business business,
        //    string username,
        //    long? userId,
        //    bool passThrough = false,
        //    bool skipMigration = false,
        //    UserSessionTenant sessionTenant = null)
        //{
        //    if (!passThrough && sessionTenant == null)
        //    {
        //        var userSession = userId != null && username == null
        //            ? await userSessionService.TryGetUserSessionAsync(userId.Value, sessionType, business.id)
        //            : await userSessionService.TryGetUserSessionAsync(username, sessionType, business.id);

        //        sessionTenant = await userSessionService.AddOrGetTenantAsync(userSession.Id, business.id);
        //    }

        //    var tenantToken = TenantUtil.GetEncryptedTenant(sessionTenant?.Id, business, username, new()
        //    {
        //        SkipMigration = skipMigration,
        //        PassThrough = passThrough
        //    });

        //    return tenantToken;
        //}

        /// <summary>
        /// When passThrough is True, session will be skipped but only doing migrations instead
        /// </summary>
        /// <returns></returns>
        //public async Task<object> SetUserSessionAsync(
        //    ESessionType sessionType,
        //    //Business business,
        //    string username,
        //    string accessToken = null,
        //    bool passThrough = false,
        //    bool skipAuditLog = false,
        //    bool skipMigration = false,
        //    UserSessionTenant sessionTenant = null)
        //{
        //    var baseUrl = RouteHelper.GetBackendTenantBaseUrl(business);
        //    var apiToken = accessToken ?? webService.HttpContext.Request.GetAccessTokenFromCookie();

        //    var tenantToken = await ResolveTenantTokenAsync(sessionType,
        //        business,
        //        username,
        //        userId: null,
        //        passThrough,
        //        skipMigration,
        //        sessionTenant);

        //    List<Header> headers = [
        //        new(Header.XTenant, tenantToken),
        //        new("X-Session-Type", ((int)sessionType).ToString())
        //    ];
        //    if (skipAuditLog)
        //        headers.Add(new("X-SkipAuditLog", "true"));

        //    var response = await httpHelper.BackendRequest(baseUrl, new()
        //    {
        //        Path = "session/set",
        //        BearerToken = apiToken,
        //        Headers = headers,
        //    });

        //    if (response.StatusCode != System.Net.HttpStatusCode.OK && response.StatusCode != System.Net.HttpStatusCode.Created)
        //        throw new Exception(response.ErrorMessage);

        //    return response.Content.FromJson<Messages>();
        //}
    }
}
