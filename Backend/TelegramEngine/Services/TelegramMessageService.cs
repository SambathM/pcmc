using Library.Helpers;
using Library.Http;
using Library.Models;
using Localize.Helper.Extensions;
using Localize.Logger;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Helpers;
using TelegramEngine.Logics;
using TelegramEngine.Telegrams;
using TelegramEngine.Telegrams.Enums;
using TL;

namespace TelegramEngine.Services;

public interface ITelegramMessageService
{
    Task<TelegramMessage[]> SendFileMessagesAsync(TelegramMessage[] telegramMessages, TelegramEvents? events = null);
}

public class TelegramMessageService(ITelegramService telegramService,
    TelegramInstances telegramInstances) : ITelegramMessageService
{
    private readonly TelegramService? telegramService = telegramService as TelegramService;
    private string? filePathToSend;
    private TelegramEvents? telegramEvents;
    private static readonly LocalizeLogger<TelegramMessageService> logger = new();

    //public TelegramMessageService(TenantObject tenantObject)
    //{
    //    telegramService = new(tenantObject);
    //}

    public async Task<TelegramMessage[]> SendFileMessagesAsync(TelegramMessage[] telegramMessages, TelegramEvents? events = null)
    {
        telegramEvents = events;

        if (telegramService == null)
            throw new Exception("Telegram service is not available");

        // Initialize the Telegram service instance
        var initResult = await telegramService.InitInstanceAsync();
        if (initResult.Status != ETelegramStatus.Valid)
            throw new Exception($"Failed to initialize Telegram service: {initResult.Message}");

        foreach (var message in telegramMessages)
        {
            try
            {
                if (telegramService.Instance.TSessionId == null)
                    throw new Exception("Telegram session is not initialized");

                telegramService.Instance.SetLastUpdate();
                message.TSessionId = telegramService.Instance.TSessionId.Value;
                filePathToSend = await HandlerFileToSendAsync(message);
                var inputFile = await HandleMessageInputFileAsync();

                if (inputFile == null)
                {
                    OnSendMessageFailure(message, "Unable to upload file to Telegram Server");
                    continue;
                }

                // Send the message to each contact
                var contactList = await TLoginHelper.DelegateContextAsync(ctx => ctx.TelegramContacts.AsNoTracking()
                    .Where(x => message.ContactIds.Contains(x.Id))
                    .ToListAsync());

                message.IsSent = false;
                TL.Message? msgSent = null;

                if (telegramService.Instance.TClient == null)
                    throw new Exception("Telegram client is not initialized");

                foreach (var contact in contactList)
                {
                    telegramService.Instance.SetLastUpdate();
                    var contactState = message.ContactStates.FirstOrDefault(x => x.ContactId == contact.Id);

                    if (!message.IsSent)
                    {
                        msgSent = await HandleSendMessageAsync(contact, message, inputFile);
                        message.IsSent = msgSent != null;
                        if (contactState != null)
                            contactState.IsSent = message.IsSent;
                    }
                    else if (msgSent != null)
                    {
                        var forward =
                            await telegramService.Instance.TClient
                                .TryForwardMessages(
                                contact.InputPeer(),
                                [msgSent.id],
                                contact.InputPeer());

                        // Forward the message if it has already been sent
                        if (forward == null)
                        {
                            logger.Info("[]==> Failed to forward message to contact {0}", contact.Id);
                        }
                    }
                }

                if (!message.IsSent)
                {
                    OnSendMessageFailure(message, "Unable to send message to customers");
                    continue;
                }

                message.IsSent = true;
                telegramEvents?.OnSentHandler?.Invoke(message);
                await Task.Delay(1500);
            }
            catch (Exception ex)
            {
                OnSendMessageFailure(message, ex.ToString());
            }
            finally
            {
                if (!string.IsNullOrWhiteSpace(filePathToSend))
                    await FileHelper.TryRemoveFile(filePathToSend);
            }
        }

        return telegramMessages;
    }


    private async Task<TL.Message?> HandleSendMessageAsync(TelegramContact contact, TelegramMessage message, InputFileBase inputFile)
    {
        if (telegramService?.Instance.TClient == null)
            throw new Exception("Telegram client is not initialized");

        // currentContact is a local variable captured by both lambdas below.
        // On a peer error, RefreshContactAsync updates TContactId/AccessHash in the DB and we
        // swap currentContact for the refreshed row — the next iteration picks up the new InputPeer.
        TelegramContact currentContact = contact;

        for (int peerRefresh = 0; peerRefresh <= 1; peerRefresh++)
        {
            try
            {
                return await Worker.RetryAsync(async () =>
                    await telegramService.Instance.TClient.SendMediaAsync(currentContact.InputPeer(), message.Caption, inputFile, message.ContentType)
                        ?? throw new InvalidOperationException(),
                    new(async (attempts, ex) =>
                    {
                        logger.Info("[]==> Retrying to send message to Telegram Server ({0})", attempts);
                        await telegramService.Instance.ReinitClientAsync(telegramInstances.Options);
                    }));
            }
            catch (Exception ex) when (IsPeerError(ex) && peerRefresh == 0)
            {
                logger.Info("[]==> Peer error for contact {0} ({1}), refreshing from Telegram", contact.Id, ex.Message);
                var refreshed = await telegramService.RefreshContactAsync(contact.Id);
                if (refreshed != null) currentContact = refreshed;
            }
        }

        return null;
    }

    private static bool IsPeerError(Exception ex)
    {
        var text = ex.ToString().ToUpperInvariant();
        return text.Contains("CHANNEL_INVALID") ||
               text.Contains("CHAT_ID_INVALID") ||
               text.Contains("PEER_ID_INVALID") ||
               text.Contains("USER_ID_INVALID");
    }


    private void OnSendMessageFailure(TelegramMessage message, string reason)
    {
        message.IsSent = false;
        message.Reason = reason;

        //invoke on failed event
        if (telegramEvents?.OnFailedHandler != null)
        {
            telegramEvents.OnFailedHandler.Invoke(message);
        }
    }

    private async Task<InputFileBase?> HandleMessageInputFileAsync()
    {
        if (telegramService?.Instance.TClient == null)
            throw new Exception("Telegram client is not initialized");

        if (string.IsNullOrWhiteSpace(filePathToSend))
            throw new ArgumentException("File path to send cannot be null or empty", nameof(filePathToSend));

        // Upload the file to Telegram with retry logic
        return await Worker.RetryAsync(async () => await telegramService.Instance.TClient.TryToUploadFileAsync(filePathToSend)
                ?? throw new InvalidOperationException(),
            new(async (attempts, ex) =>
            {
                logger.Info("[]==> Retrying to upload file to Telegram Server ({0})", attempts);
                await telegramService.Instance.ReinitClientAsync(telegramInstances.Options);
            }));
    }


    private static async Task<string?> HandlerFileToSendAsync(TelegramMessage message)
    {
        // Handle file download if the path is a URL
        var filePathToSend = message.FilePath;
        if (message.FilePath?.IsURL() == true)
        {
            var downloadFilePath = Path.Combine(Path.GetTempPath(), message.FilePath.GetFileName());
            filePathToSend = await FileHelper.DownloadFileAsync(message.FilePath, downloadFilePath);
        }

        return filePathToSend;
    }

}

public class SendMessageResult
{
    public SendMessageResult(bool isSuccess) { IsSuccess = isSuccess; }
    public SendMessageResult(TelegramMessage[] messages, bool isSuccess = true)
    {
        Messages = messages;
        IsSuccess = isSuccess;
    }

    public TelegramMessage[] Messages { get; set; } = [];
    public bool IsSuccess { get; set; } = true;
}

