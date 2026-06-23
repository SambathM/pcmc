using Library;
using Library.Models;
using Library.Services;
using Localize.Helper.Extensions.Helpers;
using Newtonsoft.Json.Linq;
using TelegramEngine.Contracts;
using TelegramEngine.Data;
using TelegramEngine.Helpers;
using TelegramEngine.Logics;
using TelegramEngine.Models;
using TelegramEngine.Telegrams;
using TelegramEngine.Telegrams.Enums;

namespace TelegramEngine.Services
{
    public interface ITelegramPhoneService
    {
        Task<PhoneLoginState> LoginPhoneNewAsync(string phone);
        RequestResponse SetPassword(JObject passwordObject);
        RequestResponse SetPhoneCode(JObject codeObject);
    }

    public class TelegramPhoneService(TelegramContext dbContext,
        //AccountContext accContext,
        AppSettings appSettings,
        IWebService webService,
        //ITenantUtility tenantUtility,
        TelegramInstances telegramInstances,
        ITelegramService telegramService) : ITelegramPhoneService
    {
        private TInstance? Instance;

        public async Task<PhoneLoginState> LoginPhoneNewAsync(string phone)
        {
            // Multi-session: the only valid "already logged in" guard is per-phone — we refuse to
            // re-login THE SAME phone that already has an authorized, healthy session. We must NOT
            // block on some other active account; each new phone is its own attempt (instance).
            if (dbContext.TelegramSessions.Any(x =>
                x.PhoneNumber != null && x.PhoneNumber.Replace("+", "") == phone.Replace("+", "") &&
                x.IsAuthorized && !x.AuthRestart))
            {
                return new() { State = (int)ELoginState.ALREADY_LOGGED_IN };
            }

            //var __company = accContext.Company.AsNoTracking().FirstOrDefault();
            //var __groupName = __company.CloudDir.Removes("dir_");

            //remove all instances with same phone and userId
            List<TInstance> instances = [.. telegramInstances.Snapshot().Where(x => x.BusinessInstance != null
                && x.BusinessInstance.GroupName == $"{webService.CurrentUserId}"
                && x.BusinessInstance.GroupName == phone)];

            foreach (TInstance x in instances)
            {
                await x.DisposeAsync();
            }

            //remove all instances with the same userId and is QR instance
            instances = [.. telegramInstances.Snapshot().Where(x => x.BusinessInstance != null
                && x.BusinessInstance.UserId == webService.CurrentUserId
                && x.SessionStoreId != null)];

            foreach (TInstance x in instances)
            {
                await x.DisposeAsync();
            }

            //init client first to request code
            TelegramStatus __init =
                await telegramService.InitInstanceAsync(
                    phone,
                    webService.CurrentUserId,
                    appSettings.SignalR.DefaultGroupName);

            if (__init.Status != ETelegramStatus.Valid)
                return new()
                {
                    State = (int)ELoginState.UNKNOWN_ERROR,
                    Message = "Failed to init Telegram service, please try again or contact our support."
                };

            // Multi-session: no global "already logged in" short-circuit here. The per-phone guard
            // above already prevents re-logging the same phone; for a genuinely new phone we always
            // proceed to request a verification code. The attempt is tracked by Instance.InstanceId.
            Instance = telegramService.Instance;
            Instance.SetPhone(phone.RemoveSpecialCharacterAndSpaces());
            await Instance.DoLoginPhoneNewAsync(TLoginHelper.OnTlgLoggedInWorker, OnLoginStateEvent);

            return new()
            {
                State = (int)ELoginState.WAIT_FOR_SERVER,
                Message = Instance.InstanceId
            };
        }


        public RequestResponse SetPhoneCode(JObject codeObject)
        {
            string __code = codeObject["code"]!.ToString();
            var __instance = telegramInstances.GetByInstanceId(codeObject["instanceId"]?.ToString());
            if (__instance == null)
                return new RequestResponse(false, "Session timeout!");

            __instance.SetPhoneCode(__code);
            return new RequestResponse(true, "Phone code set successfully.");
        }


        public RequestResponse SetPassword(JObject passwordObject)
        {
            var __password = passwordObject["password"]?.ToString();
            var __instance = telegramInstances.GetByInstanceId(passwordObject["instanceId"]?.ToString());
            if (__instance == null)
                return new RequestResponse(false, "Session timeout!");

            __instance.SetPassword(__password);
            return new RequestResponse(true, "Password set successfully.");
        }

        async Task OnLoginStateEvent(PhoneLoginState state)
        {
            if (Instance == null)
                throw new Exception("Telegram instance is not initialized.");

            //notify to only current user of this business
            TLoginHelper.TryNotifyToClient(Instance.BusinessInstance.GetSignalRClientId(), TSignalRMethod.OnTlgLoginPhone, state);

            // dispose instance if max attempts reached or invalid code entered
            switch ((ELoginState)state.State)
            {
                case ELoginState.PHONE_CODE_MAX_ATTEMPS:
                case ELoginState.FLOOD_WAIT:
                case ELoginState.SIGNUP_NEEDED:
                    await Instance.DisposeAsync();
                    break;
            }
        }

    }
}
