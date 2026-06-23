using Library.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Data;

namespace TelegramRoom.Controllers;

[Route("[controller]")]
[ApiController]
public class UnitController(TelegramContext dbContext) : ControllerBase
{
    /// <summary>
    /// GET /unit?locationId= — list active units, optionally filtered by property.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetUnits([FromQuery] int? locationId)
    {
        var query = dbContext.PcmcUnits.AsNoTracking().Where(u => u.IsActive);
        if (locationId is int locId)
            query = query.Where(u => u.LocationId == locId);

        var units = await query
            .Include(u => u.Location)
            .OrderBy(u => u.Code)
            .Select(u => new
            {
                u.Id,
                u.Code,
                u.Floor,
                u.Building,
                u.Note,
                u.LocationId,
                LocationName = u.Location!.Name,
            })
            .ToListAsync();

        return Ok(units);
    }

    /// <summary>
    /// POST /unit — create a new unit under a property.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateUnit([FromBody] UnitRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Code))
            return BadRequest(new { status = false, message = "Unit code is required." });
        if (body.LocationId <= 0)
            return BadRequest(new { status = false, message = "A location is required." });

        var propertyExists = await dbContext.PcmcProperties.AnyAsync(p => p.Id == body.LocationId && p.IsActive);
        if (!propertyExists)
            return BadRequest(new { status = false, message = "Location not found." });

        var trimmedCode = body.Code.Trim();
        var duplicate = await dbContext.PcmcUnits
            .AnyAsync(u => u.IsActive && u.LocationId == body.LocationId && u.Code.ToLower() == trimmedCode.ToLower());
        if (duplicate)
            return Conflict(new { status = false, message = $"Unit \"{trimmedCode}\" already exists in this location." });

        var unit = new PcmcUnit
        {
            Code = trimmedCode,
            Floor = body.Floor?.Trim(),
            Building = body.Building?.Trim(),
            Note = body.Note?.Trim(),
            LocationId = body.LocationId,
        };

        dbContext.PcmcUnits.Add(unit);
        await dbContext.SaveChangesAsync();

        var locationName = await dbContext.PcmcProperties
            .Where(p => p.Id == unit.LocationId).Select(p => p.Name).FirstOrDefaultAsync();

        return Ok(new { status = true, data = new { unit.Id, unit.Code, unit.Floor, unit.Building, unit.Note, unit.LocationId, LocationName = locationName } });
    }

    /// <summary>
    /// PUT /unit/{id} — update unit fields.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUnit(int id, [FromBody] UnitRequest body)
    {
        var unit = await dbContext.PcmcUnits.FindAsync(id);
        if (unit is null || !unit.IsActive)
            return NotFound(new { status = false, message = "Unit not found." });

        if (!string.IsNullOrWhiteSpace(body.Code))
        {
            var trimmedCode = body.Code.Trim();
            var targetLocation = body.LocationId > 0 ? body.LocationId : unit.LocationId;
            var duplicate = await dbContext.PcmcUnits
                .AnyAsync(u => u.IsActive && u.Id != id && u.LocationId == targetLocation && u.Code.ToLower() == trimmedCode.ToLower());
            if (duplicate)
                return Conflict(new { status = false, message = $"Unit \"{trimmedCode}\" already exists in this location." });
            unit.Code = trimmedCode;
        }

        if (body.LocationId > 0) unit.LocationId = body.LocationId;
        if (body.Floor is not null) unit.Floor = body.Floor.Trim();
        if (body.Building is not null) unit.Building = body.Building.Trim();
        if (body.Note is not null) unit.Note = body.Note.Trim();

        await dbContext.SaveChangesAsync();

        return Ok(new { status = true });
    }

    /// <summary>
    /// DELETE /unit/{id} — soft delete.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUnit(int id)
    {
        var unit = await dbContext.PcmcUnits.FindAsync(id);
        if (unit is null || !unit.IsActive)
            return NotFound(new { status = false, message = "Unit not found." });

        unit.IsActive = false;
        await dbContext.SaveChangesAsync();

        return Ok(new { status = true, message = "Unit removed." });
    }

    /// <summary>
    /// POST /unit/import — bulk create units from spreadsheet rows (location code + unit code).
    /// Resolves each row's property by its code. Skips duplicates; reports unresolved rows.
    /// </summary>
    [HttpPost("import")]
    public async Task<IActionResult> ImportUnits([FromBody] UnitImportRequest body)
    {
        if (body.Rows is null || body.Rows.Count == 0)
            return BadRequest(new { status = false, message = "No rows to import." });

        // Resolve properties by code (case-insensitive).
        var properties = await dbContext.PcmcProperties
            .Where(p => p.IsActive && p.Code != null)
            .Select(p => new { p.Id, p.Code })
            .ToListAsync();
        var propByCode = properties
            .GroupBy(p => p.Code!.Trim().ToLower())
            .ToDictionary(g => g.Key, g => g.First().Id);

        // Existing units keyed by "locationId|code" to detect duplicates.
        var existing = (await dbContext.PcmcUnits
            .Where(u => u.IsActive)
            .Select(u => new { u.LocationId, u.Code })
            .ToListAsync())
            .Select(u => $"{u.LocationId}|{u.Code.ToLower()}")
            .ToHashSet();

        var toAdd = new List<PcmcUnit>();
        var errors = new List<string>();
        int skipped = 0;

        foreach (var row in body.Rows)
        {
            var locCode = row.LocationCode?.Trim();
            var unitCode = row.UnitCode?.Trim();
            if (string.IsNullOrWhiteSpace(locCode) || string.IsNullOrWhiteSpace(unitCode))
            {
                skipped++;
                continue;
            }

            if (!propByCode.TryGetValue(locCode.ToLower(), out var locationId))
            {
                errors.Add($"Unknown location code \"{locCode}\" (unit \"{unitCode}\").");
                skipped++;
                continue;
            }

            var key = $"{locationId}|{unitCode.ToLower()}";
            if (existing.Contains(key))
            {
                skipped++;
                continue;
            }
            existing.Add(key);

            toAdd.Add(new PcmcUnit { Code = unitCode, LocationId = locationId });
        }

        if (toAdd.Count > 0)
        {
            dbContext.PcmcUnits.AddRange(toAdd);
            await dbContext.SaveChangesAsync();
        }

        return Ok(new { status = true, imported = toAdd.Count, skipped, errors });
    }
}

public class UnitRequest
{
    public string Code { get; set; } = string.Empty;
    public string? Floor { get; set; }
    public string? Building { get; set; }
    public string? Note { get; set; }
    public int LocationId { get; set; }
}

public class UnitImportRequest
{
    public List<UnitImportRow> Rows { get; set; } = [];
}

public class UnitImportRow
{
    public string? LocationCode { get; set; }
    public string? UnitCode { get; set; }
}
