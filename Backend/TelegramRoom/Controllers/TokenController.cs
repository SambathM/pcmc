using Localize.Logger;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TelegramRoom.Services;

namespace TelegramRoom.Controllers
{
    [AllowAnonymous]
    [Route("api/[controller]")]
    [ApiController]
    public class TokenController(ITokenService tokenService,
        IWebConfig webConfig,
        ILocalizeLogger<TokenController> logger) : Controller
    {

        [HttpGet("refresh")]
        public async Task<IActionResult> RefreshAsync()
        {
            try
            {
                // Force specific headers that nginx might be expecting
                Response.Headers.Connection = "keep-alive";
                Response.Headers.CacheControl = "no-cache, no-store";

                return Ok(new TokenResponse(true, "Hit"));
            }
            catch (Exception ex)
            {
                logger.Error("Refresh failed {ex}", ex.ToString());
                return StatusCode(500, new TokenResponse(false, "Internal error"));
            }
        }

        [AllowAnonymous]
        [HttpGet("test-raw-json")]
        public IActionResult TestRawJson()
        {
            var json = "{\"status\":true,\"message\":\"raw json\"}";
            return Content(json, "application/json");
        }

        [AllowAnonymous]
        [HttpGet("renew")]
        public async Task<IActionResult> RenewAsync()
        {
            var response = await tokenService.RenewTokenAsync();
            return response.Status
                ? Ok(response)
                : Unauthorized(response);
        }

        [AllowAnonymous]
        [HttpPost("logout")]
        public async Task<IActionResult> LogoutAsync()
        {
            var response = await tokenService.LogoutAsync();
            // Always clear the browser's auth cookies, even if the session was already
            // gone, so the client ends up in a clean signed-out state.
            webConfig.ClearAuthCookies();
            return Ok(response);
        }

    }

    public record TokenResponse(bool Status, string Message, int? ExpiresIn = null);
}
