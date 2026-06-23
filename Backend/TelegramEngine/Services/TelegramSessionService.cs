using Library.Models;
using Library.Services;
using Localize.Helper.Extensions.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TelegramEngine.Helpers;
using TelegramEngine.Logics;
using TelegramEngine.Models;
using TelegramEngine.Telegrams.Enums;

namespace TelegramEngine.Services
{
    public interface ITelegramSessionService
    {
        Task ClearSessionAsync(string? phone, long userId);
        Task DisConnectAsync();
        Task<TelegramSession?> GetCurrentSessionAsync();
        Task<TelegramSession?> GetLoginStatusAsync(string instanceId);
        Task<bool> IsAlertChangeNumberAsync(string phoneNumber);
        Task StartupSessionAsync(bool waitForTaskToComplete = false);
    }

    internal class TelegramSessionService : ITelegramSessionService
    {
        private readonly TelegramService telegramService;
        //private readonly TenantUtility tenantUtility;
        private readonly WebService webService;
        private readonly TelegramInstances telegramInstances;

        public TelegramSessionService(
            ITelegramService telegramService,
            //ITenantUtility tenantUtility,
            TelegramInstances telegramInstances,
            IWebService webService)
        {
            this.telegramService = (telegramService as TelegramService)!;
            //this.tenantUtility = tenantUtility as TenantUtility;
            this.webService = (webService as WebService)!;
            this.telegramInstances = telegramInstances!;
        }

        public TelegramSessionService(TelegramService telegramService)
        {
            this.telegramService = telegramService;
            // Comply to DI, but this constructor is not expected to be used
            webService = null!;
            telegramInstances = null!;
        }

        public async Task StartupSessionAsync(bool waitForTaskToComplete = false)
        {
            try
            {
                //var tenantObject = tenantUtility.Tenant;
                var userId = webService.CurrentUserId;

                var sessionTask = Task.Run(async () =>
                {
                    using var scope = TelegramInstances.ScopeFactory.CreateScope();
                    var tSessionSvc = new TelegramSessionService(new());
                    //var clientId = $"{userId}-{tenantObject.CloudDir.Removes("dir_")}";
                    var session = await tSessionSvc.GetCurrentSessionAsync()
                        ?? throw new Exception("Current session is undefined");

                    var clientId = $"{userId}";
                    var taskServerService = scope.ServiceProvider.GetRequiredService<ISignalRHubService>();

                    await taskServerService.SendMessageAsync(clientId, "onTlgSession", session);
                });

                if (waitForTaskToComplete)
                    await sessionTask;
            }
            catch (Exception ex)
            {
                throw new Exception("Error during Telegram session startup", ex);
            }
        }

        //public async Task<TelegramSession> GetCurrentSessionAsync() => await GetCurrentSessionAsync(null);

        public async Task<TelegramSession?> GetCurrentSessionAsync(/*long? businessId = null*/)
        {
            // Enterprise: return the most recently updated authorized session (no tenant/business context needed).
            // SaaS (TODO): restore lookup via TelegramSessionBusiness.Where(IsActive && BusinessId == tenantId):
            //   var session = (await TLoginHelper.DelegateContextAsync(ctx => ctx.TelegramSessionBusiness.AsNoTracking()
            //       .Include(x => x.TelegramSession)
            //       .FirstOrDefaultAsync(x => x.IsActive /*&& x.BusinessId == businessId*/)))?.TelegramSession;
            var session = await TLoginHelper.DelegateContextAsync(ctx => ctx.TelegramSessions.AsNoTracking()
                .Where(x => x.IsAuthorized)
                .OrderByDescending(x => x.LastUpdatedOn)
                .FirstOrDefaultAsync());

            if (session != null)
            {
                // Enterprise: bind the service to this session before calling InitInstanceAsync.
                // SaaS (TODO): TSession was resolved by the tenant context — remove this line when reverting.
                telegramService.CurrentSession(session.Id);

                //return this session if auth restarted
                if (session.AuthRestart)
                    return session;

                var initAsync = await telegramService.InitInstanceAsync();
                if (initAsync.Status != ETelegramStatus.Valid || !long.TryParse(session.AccessHash, out var accessHash))
                    return null;

                //try to authorize current session
                var authState = await telegramService.Instance.TClient!.AuthorizationStateAsync(accessHash);
                switch (authState)
                {
                    case ETAuthorizationState.LostConnection:
                        await telegramService.OnLostConnectionAsync();
                        return telegramService.TSession;
                    case ETAuthorizationState.Unauthorized:
                        await telegramService.OnAuthRestartAsync();
                        return telegramService.TSession;
                }

                //init profile photo if needed
                if (string.IsNullOrEmpty(session.ProfilePhoto) && !string.IsNullOrWhiteSpace(session.PhoneNumber))
                {
                    var getProPhoto = await telegramService
                        .SyncProfilePhotoAsync(session.PhoneNumber);

                    //if unauthorized
                    if (getProPhoto != null && getProPhoto.Status == ETelegramStatus.AuthRestart)
                    {
                        await telegramService.OnAuthRestartAsync();
                        return telegramService.TSession;
                    }

                    session.ProfilePhoto = getProPhoto?.Data?.ToString();
                }
            }
            return session;
        }

        /// <summary>
        /// Multi-session login completion check, scoped to ONE login attempt by its InstanceId.
        /// Returns the authorized session that THIS instance bound to once login completes,
        /// or null while the attempt is still pending. This is the correct primitive for the
        /// connect flow to poll — unlike GetCurrentSessionAsync it never reports some other
        /// account's session as "already authorized".
        /// </summary>
        public async Task<TelegramSession?> GetLoginStatusAsync(string instanceId)
        {
            if (string.IsNullOrWhiteSpace(instanceId)) return null;

            var instance = telegramInstances.GetByInstanceId(instanceId);
            // No bound session id yet => this attempt hasn't finished logging in.
            if (instance?.TSessionId == null) return null;

            return await TLoginHelper.DelegateContextAsync(ctx => ctx.TelegramSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == instance.TSessionId && x.IsAuthorized && !x.AuthRestart));
        }

        public async Task DisConnectAsync()
        {
            var session = await GetCurrentSessionAsync();
            if (session != null)
            {
                // Enterprise: dispose the running instance for this session.
                // SaaS (TODO): restore TelegramSessionBusiness.IsActive = false when reverting:
                //   await TLoginHelper.DelegateContextAsync(ctx => ctx.TelegramSessionBusiness.AsNoTracking()
                //       .Where(x => x.TSessionId == session.Id /*&& x.BusinessId == tenantUtility.Tenant.BusinessId*/)
                //       .ExecuteUpdateAsync(x => x.SetProperty(sx => sx.IsActive, false)));
                var sessionInstance = telegramInstances.Snapshot().FirstOrDefault(x => x.TSessionId == session.Id);
                if (sessionInstance != null)
                    await sessionInstance.DisposeAsync();

                telegramInstances.Options?.StateEvents?.OnDisconnectedOrAuthRestart?.Invoke(session, string.Empty);
            }
        }

        public async Task ClearSessionAsync(string? phone, long userId)
        {
            phone = (phone ?? string.Empty).NoSpecialCharsAndSpaces();
            var instance = telegramInstances.GetByUserAndPhone(userId, phone);
            if (instance != null)
            {
                await instance.DisposeAsync();
            }

            await TLoginHelper.DelegateContextAsync(ctx => ctx.TelegramSessionStores
                .Where(x => x.PhoneNumber == phone && x.UserId == userId)
                .ExecuteDeleteAsync());
        }

        public async Task<bool> IsAlertChangeNumberAsync(string phoneNumber)
        {
            var session = await TLoginHelper.DelegateContextAsync(ctx
                => ctx.TelegramSessions.AsNoTracking().FirstOrDefaultAsync(x => x.PhoneNumber == phoneNumber));

            return session == null || !await TLoginHelper.DelegateContextAsync(ctx
                => ctx.TelegramContacts.AnyAsync(x => x.SessionContacts.Any(sc => sc.TSessionId == session.Id)));
        }

    }
}
