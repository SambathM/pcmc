using Library.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Data;

namespace TelegramRoom.Controllers;

[Route("[controller]")]
[ApiController]
public class ServiceController(TelegramContext dbContext) : ControllerBase
{
    /// <summary>
    /// GET /service — list active services with resident count and outstanding amount from bridge + bills.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetServices()
    {
        var services = await dbContext.PcmcServices
            .AsNoTracking()
            .Where(s => s.IsActive)
            .OrderBy(s => s.Name)
            .ToListAsync();

        // Active resident count per service via bridge table
        var residentCounts = await dbContext.PcmcCustomerServices
            .AsNoTracking()
            .Where(cs => cs.IsActive)
            .GroupBy(cs => cs.ServiceId)
            .Select(g => new { ServiceId = g.Key, Count = g.Count() })
            .ToListAsync();

        // Outstanding amounts still derived from bills (source of truth for money),
        // grouped by the service FK.
        var billStubs = await dbContext.PcmcBills
            .AsNoTracking()
            .Where(b => b.Status != "Paid" && b.ServiceId != null)
            .Select(b => new { b.ServiceId, b.Amount })
            .ToListAsync();

        var amountByServiceId = billStubs
            .GroupBy(b => b.ServiceId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(b => b.Amount));

        var countById = residentCounts.ToDictionary(r => r.ServiceId, r => r.Count);

        var result = services.Select(s => new
        {
            s.Id,
            s.Name,
            s.Description,
            ReminderTemplate = s.ReminderTemplate ?? string.Empty,
            ActiveResidents = countById.GetValueOrDefault(s.Id, 0),
            OutstandingAmount = amountByServiceId.GetValueOrDefault(s.Id, 0m),
        });

        return Ok(result);
    }

    /// <summary>
    /// POST /service — create a new service.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateService([FromBody] ServiceRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { status = false, message = "Service name is required." });

        var trimmedName = body.Name.Trim();
        var duplicate = await dbContext.PcmcServices
            .AnyAsync(s => s.IsActive && s.Name.ToLower() == trimmedName.ToLower());
        if (duplicate)
            return Conflict(new { status = false, message = $"A service named \"{trimmedName}\" already exists." });

        var service = new PcmcService
        {
            Name = trimmedName,
            Description = body.Description?.Trim(),
            ReminderTemplate = body.ReminderTemplate?.Trim(),
        };

        dbContext.PcmcServices.Add(service);
        await dbContext.SaveChangesAsync();

        return Ok(new { status = true, data = new { service.Id, service.Name, service.Description, ReminderTemplate = service.ReminderTemplate ?? string.Empty, ActiveResidents = 0, OutstandingAmount = 0m } });
    }

    /// <summary>
    /// PUT /service/{id} — update name, description, or reminder template.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateService(int id, [FromBody] ServiceRequest body)
    {
        var service = await dbContext.PcmcServices.FindAsync(id);
        if (service is null)
            return NotFound(new { status = false, message = "Service not found." });

        if (!string.IsNullOrWhiteSpace(body.Name))
        {
            var trimmedName = body.Name.Trim();
            var duplicate = await dbContext.PcmcServices
                .AnyAsync(s => s.IsActive && s.Id != id && s.Name.ToLower() == trimmedName.ToLower());
            if (duplicate)
                return Conflict(new { status = false, message = $"A service named \"{trimmedName}\" already exists." });
            service.Name = trimmedName;
        }

        if (body.Description is not null)
            service.Description = body.Description.Trim();

        if (body.ReminderTemplate is not null)
            service.ReminderTemplate = body.ReminderTemplate.Trim();

        await dbContext.SaveChangesAsync();

        return Ok(new { status = true });
    }

    /// <summary>
    /// DELETE /service/{id} — soft delete, rejected if any customers are still assigned.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteService(int id)
    {
        var service = await dbContext.PcmcServices.FindAsync(id);
        if (service is null)
            return NotFound(new { status = false, message = "Service not found." });

        var assignedCount = await dbContext.PcmcCustomerServices
            .CountAsync(cs => cs.ServiceId == id && cs.IsActive);

        if (assignedCount > 0)
            return Conflict(new
            {
                status = false,
                message = $"Cannot delete \"{service.Name}\": {assignedCount} customer{(assignedCount == 1 ? "" : "s")} are still assigned to this service."
            });

        service.IsActive = false;
        await dbContext.SaveChangesAsync();

        return Ok(new { status = true, message = "Service deactivated." });
    }

    /// <summary>
    /// GET /service/{id}/customers — list customers assigned to this service.
    /// </summary>
    [HttpGet("{id}/customers")]
    public async Task<IActionResult> GetAssignedCustomers(int id)
    {
        var exists = await dbContext.PcmcServices.AnyAsync(s => s.Id == id && s.IsActive);
        if (!exists) return NotFound(new { status = false, message = "Service not found." });

        var customers = await dbContext.PcmcCustomerServices
            .AsNoTracking()
            .Where(cs => cs.ServiceId == id && cs.IsActive)
            .Include(cs => cs.Customer)
            .Select(cs => new
            {
                cs.Id,
                cs.CustomerId,
                cs.AssignedOn,
                CustomerCode = cs.Customer!.Code,
                CustomerName = cs.Customer.Name,
                Unit = cs.Customer.Unit,
            })
            .ToListAsync();

        return Ok(customers);
    }

    /// <summary>
    /// POST /service/{id}/customers — assign one or more customers to this service.
    /// Skips duplicates silently.
    /// </summary>
    [HttpPost("{id}/customers")]
    public async Task<IActionResult> AssignCustomers(int id, [FromBody] AssignCustomersRequest body)
    {
        var service = await dbContext.PcmcServices.FindAsync(id);
        if (service is null || !service.IsActive)
            return NotFound(new { status = false, message = "Service not found." });

        var existingIds = await dbContext.PcmcCustomerServices
            .Where(cs => cs.ServiceId == id && cs.IsActive && body.CustomerIds.Contains(cs.CustomerId))
            .Select(cs => cs.CustomerId)
            .ToListAsync();

        var toAdd = body.CustomerIds
            .Distinct()
            .Except(existingIds)
            .Select(cid => new PcmcCustomerService { CustomerId = cid, ServiceId = id })
            .ToList();

        if (toAdd.Count > 0)
        {
            dbContext.PcmcCustomerServices.AddRange(toAdd);
            await dbContext.SaveChangesAsync();
        }

        return Ok(new { status = true, assigned = toAdd.Count, skipped = body.CustomerIds.Count - toAdd.Count });
    }

    /// <summary>
    /// DELETE /service/{id}/customers/{customerId} — unassign a customer from this service (soft delete).
    /// </summary>
    [HttpDelete("{id}/customers/{customerId:int}")]
    public async Task<IActionResult> UnassignCustomer(int id, int customerId)
    {
        var link = await dbContext.PcmcCustomerServices
            .FirstOrDefaultAsync(cs => cs.ServiceId == id && cs.CustomerId == customerId && cs.IsActive);

        if (link is null)
            return NotFound(new { status = false, message = "Assignment not found." });

        link.IsActive = false;
        await dbContext.SaveChangesAsync();

        return Ok(new { status = true });
    }
}

public class ServiceRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ReminderTemplate { get; set; }
}

public class AssignCustomersRequest
{
    public List<int> CustomerIds { get; set; } = [];
}
