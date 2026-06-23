using Microsoft.AspNetCore.Mvc;
using TelegramRoom.Services;

namespace TelegramRoom.Controllers;

[Route("api/[controller]")]
[ApiController]
public class LoginController(
    IApiLoginService loginService) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IDILoginResult> LoginAsync([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username))
            return new() { Status = false, Message = "Invalid username or password" };

        if (string.IsNullOrWhiteSpace(request.Password))
            return new() { Status = false, Message = "Invalid username or password" };

        var result =
            await loginService.LoginAsync(
                request,
                Library.Models.ESessionType.WebApp,
                Library.Models.EAuthGrantType.Password);

        return result;
    }
}


public class LoginRequest
{
    public string? Username { get; set; }
    public string? Password { get; set; }
}
