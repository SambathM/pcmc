using Library.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Data;

namespace TelegramRoom.Controllers;

[Route("[controller]")]
[ApiController]
public class BillRuleController(TelegramContext dbContext) : ControllerBase
{
    private static readonly PcmcBillRule DefaultRule = new() { Id = 1, PreparingDays = 5, OverdueDays = 7 };

    /// <summary>
    /// GET /bill-rule — returns the current global bill rule (or defaults when none exists).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetRule()
    {
        var rule = await dbContext.PcmcBillRules.AsNoTracking().FirstOrDefaultAsync()
            ?? DefaultRule;
        return Ok(new { rule.Id, rule.PreparingDays, rule.OverdueDays, rule.UpdatedOn });
    }

    /// <summary>
    /// PUT /bill-rule — upsert the global bill rule thresholds.
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> UpdateRule([FromBody] BillRuleRequest body)
    {
        if (body.PreparingDays < 0 || body.OverdueDays < 0)
            return BadRequest(new { status = false, message = "Days must be non-negative." });

        var rule = await dbContext.PcmcBillRules.FirstOrDefaultAsync();
        if (rule is null)
        {
            rule = new PcmcBillRule();
            dbContext.PcmcBillRules.Add(rule);
        }

        rule.PreparingDays = body.PreparingDays;
        rule.OverdueDays   = body.OverdueDays;
        rule.UpdatedOn     = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
        return Ok(new { status = true, rule.PreparingDays, rule.OverdueDays, rule.UpdatedOn });
    }
}

public class BillRuleRequest
{
    public int PreparingDays { get; set; } = 5;
    public int OverdueDays   { get; set; } = 7;
}
