using System.Text.Json;
using Library.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Data;

namespace TelegramRoom.Controllers;

[Route("[controller]")]
[ApiController]
public class BillController(TelegramContext dbContext) : ControllerBase
{
    /// <summary>
    /// GET /bill — proactively compute bill statuses via the configured rule,
    /// write a status log when a bill transitions, then return the full list.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetBills(
        [FromQuery] int? locationId,
        [FromQuery] string? status,
        [FromQuery] string? service)
    {
        // ── Status interceptor ────────────────────────────────────────────────
        var rule = await LoadBillRuleAsync();

        var today = DateTime.UtcNow.Date;

        // Load all non-Paid bills with tracking so we can update them.
        var trackedBills = await dbContext.PcmcBills
            .Where(b => b.Status != "Paid")
            .ToListAsync();

        var newLogs = new List<PcmcBillStatusLog>();
        foreach (var bill in trackedBills)
        {
            var computed = ComputeStatus(bill.DueDate, today, rule.OverdueDays);
            if (bill.Status != computed)
            {
                bill.Status = computed;
                newLogs.Add(new PcmcBillStatusLog
                {
                    BillId        = bill.Id,
                    StatusName    = computed,
                    OperationDate = DateTime.UtcNow,
                    Outcome       = "Success",
                });
            }
        }

        if (newLogs.Count > 0)
        {
            dbContext.PcmcBillStatusLogs.AddRange(newLogs);
            await dbContext.SaveChangesAsync();
        }

        // ── Build response query (AsNoTracking with all joins) ─────────────────
        var query = dbContext.PcmcBills
            .AsNoTracking()
            .Include(b => b.UnitRef!).ThenInclude(u => u.Location)
            .Include(b => b.Customer).ThenInclude(c => c.TelegramSessionContact).ThenInclude(t => t.TelegramContact)
            .Include(b => b.ServiceRef)
            .Include(b => b.StatusLogs.OrderBy(l => l.OperationDate))
            .AsQueryable();

        if (locationId.HasValue)
            query = query.Where(b => b.UnitRef != null && b.UnitRef.LocationId == locationId.Value);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(b => b.Status == status);

        if (!string.IsNullOrWhiteSpace(service))
            query = query.Where(b => b.ServiceRef != null && b.ServiceRef.Name == service);

        var bills = await query
            .OrderByDescending(b => b.CreatedOn)
            .Select(b => new
            {
                b.Id,
                ResidentCode = b.Customer != null ? b.Customer.Code : string.Empty,
                ResidentName = b.Customer != null ? b.Customer.Name : string.Empty,
                ProfilePhoto = b.Customer != null && b.Customer.TelegramSessionContact != null
                    ? b.Customer.TelegramSessionContact.TelegramContact.ProfilePhoto
                    : null,
                Unit    = b.UnitRef != null ? b.UnitRef.Code : string.Empty,
                Service = b.ServiceRef != null ? b.ServiceRef.Name : string.Empty,
                b.Amount,
                DueDate = b.DueDate.ToString("yyyy-MM-dd"),
                b.Status,
                b.AutoSend,
                b.UnitId,
                b.ServiceId,
                LocationId   = b.UnitRef != null ? (int?)b.UnitRef.LocationId : null,
                LocationName = b.UnitRef != null && b.UnitRef.Location != null ? b.UnitRef.Location.Name : string.Empty,
                b.CustomerId,
                PaidDate = b.PaidDate.HasValue ? b.PaidDate.Value.ToString("yyyy-MM-dd") : null,
                StatusLogs = b.StatusLogs.Select(l => new
                {
                    l.StatusName,
                    OperationDate = l.OperationDate.ToString("yyyy-MM-dd HH:mm"),
                    l.Outcome,
                    l.Reason,
                }).ToList(),
            })
            .ToListAsync();

        return Ok(bills);
    }

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private async Task<BillRuleValues> LoadBillRuleAsync() =>
        (await dbContext.PcmcUtilityConfigs.AsNoTracking()
            .Where(c => c.Name == "bill_rule")
            .Select(c => c.Value)
            .FirstOrDefaultAsync()) is string json
        ? JsonSerializer.Deserialize<BillRuleValues>(json, JsonOpts) ?? BillRuleValues.Default
        : BillRuleValues.Default;

    /// <summary>
    /// Compute the system-determined status for a non-Paid bill.
    /// Preparing → bill is in the future (autoSend alerting phase not yet triggered).
    /// Due       → due date has passed but within the grace window.
    /// Overdue   → grace window exceeded.
    /// </summary>
    private static string ComputeStatus(DateTime dueDate, DateTime today, int overdueDays)
    {
        var daysUntilDue = (dueDate.Date - today).Days;
        if (daysUntilDue > 0)            return "Preparing";
        if (-daysUntilDue < overdueDays) return "Due";
        return "Overdue";
    }

    /// <summary>
    /// POST /bill — create a new bill.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateBill([FromBody] BillRequest body)
    {
        // Resolve the resident (Customer) — the bill stores only the FK; the code and
        // name are read back through the relation.
        int? customerId = body.CustomerId;
        if (customerId is null && !string.IsNullOrWhiteSpace(body.ResidentCode))
        {
            var code = body.ResidentCode.Trim();
            var customer = await dbContext.PcmcCustomers
                .FirstOrDefaultAsync(c => c.IsActive && c.Code.ToLower() == code.ToLower());
            if (customer is null)
                return BadRequest(new { status = false, message = $"Resident \"{code}\" not found." });
            customerId = customer.Id;
        }
        if (customerId is null)
            return BadRequest(new { status = false, message = "A resident is required." });

        // Resolve unit; the bill's location is reached through it.
        if (body.UnitId is int unitId)
        {
            var unit = await dbContext.PcmcUnits.FirstOrDefaultAsync(u => u.Id == unitId && u.IsActive);
            if (unit is null)
                return BadRequest(new { status = false, message = "Unit not found." });
        }

        // Resolve service by id or name (optional).
        int? serviceId = await ResolveServiceIdAsync(body.ServiceId, body.Service);

        var rule = await LoadBillRuleAsync();

        var bill = new PcmcBill
        {
            Amount     = body.Amount,
            DueDate    = body.DueDate,
            Status     = ComputeStatus(body.DueDate, DateTime.UtcNow.Date, rule.OverdueDays),
            AutoSend   = body.AutoSend,
            UnitId     = body.UnitId,
            CustomerId = customerId,
            ServiceId  = serviceId,
        };

        dbContext.PcmcBills.Add(bill);
        await dbContext.SaveChangesAsync();

        return Ok(new { status = true, data = new { bill.Id } });
    }

    /// <summary>
    /// Resolve a service FK from an explicit id or a service name. Returns null when
    /// neither resolves (e.g. the "None" option).
    /// </summary>
    private async Task<int?> ResolveServiceIdAsync(int? serviceId, string? serviceName)
    {
        if (serviceId is int id)
        {
            var exists = await dbContext.PcmcServices.AnyAsync(s => s.Id == id);
            return exists ? id : null;
        }
        var name = serviceName?.Trim();
        if (string.IsNullOrWhiteSpace(name))
            return null;
        var svc = await dbContext.PcmcServices
            .FirstOrDefaultAsync(s => s.IsActive && s.Name.ToLower() == name.ToLower());
        return svc?.Id;
    }

    /// <summary>
    /// PUT /bill/{id} — update any provided field (status, autoSend, unit,
    /// resident, service, amount, due date). Null fields are left unchanged.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateBill(int id, [FromBody] BillUpdateRequest body)
    {
        var bill = await dbContext.PcmcBills.FindAsync(id);
        if (bill is null)
            return NotFound(new { status = false, message = "Bill not found." });

        if (body.AutoSend.HasValue)
            bill.AutoSend = body.AutoSend.Value;

        // Only "Paid" may be set by the admin; all other statuses are computed by the system.
        if (body.Status == "Paid" && bill.Status != "Paid")
        {
            bill.Status  = "Paid";
            bill.PaidDate ??= DateTime.UtcNow;
            dbContext.PcmcBillStatusLogs.Add(new PcmcBillStatusLog
            {
                BillId        = bill.Id,
                StatusName    = "Paid",
                OperationDate = DateTime.UtcNow,
                Outcome       = "Success",
            });
        }

        if (body.UnitId is int unitId)
        {
            var unit = await dbContext.PcmcUnits.FirstOrDefaultAsync(u => u.Id == unitId && u.IsActive);
            if (unit is null)
                return BadRequest(new { status = false, message = "Unit not found." });
            bill.UnitId = unit.Id;
        }

        // Resolve the resident from an explicit id or code (the bill stores only the FK).
        if (body.CustomerId is int cid)
        {
            bill.CustomerId = cid;
        }
        else if (!string.IsNullOrWhiteSpace(body.ResidentCode))
        {
            var code = body.ResidentCode.Trim();
            var customer = await dbContext.PcmcCustomers
                .FirstOrDefaultAsync(c => c.IsActive && c.Code.ToLower() == code.ToLower());
            if (customer is null)
                return BadRequest(new { status = false, message = $"Resident \"{code}\" not found." });
            bill.CustomerId = customer.Id;
        }

        // Resolve the service when an id or name is supplied (empty name clears it).
        if (body.ServiceId.HasValue || body.Service is not null)
            bill.ServiceId = await ResolveServiceIdAsync(body.ServiceId, body.Service);

        if (body.Amount.HasValue)
            bill.Amount = body.Amount.Value;

        if (body.DueDate.HasValue)
            bill.DueDate = body.DueDate.Value;

        await dbContext.SaveChangesAsync();
        return Ok(new { status = true });
    }

    /// <summary>
    /// POST /bill/import — bulk-import bills from a parsed Excel sheet.
    /// Rows whose location or resident cannot be resolved are skipped and reported in errors.
    /// Rows with unitStatus "new" create the unit first; "unset" leaves unitId null.
    /// </summary>
    [HttpPost("import")]
    public async Task<IActionResult> ImportBills([FromBody] BillImportRequest body)
    {
        var imported = 0;
        var skipped = 0;
        var errors = new List<string>();
        var newUnits = new List<object>();

        var importRule = await LoadBillRuleAsync();
        var today = DateTime.UtcNow.Date;
        var overdueDays = importRule.OverdueDays;

        foreach (var (row, index) in body.Rows.Select((r, i) => (r, i + 1)))
        {
            // Resolve location by code first, fall back to name.
            var lc = row.LocationCode?.Trim().ToLower() ?? string.Empty;
            var location = await dbContext.PcmcProperties
                .FirstOrDefaultAsync(p => p.IsActive &&
                    (p.Code != null && p.Code.ToLower() == lc || p.Name.ToLower() == lc));
            if (location is null)
            {
                errors.Add($"Row {index}: Location \"{row.LocationCode}\" not found.");
                skipped++;
                continue;
            }

            // Resolve resident by code first, then phone — at least one must match.
            PcmcCustomer? customer = null;
            if (!string.IsNullOrWhiteSpace(row.ResidentCode))
            {
                var rc = row.ResidentCode.Trim().ToLower();
                customer = await dbContext.PcmcCustomers
                    .FirstOrDefaultAsync(c => c.IsActive && c.Code.ToLower() == rc);
            }
            if (customer is null && !string.IsNullOrWhiteSpace(row.ResidentPhone))
            {
                var ph = row.ResidentPhone.Trim();
                customer = await dbContext.PcmcCustomers
                    .FirstOrDefaultAsync(c => c.IsActive && c.Phone != null && c.Phone == ph);
            }
            if (customer is null)
            {
                errors.Add($"Row {index}: Resident not found (code: \"{row.ResidentCode}\", phone: \"{row.ResidentPhone}\").");
                skipped++;
                continue;
            }

            // Parse due date.
            if (!DateTime.TryParse(row.DueDate, out var dueDate))
            {
                errors.Add($"Row {index}: Invalid due date \"{row.DueDate}\".");
                skipped++;
                continue;
            }

            // Resolve / create unit based on unitStatus.
            int? unitId = null;
            var uc = row.UnitCode?.Trim();

            if (row.UnitStatus == "matched" && !string.IsNullOrWhiteSpace(uc))
            {
                var unit = await dbContext.PcmcUnits.FirstOrDefaultAsync(u =>
                    u.IsActive && u.LocationId == location.Id && u.Code.ToLower() == uc.ToLower());
                unitId = unit?.Id;
            }
            else if (row.UnitStatus == "new" && !string.IsNullOrWhiteSpace(uc))
            {
                // Re-use if already in DB (handles duplicate rows in the same import).
                var existing = await dbContext.PcmcUnits.FirstOrDefaultAsync(u =>
                    u.LocationId == location.Id && u.Code.ToLower() == uc.ToLower());
                if (existing is not null)
                {
                    unitId = existing.Id;
                }
                else
                {
                    var newUnit = new PcmcUnit { Code = uc, LocationId = location.Id };
                    dbContext.PcmcUnits.Add(newUnit);
                    await dbContext.SaveChangesAsync();
                    unitId = newUnit.Id;
                    newUnits.Add(new { id = newUnit.Id, code = newUnit.Code, locationId = location.Id, locationName = location.Name });
                }
            }
            // "unset" → unitId stays null.

            // Resolve service by name (optional).
            int? serviceId = await ResolveServiceIdAsync(null, row.Service);

            dbContext.PcmcBills.Add(new PcmcBill
            {
                Amount     = row.Amount,
                DueDate    = dueDate,
                Status     = ComputeStatus(dueDate, today, overdueDays),
                AutoSend   = row.AutoSend,
                UnitId     = unitId,
                CustomerId = customer.Id,
                ServiceId  = serviceId,
            });
            imported++;
        }

        await dbContext.SaveChangesAsync();
        return Ok(new { status = true, imported, skipped, errors, newUnits });
    }

    /// <summary>
    /// DELETE /bill/{id} — hard delete a bill record.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteBill(int id)
    {
        var bill = await dbContext.PcmcBills.FindAsync(id);
        if (bill is null)
            return NotFound(new { status = false, message = "Bill not found." });

        dbContext.PcmcBills.Remove(bill);
        await dbContext.SaveChangesAsync();
        return Ok(new { status = true });
    }
}

public class BillRequest
{
    public string? ResidentCode { get; set; }
    public string? ResidentName { get; set; }
    public string? Service { get; set; }
    public decimal Amount { get; set; }
    public DateTime DueDate { get; set; }
    public string? Status { get; set; }
    public bool AutoSend { get; set; }
    public int? UnitId { get; set; }
    public int? CustomerId { get; set; }
    public int? ServiceId { get; set; }
}

public class BillImportRequest
{
    public List<BillImportRow> Rows { get; set; } = [];
}

public class BillImportRow
{
    public string? LocationCode { get; set; }
    public string? ResidentCode { get; set; }
    public string? ResidentPhone { get; set; }
    public string? UnitCode { get; set; }
    public string UnitStatus { get; set; } = "unset"; // "matched" | "new" | "unset"
    public string? Service { get; set; }
    public decimal Amount { get; set; }
    public string? DueDate { get; set; }
    public bool AutoSend { get; set; }
}

public class BillUpdateRequest
{
    public bool? AutoSend { get; set; }
    public string? Status { get; set; }
    public int? UnitId { get; set; }
    public int? CustomerId { get; set; }
    public string? ResidentCode { get; set; }
    public string? ResidentName { get; set; }
    public string? Service { get; set; }
    public int? ServiceId { get; set; }
    public decimal? Amount { get; set; }
    public DateTime? DueDate { get; set; }
}
