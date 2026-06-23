using Library.Models;
using Library.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Data;

namespace TelegramRoom.Controllers;

[Route("[controller]")]
//[Authorize]
[ApiController]
public class PropertyController(TelegramContext dbContext, IGoogleCloudStorage storage) : ControllerBase
{
    /// <summary>
    /// GET /property — list all active properties with computed resident count, outstanding balance,
    /// and the assigned Telegram session profile.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetProperties()
    {
        var properties = await dbContext.PcmcProperties
            .AsNoTracking()
            .Include(p => p.AssignedTelegramSession)
            .Where(p => p.IsActive)
            .OrderBy(p => p.Name)
            .ToListAsync();

        var propertyIds = properties.Select(p => p.Id).ToList();

        var residentCounts = await dbContext.PcmcCustomerLocations
            .AsNoTracking()
            .Where(cl => cl.IsActive && cl.Customer!.IsActive && propertyIds.Contains(cl.LocationId))
            .GroupBy(cl => cl.LocationId)
            .Select(g => new { LocationId = g.Key, Count = g.Select(x => x.CustomerId).Distinct().Count() })
            .ToListAsync();

        var outstandingBalances = await dbContext.PcmcBills
            .AsNoTracking()
            .Where(b => b.Status != "Paid" && b.UnitRef != null && propertyIds.Contains(b.UnitRef.LocationId))
            .GroupBy(b => b.UnitRef!.LocationId)
            .Select(g => new { LocationId = g.Key, Total = g.Sum(b => b.Amount) })
            .ToListAsync();

        var residentCountMap = residentCounts.ToDictionary(x => x.LocationId, x => x.Count);
        var balanceMap = outstandingBalances.ToDictionary(x => x.LocationId, x => x.Total);

        var result = properties.Select(p => new
        {
            p.Id,
            p.Name,
            p.Code,
            p.Logo,
            p.AssignedTelegramSessionId,
            assignedTelegramSession = p.AssignedTelegramSession == null ? null : new
            {
                id = p.AssignedTelegramSession.Id,
                firstName = p.AssignedTelegramSession.FirstName,
                lastName = p.AssignedTelegramSession.LastName,
                userName = p.AssignedTelegramSession.UserName,
                phoneNumber = p.AssignedTelegramSession.PhoneNumber,
                profilePhoto = p.AssignedTelegramSession.ProfilePhoto,
                isAuthorized = p.AssignedTelegramSession.IsAuthorized,
            },
            lastReminderActivity = p.LastReminderActivity ?? string.Empty,
            residentsCount = residentCountMap.TryGetValue(p.Id, out var count) ? count : 0,
            outstandingBalance = balanceMap.TryGetValue(p.Id, out var balance) ? balance : 0m
        });

        return Ok(result);
    }

    /// <summary>
    /// POST /property — create a new property (multipart/form-data).
    /// Fields: name (required), code?, assignedTelegramSessionId?, logoFile?
    /// </summary>
    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> CreateProperty([FromForm] CreatePropertyRequest body, IFormFile? logoFile)
    {
        if (string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { status = false, message = "Property name is required." });

        string? logoUrl = null;
        if (logoFile is { Length: > 0 })
        {
            var ext = Path.GetExtension(logoFile.FileName).ToLowerInvariant();
            if (string.IsNullOrEmpty(ext)) ext = ".jpg";
            var path = $"pcmc/properties/{Guid.NewGuid():N}{ext}";
            logoUrl = await storage.UploadFormFileAsync(logoFile, path, logoFile.ContentType, isPublic: true);
        }

        long? sessionId = null;
        if (long.TryParse(body.AssignedTelegramSessionId, out var sid) && sid > 0)
            sessionId = sid;

        var property = new PcmcProperty
        {
            Name = body.Name.Trim(),
            Code = body.Code?.Trim(),
            Logo = logoUrl,
            AssignedTelegramSessionId = sessionId,
            IsActive = true,
            CreatedOn = DateTime.UtcNow
        };

        dbContext.PcmcProperties.Add(property);
        await dbContext.SaveChangesAsync();

        // Reload with session nav so the response includes the profile
        await dbContext.Entry(property).Reference(p => p.AssignedTelegramSession).LoadAsync();

        return Ok(new
        {
            status = true,
            data = BuildPropertyDto(property, 0, 0)
        });
    }

    /// <summary>
    /// PUT /property/{id} — update property fields (multipart/form-data).
    /// logoFile = new image to upload; logo = existing URL (empty string = clear logo).
    /// assignedTelegramSessionId = session FK (empty string = unassign, absent = unchanged).
    /// </summary>
    [HttpPut("{id}")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UpdateProperty(int id, [FromForm] UpdatePropertyRequest body, IFormFile? logoFile)
    {
        var property = await dbContext.PcmcProperties.FindAsync(id);
        if (property is null)
            return NotFound(new { status = false, message = "Property not found." });

        if (!string.IsNullOrWhiteSpace(body.Name))
            property.Name = body.Name.Trim();

        if (body.Code is not null)
            property.Code = body.Code.Trim();

        if (body.LastReminderActivity is not null)
            property.LastReminderActivity = body.LastReminderActivity.Trim();

        // New file takes priority; empty Logo string means "clear"; absent Logo means "unchanged"
        if (logoFile is { Length: > 0 })
        {
            var ext = Path.GetExtension(logoFile.FileName).ToLowerInvariant();
            if (string.IsNullOrEmpty(ext)) ext = ".jpg";
            var path = $"pcmc/properties/{Guid.NewGuid():N}{ext}";
            property.Logo = await storage.UploadFormFileAsync(logoFile, path, logoFile.ContentType, isPublic: true);
        }
        else if (body.Logo is not null)
        {
            property.Logo = string.IsNullOrWhiteSpace(body.Logo) ? null : body.Logo.Trim();
        }

        // Telegram session: null (absent) = don't change; "" = unassign; "12345" = assign
        if (body.AssignedTelegramSessionId is not null)
        {
            property.AssignedTelegramSessionId = long.TryParse(body.AssignedTelegramSessionId, out var sid) && sid > 0
                ? sid
                : null;
        }

        await dbContext.SaveChangesAsync();

        await dbContext.Entry(property).Reference(p => p.AssignedTelegramSession).LoadAsync();

        return Ok(new
        {
            status = true,
            data = BuildPropertyDto(property, 0, 0)
        });
    }

    /// <summary>
    /// DELETE /property/{id} — soft delete (set IsActive = false).
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProperty(int id)
    {
        var property = await dbContext.PcmcProperties.FindAsync(id);
        if (property is null)
            return NotFound(new { status = false, message = "Property not found." });

        property.IsActive = false;
        await dbContext.SaveChangesAsync();

        return Ok(new { status = true, message = "Property deactivated." });
    }

    private static object BuildPropertyDto(PcmcProperty p, int residentsCount, decimal outstandingBalance) => new
    {
        p.Id,
        p.Name,
        p.Code,
        p.Logo,
        p.AssignedTelegramSessionId,
        assignedTelegramSession = p.AssignedTelegramSession == null ? null : new
        {
            id = p.AssignedTelegramSession.Id,
            firstName = p.AssignedTelegramSession.FirstName,
            lastName = p.AssignedTelegramSession.LastName,
            userName = p.AssignedTelegramSession.UserName,
            phoneNumber = p.AssignedTelegramSession.PhoneNumber,
            profilePhoto = p.AssignedTelegramSession.ProfilePhoto,
            isAuthorized = p.AssignedTelegramSession.IsAuthorized,
        },
        lastReminderActivity = p.LastReminderActivity ?? string.Empty,
        residentsCount,
        outstandingBalance,
    };
}

public class CreatePropertyRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? AssignedTelegramSessionId { get; set; }
}

public class UpdatePropertyRequest
{
    public string? Name { get; set; }
    public string? Code { get; set; }
    public string? Logo { get; set; }
    public string? AssignedTelegramSessionId { get; set; }
    public string? LastReminderActivity { get; set; }
}
