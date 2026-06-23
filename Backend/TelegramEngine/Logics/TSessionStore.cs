using Library.Models;
using Localize.Logger;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Models;
using static TelegramEngine.Helpers.TLoginHelper;

namespace TelegramEngine.Logics;

/// <summary>
/// In-memory session store implementing debounced persistence to DB.
/// Use CreateAsync for initialization.
/// Supports soft-close: BeginSoftClose() stops future writes (logged once) but still allows reads until Dispose.
/// </summary>
internal sealed class TSessionStore : Stream
{
    private readonly object _writeLock = new();
    private readonly SemaphoreSlim _persistGate = new(1, 1);

    private byte[] _sessionData = [];
    private int _dataLength;
    private bool _isExisting;
    private DateTime _lastPersistAttemptUtc;

    private long _position;

    private CancellationTokenSource? _debounceCts;
    private static readonly TimeSpan PersistDebounce = TimeSpan.FromMilliseconds(300);

    private readonly TInstance _instance;
    private readonly SessionStoreActions? _actions;
    private readonly LocalizeLogger<TSessionStore> _logger = new();

    private Guid _sessionStoreId;
    private volatile bool _initialized;

    private enum StoreState { Active = 0, SoftClosed = 1, Disposed = 2 }
    private int _state; // atomic state
    private StoreState State => (StoreState)Volatile.Read(ref _state);

    private int _softCloseWriteLogFlag; // ensure we log ignored writes only once

    private TSessionStore(TInstance instance, SessionStoreActions? actions)
    {
        _instance = instance;
        _actions = actions;
        _sessionStoreId = instance.SessionStoreId ?? Guid.Empty;
    }

    public static async Task<TSessionStore> CreateAsync(
        TInstance instance,
        SessionStoreActions? actions = null,
        CancellationToken ct = default)
    {
        var store = new TSessionStore(instance, actions);
        await store.InstantiateAsync(ct).ConfigureAwait(false);
        store._initialized = true;

        // On instance dispose: soft-close (force final persist) then dispose store.
        instance.OnDispose += () =>
        {
            try
            {
                store.BeginSoftClose(forceFinalPersist: true);
                store.Dispose();
            }
            catch { }
        };

        return store;
    }

    /// <summary>
    /// Transition to SoftClosed (idempotent). Further writes/SetLength are ignored (logged once).
    /// Optionally forces a final persist of current buffer.
    /// </summary>
    private void BeginSoftClose(bool forceFinalPersist = true)
    {
        if (Interlocked.CompareExchange(ref _state, (int)StoreState.SoftClosed, (int)StoreState.Active) != (int)StoreState.Active)
            return;

        try
        {
            CancellationTokenSource? toCancel;
            lock (_writeLock)
            {
                toCancel = _debounceCts;
                _debounceCts = null;
            }
            toCancel?.Cancel();

            if (forceFinalPersist)
            {
                ForcePersist().ConfigureAwait(false).GetAwaiter().GetResult();
            }

            _logger.Info("Session store soft-closed (id={0})", SessionStoreId);
        }
        catch (Exception ex)
        {
            _logger.Warn("Soft-close final persist failed: {0}", ex);
        }
    }

    private void EnsureInitialized()
    {
        if (_initialized) return;
        throw new InvalidOperationException("TSessionStore not initialized. Use TSessionStore.CreateAsync(...)");
    }

    private void ThrowIfDisposed()
    {
        if (State == StoreState.Disposed)
            ObjectDisposedException.ThrowIf(true, nameof(TSessionStore));
    }

    private Guid SessionStoreId
    {
        get
        {
            if (_instance.SessionStoreId.HasValue)
                return _instance.SessionStoreId.Value;
            if (_sessionStoreId == Guid.Empty)
                _sessionStoreId = Guid.NewGuid();
            return _sessionStoreId;
        }
    }

    private string? Phone => _instance.GetCleanPhone();
    private long? UserId => _instance.BusinessInstance?.UserId;
    private bool IsQr => _instance.InstanceType == EInstanceType.QrLogin;

    private async Task InstantiateAsync(CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();

        if (IsQr)
        {
            try
            {
                await DelegateContextAsync(async ctx =>
                {
                    var orphanIds = await ctx.TelegramSessionStores.AsNoTracking()
                        .Where(x => x.UserId != null && x.UserId == UserId && x.PhoneNumber == null && x.TSessionId == null)
                        .Select(x => x.Id)
                        .ToListAsync();

                    if (orphanIds.Count > 0)
                    {
                        ctx.TelegramSessionStores.Where(x => orphanIds.Contains(x.Id)).ExecuteDelete();
                        _logger.Warn("Deleted orphan telegram session stores (userId={0}): {1}",
                            UserId, string.Join(", ", orphanIds));
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.Warn("QR cleanup failed: {0}", ex);
            }
        }

        ct.ThrowIfCancellationRequested();

        try
        {
            var store = await DelegateContextAsync(async ctx =>
            {
                if (IsQr)
                {
                    if (_instance.SessionStoreId.HasValue)
                        return await ctx.TelegramSessionStores.FirstOrDefaultAsync(x => x.Id == _instance.SessionStoreId.Value);
                    return null;
                }
                return await ctx.TelegramSessionStores.FirstOrDefaultAsync(x => x.PhoneNumber == Phone);
            });

            if (store != null)
            {
                _instance.SetSessionStoreId(store.Id);
                _sessionData = store.Session ?? [];
                _dataLength = _sessionData.Length;
                _position = 0;
                _isExisting = true;
                _logger.Info("Loaded existing session store id={0} (qr={1})", store.Id, IsQr);
            }
        }
        catch (Exception ex)
        {
            _logger.Warn("Load existing session store failed: {0}", ex);
        }

        ct.ThrowIfCancellationRequested();

        if (!_isExisting)
        {
            try
            {
                var newStore = new TelegramSessionStore
                {
                    Id = SessionStoreId,
                    PhoneNumber = Phone,
                    InstanceId = _instance.InstanceId,
                    UserId = _instance.BusinessInstance?.UserId,
                    LastModifiedOn = DateTime.UtcNow,
                    Session = []
                };

                await DelegateContextAsync(async ctx =>
                {
                    ctx.TelegramSessionStores.Add(newStore);
                    await ctx.SaveChangesAsync();
                });

                _instance.SetSessionStoreId(newStore.Id);
                _dataLength = 0;
                _position = 0;
                _logger.Info("Created new session store id={0}", newStore.Id);

                _actions?.OnInserted?.Invoke(newStore.Id);
                if (_actions?.OnInsertedAsync != null)
                    await _actions.OnInsertedAsync(newStore.Id);
            }
            catch (Exception ex)
            {
                _logger.Error("Create session store failed: {0}", ex);
                throw new InvalidOperationException("Failed to create Telegram session store.", ex);
            }
        }
    }

    public override void Write(byte[] buffer, int offset, int count)
    {
        EnsureInitialized();
        ThrowIfDisposed();
        var state = State;
        if (state == StoreState.SoftClosed)
        {
            if (Interlocked.Exchange(ref _softCloseWriteLogFlag, 1) == 0)
                _logger.Info("Write ignored: store soft-closed (id={0})", SessionStoreId);
            return;
        }

        ArgumentNullException.ThrowIfNull(buffer);
        if (offset < 0 || count < 0 || offset + count > buffer.Length)
            throw new ArgumentOutOfRangeException(nameof(offset), $"Invalid offset/count (offset={offset}, count={count}, len={buffer.Length})");

        lock (_writeLock)
        {
            EnsureCapacityForWrite(_position + count);

            Buffer.BlockCopy(buffer, offset, _sessionData, (int)_position, count);
            _position += count;
            if (_position > _dataLength)
                _dataLength = (int)_position;

            _lastPersistAttemptUtc = DateTime.UtcNow;

            SchedulePersistLocked();
        }
    }

    private void SchedulePersistLocked()
    {
        _debounceCts?.Cancel();
        _debounceCts = new CancellationTokenSource();
        var cts = _debounceCts;

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(PersistDebounce, cts.Token).ConfigureAwait(false);
                await PersistAsync().ConfigureAwait(false);
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                _logger.Error("Debounced persist task failed: {0}", ex);
            }
        });
    }

    private void EnsureCapacityForWrite(long requiredLength)
    {
        if (requiredLength <= _sessionData.Length) return;
        var newLen = Math.Max(requiredLength, Math.Max(64, _sessionData.Length * 2L));
        var newArr = GC.AllocateUninitializedArray<byte>((int)newLen);
        if (_dataLength > 0)
            Buffer.BlockCopy(_sessionData, 0, newArr, 0, _dataLength);
        _sessionData = newArr;
    }

    public override void Flush()
    {
        EnsureInitialized();
        ThrowIfDisposed();
        if (State == StoreState.SoftClosed)
            return; // final persist already attempted in soft-close
        try
        {
            ForcePersist().ConfigureAwait(false).GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            _logger.Warn("Flush persist failed: {0}", ex);
        }
    }

    private Task ForcePersist()
    {
        CancellationTokenSource? toCancel;
        lock (_writeLock)
        {
            toCancel = _debounceCts;
            _debounceCts = null;
        }
        toCancel?.Cancel();
        return PersistAsync(skipIfUnchanged: false);
    }

    private async Task PersistAsync(bool skipIfUnchanged = true)
    {
        if (State == StoreState.Disposed)
            return;

        byte[] snapshot;
        DateTime requestedUtc;

        lock (_writeLock)
        {
            if (skipIfUnchanged && _dataLength == 0 && !_isExisting)
                return;

            snapshot = GC.AllocateUninitializedArray<byte>(_dataLength);
            if (_dataLength > 0)
                Buffer.BlockCopy(_sessionData, 0, snapshot, 0, _dataLength);

            requestedUtc = _lastPersistAttemptUtc;
        }

        if (!await _persistGate.WaitAsync(TimeSpan.FromSeconds(5)).ConfigureAwait(false))
        {
            _instance.BusinessInstance?.Logger?.Warn("SessionStore persist gate timeout");
            return;
        }

        try
        {
            await DelegateContextAsync(async ctx =>
            {
                var store = await ctx.TelegramSessionStores
                    .FirstOrDefaultAsync(x => x.Id == SessionStoreId);

                if (store == null)
                    return;

                if (store.LastModifiedOn > requestedUtc)
                    return;

                store.Session = snapshot;
                store.LastModifiedOn = DateTime.UtcNow;
                await ctx.SaveChangesAsync();

            }).ConfigureAwait(false);

            var a = _actions;
            a?.OnWriteUpdated?.Invoke();
            if (a?.OnWriteUpdatedAsync != null)
                await a.OnWriteUpdatedAsync().ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _instance.BusinessInstance?.Logger?.Error("Session persist error: {0}", ex.ToString());
        }
        finally
        {
            _persistGate.Release();
        }
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        EnsureInitialized();
        ThrowIfDisposed();
        ArgumentNullException.ThrowIfNull(buffer);
        if (offset < 0 || count < 0 || offset + count > buffer.Length)
            throw new ArgumentOutOfRangeException(nameof(offset));

        lock (_writeLock)
        {
            if (_position >= _dataLength)
                return 0;

            var remaining = _dataLength - (int)_position;
            var toCopy = Math.Min(count, remaining);
            if (toCopy > 0)
            {
                Buffer.BlockCopy(_sessionData, (int)_position, buffer, offset, toCopy);
                _position += toCopy;
            }
            return toCopy;
        }
    }

    public override long Length
    {
        get
        {
            EnsureInitialized();
            ThrowIfDisposed();
            lock (_writeLock) return _dataLength;
        }
    }

    public override long Position
    {
        get
        {
            EnsureInitialized();
            ThrowIfDisposed();
            lock (_writeLock) return _position;
        }
        set
        {
            EnsureInitialized();
            ThrowIfDisposed();
            ArgumentOutOfRangeException.ThrowIfNegative(value);
            lock (_writeLock)
            {
                _position = value > _dataLength ? _dataLength : value;
            }
        }
    }

    public override bool CanSeek => true;
    public override bool CanRead => State != StoreState.Disposed;
    public override bool CanWrite => State == StoreState.Active;

    public override long Seek(long offset, SeekOrigin origin)
    {
        EnsureInitialized();
        ThrowIfDisposed();
        lock (_writeLock)
        {
            long newPos = origin switch
            {
                SeekOrigin.Begin => offset,
                SeekOrigin.Current => _position + offset,
                SeekOrigin.End => _dataLength + offset,
                _ => throw new ArgumentOutOfRangeException(nameof(origin))
            };
            if (newPos < 0) throw new IOException("Attempted to seek before beginning.");
            _position = newPos > _dataLength ? _dataLength : newPos;
            return _position;
        }
    }

    public override void SetLength(long value)
    {
        EnsureInitialized();
        ThrowIfDisposed();
        if (State == StoreState.SoftClosed)
        {
            if (Interlocked.Exchange(ref _softCloseWriteLogFlag, 1) == 0)
                _logger.Info("SetLength ignored: store soft-closed (id={0})", SessionStoreId);
            return;
        }

        if (value < 0 || value > int.MaxValue)
            throw new ArgumentOutOfRangeException(nameof(value));

        lock (_writeLock)
        {
            var newLen = (int)value;
            if (newLen == _dataLength)
                return;

            if (newLen == 0)
            {
                _sessionData = [];
                _dataLength = 0;
                _position = 0;
                _lastPersistAttemptUtc = DateTime.UtcNow;
                SchedulePersistLocked();
                return;
            }

            var newArr = GC.AllocateUninitializedArray<byte>(newLen);
            if (_dataLength > 0)
            {
                var toCopy = Math.Min(_dataLength, newLen);
                if (toCopy > 0)
                    Buffer.BlockCopy(_sessionData, 0, newArr, 0, toCopy);
                if (newLen > _dataLength)
                    Array.Clear(newArr, _dataLength, newLen - _dataLength);
            }
            _sessionData = newArr;
            _dataLength = newLen;
            if (_position > newLen) _position = newLen;
            _lastPersistAttemptUtc = DateTime.UtcNow;
            SchedulePersistLocked();
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (!disposing)
        {
            base.Dispose(disposing);
            return;
        }

        // Fast path: if already Disposed, exit.
        if ((StoreState)Volatile.Read(ref _state) == StoreState.Disposed)
        {
            base.Dispose(disposing);
            return;
        }

        // Flush (only if still Active) BEFORE marking Disposed so Flush won't see Disposed state.
        var current = (StoreState)Volatile.Read(ref _state);
        if (_initialized && current == StoreState.Active)
        {
            try
            {
                // Direct force persist instead of Flush() to avoid debounce + extra checks.
                ForcePersist().ConfigureAwait(false).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                _logger.Warn("Dispose flush failed: {0}", ex);
            }
        }

        // Atomically mark Disposed (another thread could have raced and disposed already).
        var prev = (StoreState)Interlocked.Exchange(ref _state, (int)StoreState.Disposed);
        if (prev == StoreState.Disposed)
        {
            base.Dispose(disposing);
            return;
        }

        try
        {
            _debounceCts?.Cancel();
            _debounceCts?.Dispose();
            _persistGate.Dispose();
        }
        catch (Exception ex)
        {
            _logger.Warn("Dispose error: {0}", ex);
        }

        base.Dispose(disposing);
    }
}

