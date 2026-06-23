using Library.Helpers;
using Library.Models;
using Library.Services;
using Localize.Helper.Extensions.Helpers;
using Localize.Logger;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Data;
using TelegramEngine.Helpers;
using TelegramEngine.Logics;
using TelegramEngine.Models;
using TelegramEngine.Telegrams;
using TelegramEngine.Telegrams.Enums;
using static TelegramEngine.Helpers.TLoginHelper;

namespace TelegramEngine.Services
{
    public interface ITelegramService
    {
        TInstance Instance { get; }

        // Enterprise: exposed so phone/QR services can read the bound session without casting to the concrete type.
        // SaaS (TODO): TSession was resolved lazily by tenant context; keep this in the interface when reverting.
        TelegramSession? TSession { get; }

        //string CloudDir { get; }

        Task<List<TelegramSessionContact>?> LoadContactsAsync(long sessionId);
        Task<TelegramContact?> RefreshContactAsync(long contactId);
        Task<TelegramStatus> SyncProfilePhotoAsync(TelegramSessionContact contact);
        Task<TelegramStatus> InitInstanceAsync();
        Task<TelegramStatus> SyncProfilePhotoAsync(string contactInfo, bool force = false);
        Task<TelegramStatus> InitInstanceAsync(string phoneNumber, long userId, string groupName);
        Task OnAuthRestartAsync(long? sessionId = null);
        TelegramSession CurrentSession(long sessionId);
    }

    internal class TelegramService : ITelegramService
    {
        // Rollback: original minute-based flood delay style
        private static float FloodDelayMinutes => 10f;

        private readonly LocalizeLogger<TelegramService> _logger = new();
        private readonly Lazy<ITelegramContactService>? _contactService;
        //private readonly TenantObject _tenantObject;

        public TelegramService(/*ITenantUtility tenantUtility,*/
            ILocalizeLogger<TelegramService> logger,
            Lazy<ITelegramContactService> contactService)
        {
            _logger = (logger as LocalizeLogger<TelegramService>)!;
            _contactService = contactService;
            //_tenantObject = tenantUtility.Tenant;
        }

        public TelegramService(/*TenantObject tenantObject*/)
        {
            //_tenantObject = tenantObject
            //    ?? new TenantUtility(new HttpContextAccessor()).Tenant;
        }

        private TelegramSession _tSession = null!;
        //private string? _cloudDir;

        public TInstance Instance { get; private set; } = null!;

        // Enterprise: TSession is set explicitly via CurrentSession(sessionId) before each operation.
        // SaaS (TODO): restore the lazy tenant-scoped property below when reverting to multi-tenant model:
        //   public TelegramSession? TSession => _tSession ??= <TelegramSessionBusiness-tenant-lookup>;
        public TelegramSession? TSession => _tSession;

        private static TelegramStateEvents Events
            => DelegateScope<TelegramInstances, TelegramStateEvents>(svc => svc.Options.StateEvents);

        public TelegramSession CurrentSession(long sessionId)
        {
            if (_tSession != null && _tSession.Id == sessionId)
                return _tSession;

            return _tSession = DelegateScope<TelegramContext, TelegramSession>(ctx =>
                ctx.TelegramSessions
                .AsNoTracking()
                .FirstOrDefault(x => x.Id == sessionId)!);
        }

        //public TelegramSession TSession => _tSession ??= DelegateScope<TelegramContext, TelegramSession>(ctx =>
        //    ctx.TelegramSessions
        //    .AsNoTracking()
        //    .FirstOrDefault(x => x.SessionBusinesses.Any(b => /*b.BusinessId == _tenantObject.BusinessId &&*/ b.IsActive))!);

        //public string? CloudDir => _cloudDir ??= DelegateScope<TelegramContext, string?>(ctx =>
        //    ctx.TelegramSessionBusiness
        //    .AsNoTracking()
        //    .FirstOrDefault(x => /*x.BusinessId == _tenantObject.BusinessId*/ true)?.CloudDir);

        #region Init / Instance

        public async Task<TelegramStatus> InitInstanceAsync()
        {
            var interceptor = InitIntercept(null);
            if (interceptor != null) return interceptor;

            Instance = await DelegateScope<TelegramInstances, Task<TInstance>>(svc =>
                svc.CreateInstance(/*_tenantObject, */TSession?.Id, TSession?.PhoneNumber));

            return new(ETelegramStatus.Valid);
        }

        public async Task<TelegramStatus> InitInstanceAsync(string? phoneNumber, long userId, string groupName)
        {
            var interceptor = InitIntercept(phoneNumber);
            if (interceptor != null) return interceptor;

            phoneNumber = phoneNumber?.NoSpecialCharsAndSpaces();
            var session = await DelegateContextAsync(ctx => ctx.TelegramSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.PhoneNumber == phoneNumber));

            Instance = await DelegateScope<TelegramInstances, Task<TInstance>>(svc => svc.CreatePhoneInstance(
                //_tenantObject,
                userId,
                groupName,
                phoneNumber,
                session?.Id));

            return new(ETelegramStatus.Valid);
        }

        private TelegramStatus? InitIntercept(string? phoneNumber)
        {
            if (phoneNumber == null && TSession == null)
            {
                return new()
                {
                    Status = ETelegramStatus.Unconfigured,
                    Message = "There is no telegram account configured!"
                };
            }
            return null;
        }

        #endregion

        #region Profile Photos

        public async Task<TelegramStatus> SyncProfilePhotoAsync(TelegramSessionContact contact)
        {
            if (contact?.TelegramContact == null)
                return new() { Status = ETelegramStatus.UnknownError, Message = "Invalid contact." };

            // Enterprise: bind to the session that owns this contact so InitInstanceAsync picks the right client.
            // SaaS (TODO): TSession was already set by the tenant context — remove this line when reverting.
            CurrentSession(contact.TSessionId);

            try
            {
                return await DelegateContextAsync(async ctx =>
                {
                    var existingPhoto = await ctx.TelegramContacts
                        .AsNoTracking()
                        .FirstOrDefaultAsync(x =>
                            x.Id != contact.TelegramContact.Id &&
                            x.TContactId == contact.TelegramContact.TContactId &&
                            x.ProfilePhoto != null);

                    if (existingPhoto != null)
                    {
                        AssignProfilePhoto(ctx, contact.TelegramContact, existingPhoto.ProfilePhoto);
                        return new()
                        {
                            Status = ETelegramStatus.Valid,
                            CheckState = ETelegramCheckState.Normal,
                            Data = existingPhoto?.ProfilePhoto ?? string.Empty
                        };
                    }

                    await TRateLimitHelper.LimitAsync(2.5, TSession!.Id);
                    var contactInfo = contact.TelegramContact.TContactId.ToString();
                    return await SyncProfilePhotoAsync(contactInfo);
                });
            }
            catch (Exception ex)
            {
                _logger.Error("SyncProfilePhotoAsync error: {0}", ex.Message);
                return new(ETelegramStatus.UnknownError, ex.Message);
            }
        }

        public async Task<TelegramStatus> SyncProfilePhotoAsync(string contactInfo, bool force = false)
        {
            var init = await InitInstanceAsync();
            if (init.Status != ETelegramStatus.Valid)
                return init;

            var contact = await _contactService!.Value.FindContactAsync(contactInfo);
            if (contact == null)
                return new(ETelegramStatus.UnknownError, "Contact not found.");

            if (!string.IsNullOrEmpty(contact.ProfilePhoto) && !force)
                return new() { Status = ETelegramStatus.Valid, Data = contact.ProfilePhoto };

            if (!force && contact.CheckState == ETelegramCheckState.PhoneNotAccupied)
                return new()
                {
                    Status = ETelegramStatus.PhoneNotOccupied,
                    CheckState = ETelegramCheckState.PhoneNotAccupied
                };

            if (contact.LastCheckStateOn != null &&
                (DateTime.UtcNow - contact.LastCheckStateOn.Value).TotalMinutes <= FloodDelayMinutes)
                return new() { Status = ETelegramStatus.FloodWaitX, CheckState = ETelegramCheckState.FloodWait };

            if (!force)
            {
                var tStatus = await DelegateContextAsync<TelegramStatus?>(async ctx =>
                {
                    var found = await ctx.TelegramContacts
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x =>
                        x.TContactId == contact.TContactId &&
                        x.ProfilePhoto != null &&
                        x.ProfilePhoto.Trim().Length > 0);

                    if (found != null)
                    {
                        await ctx.TelegramContacts
                             .Where(x => x.Id == contact.Id)
                             .ExecuteUpdateAsync(x => x
                                 .SetProperty(sx => sx.ProfilePhoto, found.ProfilePhoto)
                                 .SetProperty(sx => sx.LastUpdateOn, DateTime.UtcNow));

                        return new()
                        {
                            Status = ETelegramStatus.Valid,
                            Data = found?.ProfilePhoto ?? string.Empty
                        };
                    }
                    return null;
                });
                if (tStatus != null) return tStatus;
            }

            try
            {
                var profilePhoto = await Instance.TClient!.TryDownloadProfilePhotoAsync(contact);
                return await DelegateContextAsync<TelegramStatus>(async ctx =>
                {
                    if (profilePhoto != null)
                    {
                        var uploaded = await UploadProfilePhotoAsync(profilePhoto, contact.TContactId);
                        if (!string.IsNullOrEmpty(uploaded))
                        {
                            AssignProfilePhoto(ctx, contact, uploaded);
                            return new()
                            {
                                Status = ETelegramStatus.Valid,
                                Data = uploaded,
                                CheckState = ETelegramCheckState.Normal
                            };
                        }

                        ProfilePhotoCheckStateInterceptor(ctx, contact.TContactId, ETelegramCheckState.NoProfilePhoto);
                        return new()
                        {
                            Status = ETelegramStatus.Valid,
                            CheckState = ETelegramCheckState.NoProfilePhoto
                        };
                    }

                    ProfilePhotoCheckStateInterceptor(ctx, contact.TContactId, ETelegramCheckState.NoProfilePhoto);
                    return new()
                    {
                        Status = ETelegramStatus.Valid,
                        CheckState = ETelegramCheckState.NoProfilePhoto
                    };
                });
            }
            catch (Exception ex)
            {
                return await OnErrorHandlerAsync(ex.Message, contact.TContactId);
            }
        }

        public static async Task<string?> UploadProfilePhotoAsync(string photoSource, long contactId)
        {
            var dstFileName = $"{contactId.ToString().RemoveSpacialCharacter()}.{photoSource.GetFileExtension()}";
            var dstPath = $"@telegram/profile_photo/contacts/{dstFileName}";
            var uploaded = await DelegateScopeAsync<IGoogleCloudStorage, string?>(svc =>
                svc.UploadFileAsync(photoSource, dstPath, isPublic: true));
            await FileHelper.TryRemoveFile(photoSource);
            return uploaded;
        }

        private void AssignProfilePhoto(TelegramContext _dbContext, TelegramContact contact, string? photoUrl)
        {
            if (contact == null || photoUrl?.IsNullOrEmpty() != false) return;

            _dbContext.TelegramContacts
                .Where(x => x.TContactId == contact.TContactId)
                .ExecuteUpdate(x => x
                    .SetProperty(sx => sx.ProfilePhoto, photoUrl)
                    .SetProperty(sx => sx.LastUpdateOn, DateTime.UtcNow));

            var phone = contact.Phone?.RemoveSpecialCharacterAndSpaces();
            if (!string.IsNullOrEmpty(phone))
            {
                _dbContext.TelegramSessions
                    .Where(x => x.PhoneNumber != null && x.PhoneNumber.Replace("+", "") == phone)
                    .ExecuteUpdate(x => x.SetProperty(sx => sx.ProfilePhoto, photoUrl));

                if (TSession?.PhoneNumber.RemoveSpecialCharacterAndSpaces() == phone)
                    TSession.ProfilePhoto = photoUrl;
            }
        }

        private static void ProfilePhotoCheckStateInterceptor(TelegramContext ctx, long tContactId, ETelegramCheckState checkState)
        {
            ctx.TelegramContacts
                .Where(x => x.TContactId == tContactId)
                .ExecuteUpdate(x => x
                    .SetProperty(sx => sx.CheckState, checkState)
                    .SetProperty(sx => sx.LastCheckStateOn, _ => DateTime.UtcNow));
        }

        #endregion

        #region Error / Auth

        private async Task<TelegramStatus> OnErrorHandlerAsync(string message, long tContactId)
        {
            var status = TelegramHelper.GetErrorStatus(message);
            var checkState = ETelegramCheckState.Normal;

            switch (status)
            {
                case ETelegramStatus.AuthRestart:
                    await OnAuthRestartAsync();
                    break;
                case ETelegramStatus.PhoneNotOccupied:
                    await DelegateContextAsync(async ctx =>
                        ProfilePhotoCheckStateInterceptor(ctx, tContactId, ETelegramCheckState.PhoneNotAccupied));
                    checkState = ETelegramCheckState.PhoneNotAccupied;
                    break;
                case ETelegramStatus.FloodWaitX:
                    checkState = ETelegramCheckState.FloodWait;
                    break;
            }

            return new() { Status = status, Message = message, CheckState = checkState };
        }

        public async Task OnAuthRestartAsync(long? sessionId = null)
        {
            sessionId ??= TSession?.Id;
            if (sessionId == null) return;

            await Task.Delay(500);
            if (Instance?.TClient == null || !await Instance.TClient.IsAuthorizedAsync())
            {
                _logger.Warn("===> auth restarted for \"{0}\"", TSession?.PhoneNumber);
                await DelegateContextAsync(async ctx => await ctx.TelegramSessions
                    .Where(x => x.Id == sessionId)
                    .ExecuteUpdateAsync(x => x.SetProperty(sx => sx.AuthRestart, true)));
            }

            if (TSession != null && TSession.Id == sessionId)
            {
                TSession.AuthRestart = true;
                Events?.OnDisconnectedOrAuthRestart?.Invoke(TSession, string.Empty);
            }
        }

        private int _retryCount = 0;
        public async Task OnLostConnectionAsync()
        {
            _logger.Error("Lost connection for {0}", TSession?.PhoneNumber);
            _logger.Warn("Re-initing TClient {0} for {1}", _retryCount + 1, TSession?.PhoneNumber);
            var options = DelegateScope<TelegramInstances, TelegramOptions>(svc => svc.Options);
            var lastAuthState = await Instance.TClient!.AuthorizationStateAsync(long.Parse(TSession?.AccessHash ?? "0"));

            if (_retryCount <= 4 && lastAuthState == ETAuthorizationState.LostConnection)
            {
                _retryCount++;
                await Instance.ReinitClientAsync(options);
                await Task.Delay(2000);
                await OnLostConnectionAsync();
            }
        }

        #endregion

        #region Contacts

        // Implementations live in TelegramContactService; these delegate so existing callers need no changes.

        public Task<List<TelegramSessionContact>?> LoadContactsAsync(long sessionId)
            => _contactService!.Value.LoadContactsAsync(sessionId);

        public Task<TelegramContact?> RefreshContactAsync(long contactId)
            => _contactService!.Value.RefreshContactAsync(contactId);

        #endregion
    }
}