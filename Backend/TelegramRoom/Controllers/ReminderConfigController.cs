using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Data;

namespace TelegramRoom.Controllers;

[Route("[controller]")]
[ApiController]
public class ReminderConfigController(TelegramContext dbContext) : ControllerBase
{
    /// <summary>GET /reminderconfig — list all configs ordered by SortOrder.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var configs = await dbContext.PcmcReminderConfigs
            .AsNoTracking()
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Id)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Offset,
                c.Enabled,
                Template = c.Template ?? string.Empty,
                c.SortOrder,
            })
            .ToListAsync();

        return Ok(configs);
    }

    /// <summary>PUT /reminderconfig/{id} — update Enabled and/or Template.</summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] ReminderConfigUpdateRequest body)
    {
        var config = await dbContext.PcmcReminderConfigs.FindAsync(id);
        if (config is null)
            return NotFound(new { status = false, message = "Reminder config not found." });

        if (body.Enabled.HasValue)
            config.Enabled = body.Enabled.Value;

        if (body.Template is not null)
            config.Template = body.Template.Trim();

        await dbContext.SaveChangesAsync();

        return Ok(new { status = true });
    }
}

public class ReminderConfigUpdateRequest
{
    public bool? Enabled { get; set; }
    public string? Template { get; set; }
}
