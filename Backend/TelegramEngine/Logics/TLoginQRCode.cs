using Localize.Logger;
using System.Diagnostics;
using TelegramEngine.Helpers;
using TelegramEngine.Models;
using TelegramEngine.Telegrams.Enums;

namespace TelegramEngine.Logics;

internal static class TLoginQRCode
{
    private static readonly LocalizeLogger logger = new(typeof(TLoginQRCode));
    public static async Task<object> DoLoginQRCodeAsync(this TInstance instance,
        Action<OnActionContext> onAction,
        Action<TInstance> onQrChange,
        Func<string, Task> onPasswordState)
    {
        var qrCodeAvailable = new TaskCompletionSource<bool>();

        TaskLoginQRCode(instance, onAction, onQrChange, onPasswordState, qrCodeAvailable);

        // Wait for the QR code to be set by the Telegram client instance
        await qrCodeAvailable.Task;

        return instance;
    }

    private static void TaskLoginQRCode(TInstance instance,
        Action<OnActionContext> onAction,
        Action<TInstance> onQrChange,
        Func<string, Task> onPasswordState,
        TaskCompletionSource<bool> qrCodeAvailable)
    {
        Task.Run(async () =>
        {
            using var ctSource = new CancellationTokenSource();
            instance.Cts = ctSource;
            //var startTime = DateTime.UtcNow;
            var stopWatch = new Stopwatch();

            if (instance.TClient == null)
            {
                instance.SetStatus(ETelegramStatus.Timeout);
                return;
            }

            stopWatch.Start();

            bool IsTimeout() => stopWatch.Elapsed.TotalMinutes > 5;

            try
            {
                var loginTask = instance.TClient.LoginWithQRCode(
                    (qrCode) =>
                    {
                        if (instance.QrCode != null && qrCode != instance.QrCode)
                        {
                            onQrChange(instance);
                            logger.Info("==> QR code changed to {0}", qrCode);
                        }

                        instance.SetQrCode(qrCode);
                        qrCodeAvailable.TrySetResult(true); // Signal that QR code is available
                    },
                    onPasswordState: async (state) =>
                    {
                        await onPasswordState(state);
                        logger.Info("===> Password state: {0}!", state);

                    },
                    ct: ctSource.Token
                );

                // Wait for the login task to complete or timeout
                while (!loginTask.IsCompleted && !IsTimeout())
                {
                    await Task.Delay(750, ctSource.Token);
                }

                if (IsTimeout())
                {
                    ctSource.Cancel();
                    instance.SetStatus(ETelegramStatus.Timeout);
                }
                else
                {
                    // await (not .Result) so a faulted/cancelled task throws the inner exception
                    // directly instead of an AggregateException we can't classify.
                    var user = await loginTask;
                    if (user != null)
                    {
                        instance.SetStatus(ETelegramStatus.Valid);
                        instance.SetActionMode();
                        instance.SetPhone(user.phone);
                        await instance.OnTlgLoggedInActionAsync(user, onAction);
                        logger.Success("==> Successfully logged in QR, phone: {0}", user.phone);
                    }
                    else
                    {
                        instance.SetStatus(ETelegramStatus.UnknownError);
                    }
                }
            }
            catch (Exception ex) when (instance.IsDisposed || ctSource.IsCancellationRequested)
            {
                // Expected when this attempt is superseded by a newer login or the instance was
                // disposed mid-flight (e.g. re-logging an account that already had a live client).
                // The client gets torn down, so LoginWithQRCode surfaces "You must connect to
                // Telegram first" — that is not a real login failure, so don't alarm-log it.
                logger.Info("==> QR login attempt aborted (superseded/disposed): {0}", ex.Message);
            }
            catch (Exception ex)
            {
                // Handle any unexpected exceptions that occur during the login process
                logger.Error($"An error occurred during login: {ex.Message}");
                instance.SetStatus(ETelegramStatus.UnknownError);
            }
            finally
            {
                stopWatch.Stop();
                instance.SetLastUpdate();
            }
        });
    }
}
