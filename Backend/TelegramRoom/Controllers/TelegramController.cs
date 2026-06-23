using Library;
using Library.Models;
using Library.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
using TelegramEngine.Contracts;
using TelegramEngine.Data;
using TelegramEngine.Models;
using TelegramEngine.Services;
using TelegramEngine.Telegrams;
using TelegramEngine.Telegrams.Enums;

namespace TelegramRoom.Controllers;

[Route("[controller]")]
//[Authorize]
[ApiController]
public class TelegramController(
    TelegramContext dbContext,
    ITelegramService telegramService,
    ITelegramQrService telegramQrService,
    ITelegramSessionService telegramSessionService,
    ITelegramPhoneService telegramPhoneService,
    IWebService webService,
    AppSettings appSettings) : ControllerBase
{
    [HttpGet("client-id")]
    public IActionResult GetClientId()
    {
        var clientId = $"{webService.CurrentUserId}-{appSettings.SignalR.DefaultGroupName}";
        return Ok(new { status = true, message = clientId });
    }

    [HttpGet("qrCode")]
    public async Task<TgQrCodeResponse> GetQrCode()
        => await telegramQrService.GetQrAsync();

    [HttpPost("inputQrCodePassword")]
    public RequestResponse InputQrCodePassword(JObject body)
        => telegramQrService.InputQrCodePassword(
            $"{body["password"]}",
            $"{body["instanceId"]}");

    [HttpPost("loginPhone")]
    public async Task<PhoneLoginState> LoginPhoneNew(JObject model)
        => await telegramPhoneService
            .LoginPhoneNewAsync(model["phone"]?.ToString() ?? string.Empty);

    [HttpPost("loginPhoneCode")]
    public RequestResponse LoginPhoneCode(JObject model)
        => telegramPhoneService.SetPhoneCode(model);

    [HttpPost("loginPhonePassword")]
    public RequestResponse LoginPhonePassword(JObject model)
        => telegramPhoneService.SetPassword(model);

    [HttpGet("sessions")]
    public async Task<List<TelegramSession>> GetSessions()
        => await dbContext.TelegramSessions
            .AsNoTracking()
            .OrderByDescending(x => x.LastUpdatedOn)
            .ToListAsync();

    [HttpGet("session")]
    public async Task<TelegramSession?> GetCurrentSession()
        => await telegramSessionService.GetCurrentSessionAsync();

    // Multi-session: poll the status of a SPECIFIC login attempt by its instance id.
    // Returns the authorized session bound to that instance once login completes, else null.
    [HttpGet("loginStatus/{instanceId}")]
    public async Task<TelegramSession?> GetLoginStatus(string instanceId)
        => await telegramSessionService.GetLoginStatusAsync(instanceId);

    [HttpGet("session/startup")]
    public async Task StartupSession()
        => await telegramSessionService.StartupSessionAsync();

    [HttpGet("clearSession/{phone}/{userId}")]
    public async Task ClearSession(string phone, long userId)
        => await telegramSessionService.ClearSessionAsync(phone, userId);

    [HttpGet("disconnect")]
    public async Task Disconnect()
        => await telegramSessionService.DisConnectAsync();

    [HttpGet("contacts")]
    // Enterprise: resolves contacts for the most recently active session.
    // SaaS (TODO): route through tenant context instead of GetCurrentSessionAsync when reverting.
    public async Task<List<TelegramSessionContact>?> GetTelegramContacts()
    {
        var currentSession = await telegramSessionService.GetCurrentSessionAsync();
        if (currentSession == null) return null;
        return await telegramService.LoadContactsAsync(currentSession.Id);
    }

    [HttpGet("IsAlertChangeNumber/{phoneNumber}")]
    public async Task<bool> IsAlertChangeNumber(string phoneNumber)
        => await telegramSessionService.IsAlertChangeNumberAsync(phoneNumber);

    [HttpGet("GetLastAccountTlg")]
    public async Task<TelegramSession?> GetLastAccountTlg()
    {
        return await dbContext.TelegramSessions
            .AsNoTracking()
            //.Where(x => x.SessionBusinesses.Any(y => /*y.BusinessId == tenantUtility.Tenant.BusinessId*/))
            .Where(x => x.LastLoadContacts != null)
            .OrderByDescending(x => x.LastLoadContacts)
            .FirstOrDefaultAsync();
    }

    [HttpPost("session-contact/{contactId:long}/sync-photo")]
    public async Task<TelegramStatus> SyncSessionContactPhoto(long contactId)
    {
        var contact = await dbContext.TelegramSessionContacts
            .Include(x => x.TelegramContact)
            .FirstOrDefaultAsync(x => x.Id == contactId);

        if (contact == null)
            return new TelegramStatus(ETelegramStatus.UnknownError, "Contact not found.");

        return await telegramService.SyncProfilePhotoAsync(contact);
    }

    [HttpGet("session/{sessionId:long}/contacts")]
    public async Task<IActionResult> GetSessionContacts(long sessionId)
    {
        // Populate / refresh contacts from Telegram before reading the DB.
        // LoadContactsAsync has built-in flood-delay protection so this is safe to call every time.
        try { await telegramService.LoadContactsAsync(sessionId); } catch { }

        var contacts = await dbContext.TelegramSessionContacts
            .AsNoTracking()
            .Include(x => x.TelegramContact)
            .Where(x => x.TSessionId == sessionId && x.TelegramContact.IsGroup != true)
            .Select(x => new
            {
                id = x.Id,
                firstName = x.FirstName ?? x.TelegramContact.Title,
                lastName = x.LastName,
                phone = x.TelegramContact.Phone,
                username = x.TelegramContact.Username,
                profilePhoto = x.TelegramContact.ProfilePhoto,
            })
            .ToListAsync();

        return Ok(contacts);
    }

    [HttpPost("syncProfilePhoto")]
    public async Task<TelegramStatus> SyncProfilePhotoAsync(TelegramSessionContact contact)
        => await telegramService.SyncProfilePhotoAsync(contact);

}
