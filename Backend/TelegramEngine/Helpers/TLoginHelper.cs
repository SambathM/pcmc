using Library.Models;
using Library.PgBouncer;
using Library.Services.QueueBackgroundTasks;
using Localize.Helper.Extensions.Helpers;
using Localize.Logger;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TelegramEngine.Data;
using TelegramEngine.Logics;
using TelegramEngine.Models;
using TelegramEngine.Services;

namespace TelegramEngine.Helpers
{
    internal static class TLoginHelper
    {
        private const int MaxSessionSaveRetry = 5;
        private const int SessionRetryDelayMs = 1000;

        private readonly static LocalizeLogger Logger = new(typeof(TLoginHelper));

        private static IServiceScopeFactory ServiceScopeFactory => TelegramInstances.ScopeFactory;

        /// <summary>
        /// Performs the action when a user is logged in.
        /// </summary>
        internal static async Task OnTlgLoggedInActionAsync(this TInstance instance, TL.User tlUser, Action<OnActionContext> onAction)
        {
            if (onAction == null) return;
            await DelegateContextAsync(async (context) => onAction(new()
            {
                //Context = context,
                Instance = instance,
                User = tlUser
            }));
        }

        internal static TResult DelegateScope<TService, TResult>(Func<TService, TResult> action) where TService : class
        {
            using var scope = ServiceScopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<TService>();
            return action(service);
        }

        internal static Task DelegateScopeAsync<TService>(Func<TService, Task> func) where TService : class
         => DelegateScopeAsync<TService, bool>(async (service) =>
            {
                await func(service);
                return true;
            });

        internal static Task<T> DelegateScopeAsync<TService, T>(Func<TService, Task<T>> func) where TService : class
        {
            using var scope = ServiceScopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<TService>();
            return func(service);
        }

        internal static Task DelegateContextAsync(Func<TelegramContext, Task> func)
            => DelegateContextAsync(async (ctx) =>
            {
                await func(ctx);
                return true;
            });

        internal static Task<T> DelegateContextAsync<T>(Func<TelegramContext, Task<T>> func)
        {
            using var scope = ServiceScopeFactory.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<IPgBouncerContextHandler<TelegramContext>>();
            return handler.ExecuteWithRetryAsync(func);
        }

        internal static bool TryNotifyToClient(string groupName,
            string methodName,
            object data,
            CancellationToken cancellationToken = default)
        {
            using var scope = ServiceScopeFactory.CreateScope();
            var queueService = scope.ServiceProvider.GetRequiredService<IBackgroundTaskQueueService>();
            var tryEnqueue = queueService.TryEnqueue<ISignalRHubService>(x =>
               x.SendMessageAsync(groupName, methodName, data, true));

            if (!tryEnqueue)
            {
                Logger.Warn("Failed to enqueue NotifyToClientAsync for group {0}, method {1}\n" +
                    "Now retrying with Task(()=>...) for Fire and Forget.", groupName, methodName);

                // Fire and forget (no context capture)
                Task.Run(async () => await NotifyToClientAsync(groupName, methodName, data, cancellationToken),
                    cancellationToken);
            }

            return tryEnqueue;
        }

        internal static async Task NotifyToClientAsync(string groupName,
            string methodName,
            object data,
            CancellationToken cancellationToken = default)
        {
            using var scope = ServiceScopeFactory.CreateScope();
            var queueService = scope.ServiceProvider.GetRequiredService<IBackgroundTaskQueueService>();
            await queueService.Enqueue<ISignalRHubService>(x =>
                x.SendMessageAsync(groupName, methodName, data, true),
                    cancellationToken: cancellationToken);
        }

        /// <summary>
        /// Synchronizes the profile photo for the specified context.
        /// </summary>
        internal static async Task<TelegramSession?> SyncProfilePhotoAsync(this TInstance instance)
            => await DelegateContextAsync(async (context) =>
            {
                TelegramSessionBusiness? sessionBusiness =
                    context.TelegramSessionBusiness
                        .Include(x => x.TelegramSession)
                        .FirstOrDefault(x => x.TSessionId == instance.TSessionId /*&& x.BusinessId == instance.BusinessInstance.BusinessId*/);

                if (sessionBusiness?.TelegramSession?.ProfilePhoto?.IsNullOrEmpty() ?? false)
                {
                    if (long.TryParse(sessionBusiness?.TelegramSession?.AccessHash, out long accessHash) && accessHash == 0)
                    {
                        instance.BusinessInstance?.Logger?.Warn("SyncProfilePhotoAsync: AccessHash is invalid for session {0}", sessionBusiness?.TelegramSession?.Id);
                        return sessionBusiness?.TelegramSession;
                    }

                    string? photoSource = null;
                    if (instance.TClient != null)
                    {
                        photoSource =
                            await instance.TClient
                            .TryDownloadProfilePhotoAsync(accessHash);
                    }

                    if (!string.IsNullOrWhiteSpace(photoSource))
                    {

                        //TenantObject tenantObject = new()
                        //{
                        //    Name = instance.BusinessInstance.Name,
                        //    BusinessId = instance.BusinessInstance.BusinessId,
                        //    DbName = NpsqlUtility.GetDbName(instance.BusinessInstance.ConnString),
                        //    CloudDir = "dir_" + instance.BusinessInstance.GroupName,
                        //};

                        using var scope = ServiceScopeFactory.CreateScope();
                        var telegramInstances =
                            scope.ServiceProvider.GetService<TelegramInstances>();

                        TelegramService telegramService = new(/*tenantObject*/);
                        string? uploadPhoto =
                            await TelegramService.UploadProfilePhotoAsync(photoSource, accessHash);

                        if (sessionBusiness != null && uploadPhoto != null)
                        {
                            sessionBusiness.TelegramSession.ProfilePhoto = uploadPhoto;
                            context.TelegramSessions.Update(sessionBusiness.TelegramSession);
                            await context.SaveChangesAsync();
                        }
                    }
                }

                return sessionBusiness?.TelegramSession;
            });

        // Central login completion worker
        internal static void OnTlgLoggedInWorker(OnActionContext action)
        {
            var instance = action.Instance;
            var logger = instance?.BusinessInstance?.Logger;

            if (instance == null)
            {
                logger?.Error("OnTlgLoggedInWorker: instance is null");
                return;
            }

            // Fire & forget (capture context)
            _ = Task.Run(async () =>
            {
                var ct = action.Instance?.Cts;
                for (int attempt = 1; attempt <= MaxSessionSaveRetry && !(ct?.IsCancellationRequested ?? true); attempt++)
                {
                    if (await SaveSessionAsync(action))
                    {
                        logger?.Info("Session saved (attempt {0})", attempt);
                        break;
                    }

                    if (attempt == MaxSessionSaveRetry)
                    {
                        logger?.Error("Failed to save session after {0} attempts", MaxSessionSaveRetry);
                        return;
                    }
                    await Task.Delay(SessionRetryDelayMs, ct.Token);
                }
                if (ct?.IsCancellationRequested ?? true) return;

                try
                {
                    // Optional: sync profile/photo if you have such a method
                    var sessionInfo = await instance.SyncProfilePhotoAsync();
                    if (sessionInfo != null && !string.IsNullOrWhiteSpace(instance.BusinessInstance.GroupName))
                    {
                        // Multi-session: notify the per-user client group ({userId}-{groupName}),
                        // not the bare group name, so the success event reaches the browser that
                        // started THIS login attempt. The payload is the freshly authorized session.
                        await NotifyToClientAsync(instance.BusinessInstance.GetSignalRClientId(), TSignalRMethod.OnTlgLoggedIn, sessionInfo);
                    }
                }
                catch (Exception ex)
                {
                    logger?.Warn("Profile sync error: {0}", ex.Message);
                }

            }, action.Instance?.Cts?.Token ?? CancellationToken.None);
        }

        // Unified session save with transaction + cleanup
        private static async Task<bool> SaveSessionAsync(OnActionContext action)
        {
            if (action.Instance?.IsDisposed ?? true) return false;

            try
            {
                //var ctx = action.Context;
                var user = action.User;
                var instance = action.Instance;
                var logger = instance?.BusinessInstance?.Logger;

                return await DelegateContextAsync(async (ctx) =>
                {
                    //using var trx = await ctx.Database.BeginTransactionAsync();

                    var accessHash = user?.access_hash.ToString();

                    var tSession = await ctx.TelegramSessions.FirstOrDefaultAsync(x => x.AccessHash == accessHash);
                    if (tSession == null)
                    {
                        tSession = new TelegramSession
                        {
                            FirstName = user?.first_name,
                            LastName = user?.last_name,
                            UserName = user?.username,
                            PhoneNumber = user?.phone,
                            IsAuthorized = true,
                            AccessHash = accessHash
                        };
                        await ctx.TelegramSessions.AddAsync(tSession);
                        await ctx.SaveChangesAsync();
                    }
                    else
                    {
                        bool changed = false;
                        if (tSession.FirstName != user?.first_name) { tSession.FirstName = user?.first_name; changed = true; }
                        if (tSession.LastName != user?.last_name) { tSession.LastName = user?.last_name; changed = true; }
                        if (tSession.UserName != user?.username) { tSession.UserName = user?.username; changed = true; }
                        if (tSession.PhoneNumber != user?.phone) { tSession.PhoneNumber = user?.phone; changed = true; }
                        if (!tSession.IsAuthorized) { tSession.IsAuthorized = true; changed = true; }
                        if (tSession.AuthRestart) { tSession.AuthRestart = false; changed = true; }

                        if (changed)
                        {
                            ctx.TelegramSessions.Update(tSession);
                            await ctx.SaveChangesAsync();
                        }
                    }

                    //var businessId = instance.BusinessInstance?.BusinessId ?? instance.BusinessId;

                    // Deactivate previous bindings
                    //await ctx.TelegramSessionBusiness
                    //   .Where(x => x.BusinessId == businessId)
                    //   .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, false));

                    // Bind current
                    //await SaveToBusinessAsync(action, tSession);

                    if (instance?.SessionStoreId != null && user != null)
                    {
                        await ctx.TelegramSessionStores
                           .Where(x => x.Id == instance.SessionStoreId)
                           .ExecuteUpdateAsync(s => s
                               .SetProperty(p => p.PhoneNumber, user.phone)
                               .SetProperty(p => p.TSessionId, tSession.Id));

                        await ctx.TelegramSessionStores
                           .Where(x => x.PhoneNumber == user.phone && x.Id != instance.SessionStoreId)
                           .ExecuteDeleteAsync();
                    }

                    if (user != null)
                    {
                        await ctx.TelegramSessions
                           .Where(x => x.PhoneNumber == user.phone && x.Id != tSession.Id)
                           .ExecuteDeleteAsync();
                    }

                    //await trx.CommitAsync();

                    instance?.SetSessionId(tSession.Id);

                    // Multi-session: only ONE live instance may own a session. If this login
                    // (re)bound an account that already had a running instance, dispose the stale
                    // one so two WTelegram clients don't contend for the same session (which the
                    // loser surfaces as "You must connect to Telegram first").
                    if (instance != null)
                    {
                        var live = DelegateScope<TelegramInstances, IReadOnlyCollection<TInstance>>(svc => svc.Snapshot());
                        foreach (var other in live)
                        {
                            if (other.TSessionId == tSession.Id && other.InstanceId != instance.InstanceId)
                                await other.DisposeAsync();
                        }
                    }

                    logger?.Info("SaveSessionAsync completed (SessionId={0})", tSession.Id);
                    return true;
                });
            }
            catch (Exception ex)
            {
                action.Instance.BusinessInstance?.Logger?.Error("SaveSessionAsync error: {0}", ex.Message);
                return false;
            }
        }


        //private static async Task SaveToBusinessAsync(OnActionContext action, TelegramSession tSession)
        //{
        //    long businessId = action.Instance.BusinessInstance?.BusinessId ?? action.Instance.BusinessId;
        //    await DelegateContextAsync(async (ctx) =>
        //    {
        //        var sessionBusiness = await ctx.TelegramSessionBusiness
        //        .FirstOrDefaultAsync(x => x.TSessionId == tSession.Id && x.BusinessId == businessId);

        //        EntityState entityState = sessionBusiness != null
        //            ? EntityState.Modified
        //            : EntityState.Added;

        //        sessionBusiness ??= new TelegramSessionBusiness
        //        {
        //            BusinessId = businessId,
        //            TSessionId = tSession.Id,
        //            CloudDir = $"dir_{action.Instance.BusinessInstance.GroupName}",
        //            CreatedBy = action.Instance.BusinessInstance.UserId
        //        };

        //        sessionBusiness.IsActive = true;
        //        ctx.Entry(sessionBusiness).State = entityState;
        //        await ctx.SaveChangesAsync();
        //    });
        //}


    }
}
