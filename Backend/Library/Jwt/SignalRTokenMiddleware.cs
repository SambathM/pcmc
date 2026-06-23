using Microsoft.AspNetCore.Http;
using Microsoft.IdentityModel.Tokens;

namespace Library.Jwt;

/// <summary>
/// override bearer token when WebSocket requested without bearer token included
/// </summary>
public class SignalRTokenMiddleware(RequestDelegate next)
{
    public async Task Invoke(HttpContext context)
    {
        var __token = context.Request.Query["access_token"];
        if (context.Request.Path.Equals("/localizehub", StringComparison.OrdinalIgnoreCase) && !__token.IsNullOrEmpty())
        {
            //passing bearer token from query string to header
            //to allow this request from WebSocket is valid with jwt validation
            try
            {
                context.Request.Headers.Append("Authorization", $"Bearer {__token}");
                //context.Response.OnStarting(() => Task.FromResult(context.Request.Headers.TryAdd("Authorization", $"Bearer {__token}")));
            }
            catch { }
            ;

            await next(context);
        }
    }

}
