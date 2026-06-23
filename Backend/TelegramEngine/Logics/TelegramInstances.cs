using Library.Models;
using Localize.Helper.Extensions.Helpers;
using Localize.Logger;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Collections.Concurrent;
using static TelegramEngine.Helpers.TLoginHelper;

namespace TelegramEngine.Logics
{
    /// <summary>
    /// <see cref="WTelegram.Client"/> instances manager (hosted)
    /// </summary>
    public class TelegramInstances : BackgroundService
    {
        private static readonly LocalizeLogger<TelegramInstances> Logger = new();
        internal static IServiceScopeFactory ScopeFactory { get; private set; } = null!;
        private readonly TelegramOptions _options;
        internal readonly ConcurrentDictionary<string, TInstance> Instances = new();

        public TelegramInstances(IServiceScopeFactory serviceScopeFactory, TelegramOptions telegramOptions)
        {
            ScopeFactory = serviceScopeFactory;
            _options = telegramOptions;
        }

        internal TelegramOptions Options => _options;


        // HOSTED LOOP
        protected override async Task ExecuteAsync(CancellationToken cancellationToken)
        {
            var roundCount = 0;
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(Options.CleanupIntervalMilliseconds, cancellationToken);

                    if (roundCount >= Options.VerboseLogEveryRounds && !Instances.IsEmpty)
                    {
                        LogInstanceCount();
                        roundCount = 0;
                    }

                    await CleanupInstances(cancellationToken);
                    roundCount++;
                }
                catch (OperationCanceledException) { }
                catch (Exception ex)
                {
                    Logger.Error("ExecuteAsync loop error: {0}", ex.Message);
                }
            }
        }

        public TInstance GetOrAdd(TInstance instance)
        {
            instance.OnDispose ??= () =>
            {
                Remove(instance.InstanceId, out _);
            };
            return Instances.GetOrAdd(instance.InstanceId, _ => instance);
        }

        public bool TryGet(string? id, out TInstance? inst)
            => Instances.TryGetValue(id ?? string.Empty, out inst);

        // Fix for CA2012: Ensure ValueTask from DisposeAsync is awaited
        public bool Remove(string? id, out TInstance? inst)
        {
            if (Instances.TryRemove(id ?? string.Empty, out inst))
            {
                // Await DisposeAsync to ensure ValueTask is consumed
                inst.DisposeAsync().AsTask().Wait();
                return true;
            }
            return false;
        }

        public IReadOnlyCollection<TInstance> Snapshot()
            => [.. Instances.Values];

        internal TInstance? GetByInstanceId(string? instanceId)
            => TryGet(instanceId, out var inst) ? inst : null;

        internal TInstance? GetByUserAndPhone(long userId, string? phone)
        {
            return Instances.Values.FirstOrDefault(x => x.BusinessInstance != null
                && x.BusinessInstance.UserId == userId
                && x.BusinessInstance.Phone == phone);
        }


        private void LogInstanceCount()
        {
            try
            {
                var snapshot = Snapshot();
                var instanceIds = snapshot.Select((x, i) => $"\t\t{i + 1}. {x.InstanceId}").ToList();
                Logger.Info("==[]== Total TG instances: {0}\n{1}", snapshot.Count, string.Join("\n", instanceIds));
            }
            catch (Exception ex)
            {
                Logger.Warn("LogInstanceCount error: {0}", ex.Message);
            }
        }

        private int ResolveTimeoutMinutes(TInstance instance)
            => instance.TActionMode == ETActionMode.None
                ? Options.InstanceTimeoutMinutes
                : Options.ActiveActionTimeoutMinutes;

        private bool IsActive(TInstance instance, DateTime utcNow)
        {
            var timeout = ResolveTimeoutMinutes(instance);
            var lifeMinutes = (utcNow - instance.LastUpdate).TotalMinutes; // ensure LastUpdateUtc uses UTC in TInstance
            if (lifeMinutes < timeout) return true;

            // QR code flow: shorter timeout while QR code exists
            if (!string.IsNullOrWhiteSpace(instance.QrCode) && lifeMinutes < Options.QrCodeInstanceTimeoutMinutes)
                return true;

            return false;
        }

        private async Task CleanupInstances(CancellationToken ct)
        {
            try
            {
                var utcNow = DateTime.UtcNow;
                var all = Snapshot(); // snapshot
                var active = new List<TInstance>(capacity: all.Count);

                foreach (var inst in all)
                {
                    if (IsActive(inst, utcNow))
                        active.Add(inst);
                }

                if (active.Count > 0)
                {
                    try
                    {
                        var descriptive = active.Select((x, i) =>
                        {
                            var timeout = ResolveTimeoutMinutes(x);
                            var life = utcNow - x.LastUpdate;
                            var storeIdStr = x.SessionStoreId?.ToString() ?? "NULL";
                            var sessionDes = storeIdStr.Length > 10
                                ? $"{storeIdStr[..5]}...{storeIdStr[^5..]}"
                                : storeIdStr;

                            return $"\t\t{i + 1}. SStoreId={sessionDes}, Phone={x.Phone}, Timeout={timeout}m, Life={life:hh\\:mm\\:ss}";
                        });

                        Logger.Warn("==[]== Active TG instances = {0}:\n{1}", active.Count, string.Join("\n", descriptive));
                    }
                    catch { }
                }

                // Dispose stale ones
                foreach (var stale in all.Except(active).ToList())
                {
                    if (ct.IsCancellationRequested) break;
                    var timeout = ResolveTimeoutMinutes(stale);
                    await DisposeInstance(stale, timeout);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                Logger.Warn("CleanupInstances error: {0}", ex.Message);
            }
        }

        private static async Task DisposeInstance(TInstance instance, int timeout)
        {
            try
            {
                await instance.DisposeAsync();
                Logger.Warn("==[]== Cleaned up Telegram instance: SessionStoreId={0}, Phone={1}, Timeout={2} minutes of no use",
                    instance.SessionStoreId, instance.Phone, timeout);

                instance.OnTimeout?.Invoke(instance);
            }
            catch (Exception ex)
            {
                Logger.Warn("DisposeInstance error (SessionStoreId={0}): {1}", instance.SessionStoreId, ex.Message);
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            Logger.Warn("Stopping TelegramInstances service...");
            try
            {
                var list = Snapshot();
                foreach (var x in list)
                {
                    Logger.Warn("[SYSTEM_SHUTDOWN] disposing \"{0}\" ...", x.SessionStoreId?.ToString());
                    await x.DisposeAsync();
                }
            }
            catch (Exception ex)
            {
                Logger.Error("StopAsync error: {0}", ex.Message);
            }
            await base.StopAsync(cancellationToken);
        }

        // (Kept signature) Legacy name changed to StopAsync above; OnStopAsync removed if unused elsewhere.
        // If something calls OnStopAsync explicitly, keep a wrapper:
        protected virtual async Task OnStopAsync(CancellationToken token)
            => await StopAsync(token);

        internal async Task<WTelegram.Client?> InitClientAsync(TInstance instance)
            => await InitClientAsync(instance, Options);

        internal static async Task<WTelegram.Client?> InitClientAsync(TInstance instance, TelegramOptions options)
        {
            try
            {
                if (instance.TClient == null)
                {
                    if (instance.InstanceType == EInstanceType.None && await instance.IsLoggedIn())
                    {
                        var storeId = await DelegateContextAsync(async context => await context.TelegramSessionStores
                            .Where(x => x.TSessionId == instance.TSessionId)
                            .Select(x => x.Id).FirstOrDefaultAsync());
                        instance.SetSessionStoreId(storeId);
                    }

                    Logger.Info("Initializing new client");

                    var client = await ConfigClientAsync(options, instance);

                    instance.SetClient(client);
                }
                else
                {
                    await instance.TClient.ConnectAsync().ConfigureAwait(false);
                }
                return instance.TClient;
            }
            catch (Exception ex)
            {
                Logger.Error("InitClientAsync error: {0}", ex.Message);
            }
            return null;
        }

        private static async Task<WTelegram.Client> ConfigClientAsync(TelegramOptions options, TInstance instance)
        {
            var sessionStore = await TSessionStore.CreateAsync(instance);
            var client = new WTelegram.Client(what => what switch
            {
                "api_id" => options.ServerConfig.ApiId.ToString(),
                "api_hash" => options.ServerConfig.ApiHash,
                "server_address" => options.ServerConfig.Host,
                "phone_number" => instance.GetCleanPhone(),
                _ => null,
            }, sessionStore);

            return client;
        }

        public async Task<TInstance> CreateQRInstance(/*TenantObject tenant,*/ long userId, string groupName)
        {
            var instances = Snapshot()
                .Where(x => x.InstanceType != EInstanceType.None
                    //&& x.BusinessId == tenant.BusinessId
                    && x.UserId == userId)
                .ToList();

            foreach (var ix in instances)
            {
                Logger.Error("removing existing Instance, busId: {0}, usrId: {1}", /*tenant.BusinessId*/null, userId);
                await ix.DisposeAsync();
            }

            await DelegateContextAsync(async context => await context.TelegramSessionStores.Where(x => x.UserId == userId
                && x.TSessionId == null && x.PhoneNumber == null).ExecuteDeleteAsync());

            //if (tenant.BusinessId.ToString() == null || tenant.ConnString == null)
            //    throw new Exception("subject and connString are required!");

            var instance = new TInstance(EInstanceType.QrLogin, /*tenant,*/ userId, groupName);
            GetOrAdd(instance);

            await InitClientAsync(instance);
            Logger.Info("===> QRCode login added new instance = {0}, userId: {1}", /*instance.BusinessInstance?.Name*/null, userId);

            await WaitForInitializationAsync(instance);
            return instance;
        }

        public async Task<TInstance> CreatePhoneInstance(/*TenantObject tenant,*/ long userId, string groupName, string? phone, long? sessionId)
        {
            phone = phone?.RemoveSpecialCharacterAndSpaces();
            var instance = Snapshot().FirstOrDefault(x => x.TSessionId == sessionId);
            if (instance?.TClient == null)
            {
                //if (tenant.BusinessId.ToString() == null || phone == null || tenant.ConnString == null)
                //    throw new Exception("subject, connString and phone are required!");

                instance = new(EInstanceType.PhoneLogin, /*tenant,*/ userId, groupName, sessionId);
                instance.BusinessInstance?.SetPhone(phone);

                //instance.Add();
                GetOrAdd(instance);
                await InitClientAsync(instance);
                Logger.Info("===> added new phone instance = {0}", /*tenant?.Name*/ null!);
            }
            else
            {
                try
                {
                    await instance.TClient.IsAuthorizedAsync();
                    await instance.TClient.ConnectAsync();
                }
                catch (Exception ex)
                {
                    Logger.Warn("Reconnect existing phone instance error: {0}", ex.Message);
                }
            }

            await WaitForInitializationAsync(instance);
            instance.SetLastUpdate();
            return instance;
        }

        /// <summary>
        /// Creates or reuses a normal (non-login) instance.
        /// </summary>
        public async Task<TInstance> CreateInstance(/*TenantObject tenant,*/ long? sessionId, string? phone)
        {
            phone = phone?.RemoveSpecialCharacterAndSpaces();
            var instance = Snapshot().FirstOrDefault(x => x.TSessionId == sessionId);
            if (instance == null)
            {
                //if (tenant.BusinessId <= 0 || string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(tenant.ConnString))
                //    throw new Exception("subject, connString and phone are required!");

                instance = new(EInstanceType.None, /*tenant,*/ phone, sessionId);
                GetOrAdd(instance);
                await InitClientAsync(instance);

                Logger.Info("===> added new instance instanceId: {0}, TSessionId: {1}, SesStoreId: {2}",
                    instance.InstanceId, instance.TSessionId, instance.SessionStoreId?.ToString());
            }

            await WaitForInitializationAsync(instance);
            instance.SetLastUpdate();
            return instance;
        }

        private static async Task WaitForInitializationAsync(TInstance instance)
        {
            if (instance == null) return;

            // Wait until SetClient happened (defensive max wait 30s)
            var start = DateTime.UtcNow;
            while (instance.TClient == null && (DateTime.UtcNow - start).TotalSeconds < 30)
                await Task.Delay(1_000);

            try
            {
                if (instance.TClient != null)
                    await instance.TClient.ConnectAsync().ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                Logger.Warn("WaitForInitialization connect error: {0}", ex.Message);
            }
        }

        // Helper to remove & dispose (optional external call)
        public async Task<bool> RemoveInstanceAndDispose(string id)
        {
            if (TryGet(id, out var inst) && inst != null)
            {
                await inst.DisposeAsync(); // Already awaited, correct
                Remove(id, out _);         // Remove now waits for DisposeAsync
                return true;
            }
            return false;
        }
    }
}
