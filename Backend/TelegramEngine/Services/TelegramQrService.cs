using Library;
using Library.Services;
using Localize.Logger;
using TelegramEngine.Contracts;
using TelegramEngine.Helpers;
using TelegramEngine.Logics;
using TelegramEngine.Telegrams;
using TelegramEngine.Telegrams.Enums;

namespace TelegramEngine.Services
{
    public interface ITelegramQrService
    {
        Task<TgQrCodeResponse> GetQrAsync();
        RequestResponse InputQrCodePassword(string password, string instanceId);
    }

    public class TelegramQrService(/*ITenantUtility tenantUtility,*/
        AppSettings appSettings,
        IWebService webService,
        ILocalizeLogger<TelegramQrService> logger,
        TelegramInstances telegramInstances
        ) : ITelegramQrService
    {
        //private TenantObject _tenantObject;
        private TInstance? Instance;

        //TenantObject TenantObject
        //    => _tenantObject ??= tenantUtility.Tenant;

        /// <summary>
        /// Gets the QR code asynchronously from the Telegram instance.
        /// </summary>
        /// <returns>The QR code as a string.</returns>
        public async Task<TgQrCodeResponse> GetQrAsync()
        {
            // Multi-session: always start a fresh QR login instance. We must NOT short-circuit
            // with "already logged in" based on some other active session — each QR scan is a
            // distinct new-account attempt, identified by its own InstanceId until a session is bound.
            await InitInstanceAsync();

            if (Instance == null)
                throw new Exception("Telegram instance is not initialized.");

            Instance.OnTimeout = OnTimeout;
            // Perform login with QR code asynchronously and provide the event handler
            await Instance.DoLoginQRCodeAsync(TLoginHelper.OnTlgLoggedInWorker,
                OnQrCodeChange,
                OnPasswordState);

            // Return the QR code from the Telegram instance
            return new TgQrCodeResponse()
            {
                Status = ETelegramStatus.Valid,
                InstanceId = Instance.InstanceId,
                QrCode = Instance.QrCode!,
            };
        }

        public RequestResponse InputQrCodePassword(string password, string instanceId)
        {
            var instance = telegramInstances.GetByInstanceId(instanceId);
            if (instance != null)
            {
                instance?.TClient?.InputPasswordForQrLogin(password);
                return new RequestResponse(true, "Password input successfully.");
            }
            return new RequestResponse(false, "Instance not found.");
        }

        void OnTimeout(TInstance instance)
        {
            TLoginHelper.TryNotifyToClient(instance.BusinessInstance.GetSignalRClientId(),
                TSignalRMethod.OnTlgQrTimeout, new { instance.InstanceId });
        }

        async Task OnPasswordState(string state)
        {
            if (state == "password_max_attempts")
            {
                // max password attempts reached
                // dispose current instance
                if (Instance != null)
                {
                    await Instance.DisposeAsync();
                }
            }

            logger.Warn("==> password needed callback invoked");
            //notify to client about password state
            if (Instance != null)
            {
                TLoginHelper.TryNotifyToClient(Instance.BusinessInstance.GetSignalRClientId(),
                    TSignalRMethod.OnPasswordState, new { state, Instance.InstanceId });
            }
        }

        void OnQrCodeChange(TInstance instance)
        {
            //send notification to accounting server
            TLoginHelper.TryNotifyToClient(instance.BusinessInstance.GetSignalRClientId(),
                TSignalRMethod.OnTlgQrChange, new { qrCode = instance.QrCode, instance.InstanceId });
        }

        private async Task<TelegramStatus> InitInstanceAsync()
        {
            // Multi-session model: do NOT check for an existing active session here.
            // CreateQRInstance already disposes any prior in-flight login instance for this user,
            // so a new QR attempt always gets a clean instance with its own InstanceId.
            Instance =
                await telegramInstances.CreateQRInstance(/*TenantObject, */
                    webService.CurrentUserId,
                    appSettings.SignalR.DefaultGroupName);

            return new(ETelegramStatus.Valid);
        }

    }
}
