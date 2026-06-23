using Library.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TelegramEngine.Data;

namespace TelegramRoom.Controllers;

[Route("[controller]")]
//[Authorize]
[ApiController]
public class CustomerController(TelegramContext dbContext) : ControllerBase
{
    /// <summary>
    /// GET /customer — list customers, optionally filtered by locationId.
    /// Returns a flat DTO matching the frontend Resident type.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetCustomers([FromQuery] int? locationId)
    {
        var query = dbContext.PcmcCustomers
            .AsNoTracking()
            .Include(c => c.Locations).ThenInclude(cl => cl.Location)
            .Include(c => c.TelegramSessionContact)
                .ThenInclude(sc => sc!.TelegramContact)
            .Where(c => c.IsActive);

        if (locationId.HasValue)
            query = query.Where(c => c.Locations.Any(cl => cl.IsActive && cl.LocationId == locationId.Value));

        var customers = await query
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.Code,
                c.Name,
                c.Unit,
                telegram = c.TelegramHandle ?? string.Empty,
                phone = c.Phone ?? string.Empty,
                email = c.Email ?? string.Empty,
                locationIds = c.Locations.Where(cl => cl.IsActive).Select(cl => cl.LocationId).ToList(),
                locationName = c.Locations.Where(cl => cl.IsActive).Select(cl => cl.Location!.Name).FirstOrDefault() ?? string.Empty,
                c.IsActive,
                c.ChatImported,
                joinDate = c.JoinDate,
                c.Avatar,
                c.TelegramSessionContactId,
                profilePhoto = c.TelegramSessionContact != null
                    ? c.TelegramSessionContact.TelegramContact.ProfilePhoto
                    : null
            })
            .ToListAsync();

        return Ok(customers);
    }

    /// <summary>
    /// POST /customer — create a new customer.
    /// Body: { code, name, unit?, phone?, telegramHandle?, email?, telegramSessionContactId?, locationId }
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateCustomer([FromBody] CreateCustomerRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Code))
            return BadRequest(new { status = false, message = "Resident code is required." });

        if (string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { status = false, message = "Resident name is required." });

        if (body.LocationId <= 0)
            return BadRequest(new { status = false, message = "A valid locationId is required." });

        var propertyExists = await dbContext.PcmcProperties
            .AsNoTracking()
            .AnyAsync(p => p.Id == body.LocationId && p.IsActive);

        if (!propertyExists)
            return BadRequest(new { status = false, message = "Property not found or inactive." });

        // Identity is the resident Code. Importing the same code under another
        // property links the existing customer to that property (multi-location).
        var code = body.Code.Trim();
        var customer = await dbContext.PcmcCustomers
            .FirstOrDefaultAsync(c => c.IsActive && c.Code.ToLower() == code.ToLower());

        if (customer is null)
        {
            customer = new PcmcCustomer
            {
                Code = code,
                Name = body.Name.Trim(),
                Unit = body.Unit?.Trim(),
                Phone = body.Phone?.Trim(),
                TelegramHandle = body.TelegramHandle?.Trim(),
                Email = body.Email?.Trim(),
                Avatar = body.Avatar?.Trim(),
                TelegramSessionContactId = body.TelegramSessionContactId,
                IsActive = true,
                ChatImported = body.TelegramSessionContactId.HasValue,
                JoinDate = DateTime.UtcNow
            };
            dbContext.PcmcCustomers.Add(customer);
            await dbContext.SaveChangesAsync();
        }

        var linkExists = await dbContext.PcmcCustomerLocations
            .AnyAsync(cl => cl.CustomerId == customer.Id && cl.LocationId == body.LocationId && cl.IsActive);
        if (!linkExists)
        {
            dbContext.PcmcCustomerLocations.Add(new PcmcCustomerLocation { CustomerId = customer.Id, LocationId = body.LocationId });
            await dbContext.SaveChangesAsync();
        }

        return Ok(new { status = true, data = customer });
    }

    /// <summary>
    /// PUT /customer/{id} — update customer fields.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCustomer(int id, [FromBody] UpdateCustomerRequest body)
    {
        var customer = await dbContext.PcmcCustomers.FindAsync(id);
        if (customer is null)
            return NotFound(new { status = false, message = "Customer not found." });

        if (!string.IsNullOrWhiteSpace(body.Code))
            customer.Code = body.Code.Trim();

        if (!string.IsNullOrWhiteSpace(body.Name))
            customer.Name = body.Name.Trim();

        if (body.Unit is not null)
            customer.Unit = body.Unit.Trim();

        if (body.Phone is not null)
            customer.Phone = body.Phone.Trim();

        if (body.TelegramHandle is not null)
            customer.TelegramHandle = body.TelegramHandle.Trim();

        if (body.Email is not null)
            customer.Email = body.Email.Trim();

        if (body.Avatar is not null)
            customer.Avatar = body.Avatar.Trim();

        if (body.TelegramSessionContactId.HasValue)
            customer.TelegramSessionContactId = body.TelegramSessionContactId.Value;

        if (body.LocationId.HasValue && body.LocationId.Value > 0)
        {
            var exists = await dbContext.PcmcCustomerLocations
                .AnyAsync(cl => cl.CustomerId == id && cl.LocationId == body.LocationId.Value && cl.IsActive);
            if (!exists)
                dbContext.PcmcCustomerLocations.Add(new PcmcCustomerLocation { CustomerId = id, LocationId = body.LocationId.Value });
        }

        if (body.ChatImported.HasValue)
            customer.ChatImported = body.ChatImported.Value;

        await dbContext.SaveChangesAsync();

        return Ok(new { status = true, data = customer });
    }

    /// <summary>
    /// DELETE /customer/{id} — soft delete (set IsActive = false).
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCustomer(int id)
    {
        var customer = await dbContext.PcmcCustomers.FindAsync(id);
        if (customer is null)
            return NotFound(new { status = false, message = "Customer not found." });

        customer.IsActive = false;
        await dbContext.SaveChangesAsync();

        return Ok(new { status = true, message = "Customer deactivated." });
    }
}

public class CreateCustomerRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public string? Phone { get; set; }
    public string? TelegramHandle { get; set; }
    public string? Email { get; set; }
    public string? Avatar { get; set; }
    public long? TelegramSessionContactId { get; set; }
    public int LocationId { get; set; }
}

public class UpdateCustomerRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Unit { get; set; }
    public string? Phone { get; set; }
    public string? TelegramHandle { get; set; }
    public string? Email { get; set; }
    public string? Avatar { get; set; }
    public long? TelegramSessionContactId { get; set; }
    public int? LocationId { get; set; }
    public bool? ChatImported { get; set; }
}
