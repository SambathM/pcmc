using Microsoft.AspNetCore.HttpOverrides;
using System.Net;

namespace TelegramRoom;

public static class SecurityHttpHeader
{
    public static void AddForwardedHeaderOptions(this IServiceCollection services,
        IConfiguration configuration)
    {
        var forwardedSettings = configuration.GetSection("ForwardedHeaders").Get<ForwardedHeadersSettings>();

        // Forwarded headers for proxy servers (GKE / NGINX)
        // Simply call app.UseForwardedHeaders() in Startup.cs after this registration
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

            // Register known proxies
            foreach (var proxy in forwardedSettings?.KnownProxies ?? [])
            {
                if (IPAddress.TryParse(proxy, out var ip))
                    options.KnownProxies.Add(ip);
            }

            // Register known networks (CIDR)
            foreach (var net in forwardedSettings?.KnownNetworks ?? [])
            {
                if (Microsoft.AspNetCore.HttpOverrides.IPNetwork.TryParse(net, out var network))
                    options.KnownNetworks.Add(network);
            }

            // Safety fallback: allow localhost if nothing is configured
            if (!options.KnownProxies.Any() && !options.KnownNetworks.Any())
            {
                options.KnownProxies.Add(IPAddress.Loopback);
                options.KnownProxies.Add(IPAddress.IPv6Loopback);
            }
        });
    }
}

public class ForwardedHeadersSettings
{
    public string[] KnownProxies { get; set; } = [];
    public string[] KnownNetworks { get; set; } = [];
}

