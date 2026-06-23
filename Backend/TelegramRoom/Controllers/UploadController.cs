using Library.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TelegramRoom.Controllers;

[ApiController]
[Route("upload")]
[Authorize]
public class UploadController(IGoogleCloudStorage storage) : ControllerBase
{
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/gif", "image/webp"
    };

    [HttpPost("image")]
    [RequestSizeLimit(5_242_880)] // 5 MB
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });

        if (!AllowedTypes.Contains(file.ContentType))
            return BadRequest(new { error = "Only JPEG, PNG, GIF, or WebP images are allowed." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext))
            ext = file.ContentType.Contains("png") ? ".png" : ".jpg";

        var fileName = $"pcmc/{Guid.NewGuid():N}{ext}";
        var url = await storage.UploadFormFileAsync(file, fileName, file.ContentType, isPublic: true);

        if (url == null)
            return StatusCode(500, new { error = "Upload to storage failed." });

        return Ok(new { url });
    }
}
