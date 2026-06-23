using Library.Models;
using Localize.Helper.Extensions.Helpers;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Telegrams.Enums;
using static TelegramEngine.Helpers.TLoginHelper;
using static TelegramEngine.Logics.TelegramInstances;

namespace TelegramEngine.Logics;

public sealed class TInstance : IAsyncDisposable
{
    private int _disposedFlag = 0;
    private int _status;
    private CancellationTokenSource? _cts;

    private readonly object _clientLock = new();
    public readonly long UserId;
    //public readonly long BusinessId;
    public readonly EInstanceType InstanceType;
    public readonly BusinessInstance BusinessInstance;
    public readonly string InstanceId = Guid.NewGuid().ToString("N");

    public TInstance(EInstanceType instanceType, /*TenantObject tenant,*/ string? phone, long? sessionId)
    {
        InstanceType = instanceType;
        Phone = phone;
        TSessionId = sessionId;
        //BusinessId = tenant.BusinessId;
        BusinessInstance = new(InstanceId, /*tenant,*/ phone);
    }

    public TInstance(EInstanceType instanceType, /*TenantObject tenant,*/ long userId, string? groupName, long? sessionId = null)
    {
        InstanceType = instanceType;
        UserId = userId;
        TSessionId = sessionId;
        //BusinessId = tenant.BusinessId;
        BusinessInstance = new(InstanceId, /*tenant,*/ userId, groupName);
    }

    public ETelegramStatus Status
    {
        get => (ETelegramStatus)Volatile.Read(ref _status);
        private set => Interlocked.Exchange(ref _status, (int)value);
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposedFlag, 1) != 0) return;

        var logger = BusinessInstance?.Logger;
        try
        {
            Status = ETelegramStatus.Disposed;
            var cts = _cts;
            _cts = null;
            cts?.Cancel();
            cts?.Dispose();
            var client = TClient;
            TClient = null;
            if (client != null)
                await client.DisposeAsync();

            try
            {
                await DelegateContextAsync(async context => await context.TelegramSessionStores
                    .Where(x => x.Id == SessionStoreId
                        && x.PhoneNumber == null
                        && x.TSessionId == null)
                    .ExecuteDeleteAsync());

                OnDispose?.Invoke();
            }
            catch { }
        }
        catch (Exception ex)
        {
            logger?.Warn("DisposeAsync error: {0}", ex.Message);
        }
        GC.SuppressFinalize(this);
    }


    public async Task ReinitClientAsync(TelegramOptions options)
    {
        if (TClient != null)
        {
            TClient.DisableUpdates();
            await TClient.DisposeAsync();
        }

        var client = await InitClientAsync(this, options);
        SetClient(client);
    }

    public async Task<bool> IsLoggedIn(/*long? businessId = null*/)
    {
        //businessId ??= BusinessInstance?.BusinessId ?? BusinessId;
        return await DelegateContextAsync((context) => context.TelegramSessionBusiness
            .AnyAsync(x => /*x.BusinessId == businessId &&*/ x.IsActive
                && !x.TelegramSession.AuthRestart));
    }

    public string? GetCleanPhone() => Phone?.RemoveSpecialCharacterAndSpaces();
    public void SetSessionStoreId(Guid storeId) => SessionStoreId = storeId;
    public void SetClient(WTelegram.Client? client)
    {
        lock (_clientLock)
        {
            TClient = client;
        }
    }
    public void SetWhat(string? what = null) => What = what;
    public void SetLastUpdate(DateTime? lastUpdate = null) => LastUpdate = lastUpdate ?? DateTime.UtcNow;
    public void SetActionMode(ETActionMode mode = ETActionMode.None) => TActionMode = mode;

    public void SetStatus(ETelegramStatus status) => Status = status;
    public void SetQrCode(string? qrCode) => QrCode = qrCode;
    public void SetPhone(string? phone) => Phone = phone;
    public void SetSessionId(long id) => TSessionId = id;

    public Action? OnDispose { get; set; }

    public Guid? SessionStoreId { get; private set; }
    public long? TSessionId { get; private set; }
    public WTelegram.Client? TClient { get; private set; }
    public ETActionMode TActionMode { get; private set; } = ETActionMode.None;
    public string? What { get; private set; }
    public DateTime LastUpdate { get; private set; } = DateTime.UtcNow;
    public string? QrCode { get; private set; }
    public CancellationTokenSource? Cts { get; set; }
    public Action<TInstance>? OnTimeout { get; set; }
    public string? Phone { get; private set; }
    public bool IsDisposed => Volatile.Read(ref _disposedFlag) == 1;
}

