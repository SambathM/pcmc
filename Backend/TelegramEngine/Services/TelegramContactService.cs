using Library.Models;
using Library.Utils;
using Localize.Helper.Extensions.Helpers;
using Localize.Logger;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Data;
using TelegramEngine.Helpers;
using TelegramEngine.Logics;
using TelegramEngine.Telegrams.Enums;
using TL;
using static TelegramEngine.Helpers.TLoginHelper;

namespace TelegramEngine.Services;

public interface ITelegramContactService
{
    Task<List<TelegramSessionContact>?> LoadContactsAsync(long sessionId);
    Task<TelegramContact?> RefreshContactAsync(long contactId);
    Task<TelegramContact?> FindContactAsync(string contactInfo, bool isGroup = false);
}

internal class TelegramContactService(ITelegramService telegramService) : ITelegramContactService
{
    private static float FloodDelayMinutes => 10f;

    private readonly LocalizeLogger<TelegramContactService> _logger = new();

    private TInstance Instance => telegramService.Instance;
    private TelegramSession? TSession => telegramService.TSession;

    public async Task<List<TelegramSessionContact>?> LoadContactsAsync(long sessionId)
    {
        try
        {
            telegramService.CurrentSession(sessionId);

            var init = await telegramService.InitInstanceAsync();
            if (init.Status != ETelegramStatus.Valid)
                throw new Exception($"Failed to initialize Telegram service: {init.Message}");

            if (TSession != null && TSession.AuthRestart || TSession == null)
                throw new Exception("Load contacts, authRestart!");

            return await DelegateContextAsync(async ctx =>
            {
                if (!await ctx.TelegramSessionContacts.AnyAsync(x => x.TSessionId == TSession.Id)
                    || TSession?.LastLoadContacts == null
                    || (DateTime.UtcNow - TSession.LastLoadContacts.Value).TotalMinutes > FloodDelayMinutes)
                {
                    _logger.Info("Loading contacts from telegram server for {0}, {1}", TSession?.Id, TSession?.PhoneNumber);
                    await WriteContactsAsync(ctx);
                }

                _logger.Info("Loaded contacts from cache/db for {0}, {1}", TSession?.Id, TSession?.PhoneNumber);
                return await GetCurrentSessionContactsAsync(ctx);
            });
        }
        catch (Exception ex)
        {
            if (!ex.Message.Contains("no telegram account configured", StringComparison.OrdinalIgnoreCase))
                _logger.Error(ex.ToString());
            return null;
        }
    }

    public async Task<TelegramContact?> RefreshContactAsync(long contactId)
    {
        try
        {
            var init = await telegramService.InitInstanceAsync();
            if (init.Status != ETelegramStatus.Valid) return null;

            // Bypass flood-delay guard: call WriteContactsAsync directly.
            // WriteContactsAsync has its own internal flood protection via API response status.
            await DelegateContextAsync(async ctx => await WriteContactsAsync(ctx));

            return await DelegateContextAsync(ctx =>
                ctx.TelegramContacts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == contactId));
        }
        catch (Exception ex)
        {
            _logger.Error("RefreshContactAsync error for contactId={0}: {1}", contactId, ex.Message);
            return null;
        }
    }

    public async Task<TelegramContact?> FindContactAsync(string contactInfo, bool isGroup = false)
    {
        return await DelegateContextAsync(async ctx =>
        {
            var contact = await GetLocalContactAsync(ctx, contactInfo, isGroup);
            if (contact == null && TSession != null)
            {
                await LoadContactsAsync(TSession.Id);
                contact = await GetLocalContactAsync(ctx, contactInfo, isGroup);
            }
            return contact;
        });
    }

    private async Task WriteContactsAsync(TelegramContext ctx)
    {
        var getContactList = await Instance.TClient!.TryGetAllContacts();
        if (getContactList.Status == ETelegramStatus.AuthRestart)
        {
            await telegramService.OnAuthRestartAsync(TSession?.Id);
            throw new Exception("auth_restart");
        }

        var getChatList = await Instance.TClient!.TryGetAllChats();
        if (getContactList.Status == ETelegramStatus.FloodWaitX || getChatList.Status == ETelegramStatus.FloodWaitX)
            return;

        var tlUsers = (getContactList.Data as Contacts_Contacts)?.users?
            .Where(x => x.Value.IsActive)
            .Select(x => x.Value)
            .ToList() ?? [];

        _logger.Info("Loaded contacts from telegram server for {0}, {1}, contacts: {2}",
            TSession!.Id, TSession.PhoneNumber, tlUsers.Count);

        using var tranScope = await ctx.TransactionScopeAsync();

        var contactList = await ctx.TelegramContacts
            .AsNoTracking()
            .Include(x => x.SessionContacts)
            .Where(x => x.IsGroup == null)
            .ToListAsync();

        var existingIds = contactList.Select(c => c.TContactId).ToHashSet();
        var toAdd = tlUsers
            .Where(x => !existingIds.Contains(x.id))
            .Select(x => x.OnAddNewContactMapper(TSession.Id))
            .ToList();

        if (toAdd.Count > 0)
        {
            await ctx.TelegramContacts.AddRangeAsync(toAdd);
            await ctx.SaveChangesAsync();
        }

        if (toAdd.Count > 0)
        {
            var addedExternalIds = toAdd.Select(t => t.TContactId).ToHashSet();
            contactList.AddRange([.. ctx.TelegramContacts
                .AsNoTracking()
                .Where(x => addedExternalIds.Contains(x.TContactId))]);
        }

        var sessionContacts = await GetCurrentSessionContactsAsync(ctx);
        var existingSessionExternalIds = sessionContacts
            .Select(sc => sc.TelegramContact.TContactId)
            .ToHashSet();

        var sessionChildrenToAdd = tlUsers
            .Where(x => !existingSessionExternalIds.Contains(x.id))
            .Select(x =>
            {
                var parent = contactList.First(c => c.TContactId == x.id);
                return new TelegramSessionContact
                {
                    TContactId = parent.Id,
                    FirstName = x.first_name,
                    LastName = x.last_name,
                    TSessionId = TSession.Id
                };
            })
            .ToList();

        if (sessionChildrenToAdd.Count > 0)
            await ctx.TelegramSessionContacts.AddRangeAsync(sessionChildrenToAdd);

        var toUpdate = (from tl in tlUsers
                        join local in contactList on tl.id equals local.TContactId
                        where tl.username != local.Username
                        select tl.ContactMapper(local))
                       .ToList();

        if (toUpdate.Count > 0)
            ctx.TelegramContacts.UpdateRange(toUpdate);

        await ctx.TelegramSessionContacts
             .Where(x => x.TelegramContact.IsGroup == null
                 && x.TSessionId == TSession.Id
                 && !tlUsers.Select(u => u.ID).Contains(x.TelegramContact.TContactId))
             .ExecuteDeleteAsync();

        TSession.LastLoadContacts = DateTime.UtcNow;
        ctx.TelegramSessions.Update(TSession);
        await ctx.SaveChangesAsync();

        _logger.Info("Initializing channels/groups for {0}, {1}", TSession.Id, TSession.PhoneNumber);
        await InitChatGroupChannelAsync(ctx, (getChatList.Data as Messages_Chats)?.chats, sessionContacts);

        tranScope.Complete();
    }

    private async Task InitChatGroupChannelAsync(TelegramContext ctx,
        Dictionary<long, ChatBase>? chats,
        List<TelegramSessionContact> existingSessionContacts)
    {
        if (chats == null || chats.Count == 0 || TSession == null) return;

        var localGroups = await ctx.TelegramContacts
            .AsNoTracking()
            .Where(x => x.IsGroup == true)
            .ToListAsync();

        var chatList = chats
            .Where(x => x.Value.IsGroup && x.Value.IsActive)
            .Select(x =>
            {
                x.IsChannel(out Channel? channel);
                return new
                {
                    x.Value.ID,
                    x.Value.Title,
                    x.Value.IsGroup,
                    x.Value.IsChannel,
                    channel?.access_hash,
                    channel?.username,
                    x.Value.MainUsername,
                    IsBanned = x.Value.IsBanned()
                };
            })
            .ToList();

        if (chatList.Count == 0) return;

        var existingExternalIds = localGroups.Select(g => g.TContactId).ToHashSet();

        // Detect basic-group -> supergroup migrations (Telegram sets migrated_to on the old Chat).
        // Update TelegramContact in-place so all FK references remain valid without cascade changes.
        var migrationMap = new Dictionary<long, InputChannel>();
        foreach (var pair in chats)
        {
            if (pair.Value is Chat basicGroup && basicGroup.migrated_to is InputChannel migratedChannel)
                migrationMap[pair.Value.ID] = migratedChannel;
        }

        if (migrationMap.Count > 0)
        {
            var migrationsToApply = localGroups
                .Where(g => migrationMap.ContainsKey(g.TContactId))
                .ToList();

            foreach (var local in migrationsToApply)
            {
                var oldId = local.TContactId;
                var newChannel = migrationMap[oldId];
                var freshTitle = chats.TryGetValue(newChannel.channel_id, out var cb) ? cb.Title : local.Title;

                await ctx.TelegramContacts
                    .Where(x => x.Id == local.Id)
                    .ExecuteUpdateAsync(x => x
                        .SetProperty(sx => sx.TContactId, newChannel.channel_id)
                        .SetProperty(sx => sx.AccessHash, newChannel.access_hash)
                        .SetProperty(sx => sx.IsGroup, true)
                        .SetProperty(sx => sx.Title, freshTitle)
                        .SetProperty(sx => sx.LastUpdateOn, DateTime.UtcNow));

                local.TContactId = newChannel.channel_id;
                local.AccessHash = newChannel.access_hash;
                _logger.Info("Migrated dead group {0} -> supergroup {1} ({2})", oldId, newChannel.channel_id, freshTitle);
            }

            existingExternalIds = localGroups.Select(g => g.TContactId).ToHashSet();
        }

        var toAdd = chatList
            .Where(x => !existingExternalIds.Contains(x.ID))
            .Select(x => new TelegramContact
            {
                TContactId = x.ID,
                Title = x.Title,
                IsGroup = x.IsGroup,
                AccessHash = x.access_hash,
                Username = x.username
            })
            .ToList();

        if (toAdd.Count > 0)
        {
            await ctx.TelegramContacts.AddRangeAsync(toAdd);
            await ctx.SaveChangesAsync();
        }

        if (toAdd.Count > 0)
        {
            var newIds = toAdd.Select(t => t.TContactId).ToHashSet();
            var tContactList = await ctx.TelegramContacts
                .AsNoTracking()
                .Where(x => newIds.Contains(x.TContactId) && x.IsGroup == true)
                .ToListAsync();

            localGroups.AddRange(tContactList);
        }

        var sessionGroupExternalIds = existingSessionContacts
            .Where(sc => sc.TelegramContact?.IsGroup == true)
            .Select(sc => sc.TelegramContact.TContactId)
            .ToHashSet();

        var sessionContactsToAdd = chatList
            .Where(c => !sessionGroupExternalIds.Contains(c.ID))
            .Join(localGroups, c => c.ID, g => g.TContactId, (c, g) => new TelegramSessionContact
            {
                TContactId = g.Id,
                TSessionId = TSession.Id,
                FirstName = c.Title
            })
            .ToList();

        if (sessionContactsToAdd.Count > 0)
            await ctx.TelegramSessionContacts.AddRangeAsync(sessionContactsToAdd);

        var toUpdate = (from c in chatList
                        join g in localGroups on c.ID equals g.TContactId
                        where g.Title != c.Title || g.AccessHash != c.access_hash
                        select g).ToList();

        if (toUpdate.Count > 0)
        {
            toUpdate.ForEach(g =>
            {
                var fresh = chatList.First(c => c.ID == g.TContactId);
                g.Title = fresh.Title;
                g.AccessHash = fresh.access_hash;
            });
            ctx.TelegramContacts.UpdateRange(toUpdate);
        }

        await ctx.SaveChangesAsync();
    }

    private static async Task<TelegramContact?> GetLocalContactAsync(TelegramContext ctx, object contactInfo, bool isGroup = false)
    {
        if (contactInfo == null) return null;
        var infoString = $"{contactInfo}".RemoveSpecialCharacterAndSpaces();
        if (string.IsNullOrEmpty(infoString)) return null;

        if (isGroup && long.TryParse(infoString, out var tContactIdGroup))
        {
            return await ctx.TelegramContacts
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.IsGroup != null && x.TContactId == tContactIdGroup);
        }

        return await ctx.TelegramContacts
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.Phone != null && x.Phone.Replace(" ", "").Replace("+", "") == infoString ||
                x.TContactId.ToString() == infoString ||
                x.Username != null && x.Username.Replace("@", "") == infoString);
    }

    private Task<List<TelegramSessionContact>> GetCurrentSessionContactsAsync(TelegramContext ctx)
        => ctx.TelegramSessionContacts
            .AsNoTracking()
            .Include(x => x.TelegramContact)
            .Where(x => x.TSessionId == TSession!.Id)
            .ToListAsync();
}
