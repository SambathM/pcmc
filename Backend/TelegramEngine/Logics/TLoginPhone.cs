using Library.Models;
using Localize.Helper.Extensions;
using Localize.Logger;
using Newtonsoft.Json.Linq;
using TelegramEngine.Helpers;
using TelegramEngine.Models;

namespace TelegramEngine.Logics;

internal static class TLoginPhone
{
    private static readonly LocalizeLogger logger = new(typeof(TLoginPhone));

    public static async Task<TInstance> DoLoginPhoneNewAsync(
        this TInstance instance,
        Action<OnActionContext> onAction,
        Func<PhoneLoginState, Task> onLoginState)
    {
        instance.SetWhat(instance.Phone);
        StartLoginProcess(instance, onAction, onLoginState);

        while (instance.What != null)
            await Task.Delay(1000);

        return instance;
    }

    public static void SetPhoneCode(this TInstance instance, string code) => instance.SetWhat(code);

    public static void SetPassword(this TInstance instance, string? password) => instance.SetWhat(password);

    private static void StartLoginProcess(TInstance instance,
        Action<OnActionContext> onAction,
        Func<PhoneLoginState, Task> onLoginState)
    {
        instance.Cts = new CancellationTokenSource();
        var ct = instance.Cts.Token;

        Task.Run(async () =>
        {
            try
            {
                if (instance.TClient == null)
                    throw new Exception($"Instance is disposed: {instance.InstanceId}");

                while (instance.TClient?.User == null)
                {
                    ct.ThrowIfCancellationRequested();

                    if (instance.What == null)
                    {
                        await Task.Delay(1500, ct);
                        continue;
                    }

                    await instance.TClient!.Login(instance.What, state => HandleLoginState(state, onLoginState));

                    instance.SetWhat(); // Clear "What" after processing
                }

                await instance.OnTlgLoggedInActionAsync(instance.TClient!.User, onAction);
            }
            catch (Exception ex) when (instance.IsDisposed || ct.IsCancellationRequested)
            {
                // Expected when this attempt is superseded by a newer login or the instance was
                // disposed mid-flight (e.g. re-logging an account that already had a live client).
                // The client gets torn down, so Login surfaces "You must connect to Telegram first" —
                // that is not a real login failure, so don't alarm-log it.
                logger.Info("==> Phone login attempt aborted (superseded/disposed): {0}", ex.Message);
            }
            catch (Exception ex)
            {
                logger.Error("An error occurred during phone login: {0}", ex.Message);
            }
            finally
            {
                // Never leave DoLoginPhoneNewAsync (which waits on What) hanging if we exited early.
                instance.SetWhat();
            }
        }, instance.Cts?.Token ?? CancellationToken.None);
    }

    private static void HandleLoginState(object state, Func<PhoneLoginState, Task> onLoginState)
    {
        var jObject = JObject.FromObject(state);
        var loginState = new PhoneLoginState
        {
            Message = jObject["message"]?.ToString(),
            State = (int)(jObject["state"]?.ToString()?.ToEnum<ELoginState>() ?? 0)
        };

        onLoginState(loginState)
            .ConfigureAwait(false)
            .GetAwaiter()
            .GetResult();
    }
}

