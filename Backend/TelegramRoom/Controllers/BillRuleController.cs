using System.Text.Json;
using Library.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Data;

namespace TelegramRoom.Controllers;

[Route("bill-rule")]
[ApiController]
public class BillRuleController(TelegramContext dbContext) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };
    private const string RuleName = "bill_rule";

    /// <summary>
    /// GET /bill-rule — returns the current global bill rule (or defaults when none exists).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetRule()
    {
        var config = await dbContext.PcmcUtilityConfigs.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Name == RuleName);

        var rule = config is not null
            ? JsonSerializer.Deserialize<BillRuleValues>(config.Value, JsonOpts) ?? BillRuleValues.Default
            : BillRuleValues.Default;

        return Ok(new
        {
            Id       = config?.Id ?? 0,
            rule.PreparingDays,
            rule.OverdueDays,
            UpdatedOn = config?.UpdatedOn.ToString("o"),
        });
    }

    /// <summary>
    /// PUT /bill-rule — upsert the global bill rule thresholds.
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> UpdateRule([FromBody] BillRuleRequest body)
    {
        if (body.PreparingDays < 0 || body.OverdueDays < 0)
            return BadRequest(new { status = false, message = "Days must be non-negative." });

        var config = await dbContext.PcmcUtilityConfigs.FirstOrDefaultAsync(c => c.Name == RuleName);
        if (config is null)
        {
            config = new PcmcUtilityConfig { Name = RuleName };
            dbContext.PcmcUtilityConfigs.Add(config);
        }

        config.Value     = JsonSerializer.Serialize(new BillRuleValues(body.PreparingDays, body.OverdueDays));
        config.UpdatedOn = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            status = true,
            body.PreparingDays,
            body.OverdueDays,
            UpdatedOn = config.UpdatedOn.ToString("o"),
        });
    }
}

public class BillRuleRequest
{
    public int PreparingDays { get; set; } = 5;
    public int OverdueDays   { get; set; } = 7;
}

internal sealed record BillRuleValues(int PreparingDays, int OverdueDays)
{
    internal static readonly BillRuleValues Default = new(5, 7);
}
