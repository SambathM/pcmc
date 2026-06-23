/// 
/// <author>@sambath999</author><br/>
/// <date>@15-07-2021</date><br/>
/// 
using Localize.Helper.Extensions;
using Localize.Helper.Extensions.Helpers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace Library.Extensions
{
    public static class KestrelServerExtension
    {
        public static IWebHostBuilder DecideUsingKestrel(this IWebHostBuilder builder)
        {
            var developmentEnv = (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? string.Empty)
                .Equals("Development", StringComparison.OrdinalIgnoreCase);

            Console.WriteLine("\n");
            Console.WriteLine(developmentEnv
                ? $"=> Host is running in development"
                : "=> Host is running in production");

            bool useIIS = Environment.GetEnvironmentVariable("ASPNETCORE_USE_IIS")?.Equals("True", StringComparison.OrdinalIgnoreCase) ?? false;

            if (!developmentEnv)
            {
                //Console.WriteLine(Web.IsLocalDev ? "===> LocalDev mode." : "===> Deployment Mode.");
                builder.UseKestrel(options =>
                {
                    options.ConfigureEndpoints();
                    options.ApplyKestrelServerConfigurations();
                });
            }
            else
            {
                Console.WriteLine("===> Using IIS integration.");
                builder.UseIISIntegration();
            }

            return builder;
        }

        private static void ApplyKestrelServerConfigurations(this KestrelServerOptions options)
        {
            var config = options.ApplicationServices.GetRequiredService<IConfiguration>()
                .GetSection("Kestrel").Get<KestrelServerConfiguration>() ?? new();

            options.Limits.MaxConcurrentConnections = null;
            //options.Limits.MaxConcurrentConnections = config.Limits.MaxConcurrentConnections;
            options.Limits.MaxRequestBodySize = config.Limits.MaxRequestBodySize.HumanToBytes();
            options.Limits.MaxRequestHeadersTotalSize = (int)config.Limits.MaxRequestHeadersTotalSize.HumanToBytes();

            if (config.Limits.Http2.MaxRequestHeaderFieldSize != null)
                options.Limits.Http2.MaxRequestHeaderFieldSize = (int)config.Limits.Http2.MaxRequestHeaderFieldSize.HumanToBytes();

            options.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(config.Tuning.KeepAliveTimeoutSeconds);
        }

        private static KestrelServerOptions ConfigureEndpoints(this KestrelServerOptions options)
        {
            var config = options.ApplicationServices.GetRequiredService<IConfiguration>();
            var endpoints = config.GetSection("HttpServer:Endpoints")
                .GetChildren()
                .ToDictionary(
                    s => s.Key,
                    s => s.Get<EndpointConfiguration>() ?? new EndpointConfiguration()
                );

            foreach (var (name, endpoint) in endpoints)
            {
                var isHttps = string.Equals(endpoint.Scheme, "https", StringComparison.OrdinalIgnoreCase);
                int port = endpoint.Port ?? (isHttps ? 443 : 80);

                foreach (var ip in GetIpAddresses(endpoint.Host))
                {
                    options.Listen(ip, port, opt =>
                        Worker.DoWhen(isHttps, () => opt.UseHttps(GenerateSelfSignedCertificate())));
                }
            }

            return options;
        }

        private static List<IPAddress> GetIpAddresses(string host)
        {
            return host?.ToLowerInvariant() switch
            {
                "localhost" => [IPAddress.IPv6Loopback, IPAddress.Loopback],
                string h when IPAddress.TryParse(h, out var ip) => [ip],
                _ => [IPAddress.IPv6Any]
            };
        }

        public static X509Certificate2 GenerateSelfSignedCertificate()
        {
            using var rsa = RSA.Create(2048);
            var request = new CertificateRequest("CN=localhost", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddYears(5));
            return new X509Certificate2(certificate.Export(X509ContentType.Pfx));
        }
    }

    public class EndpointConfiguration
    {
        public string Host { get; set; } = "localhost";
        public int? Port { get; set; }
        public string Scheme { get; set; } = "http";
    }


    public class KestrelServerConfiguration
    {
        public LimitsOptions Limits { get; set; } = new();
        public TuningOptions Tuning { get; set; } = new();
        public BodyLimitsOptions BodyLimits { get; set; } = new();

        public class LimitsOptions
        {
            public int MaxConcurrentConnections { get; set; } = 100;
            public string MaxRequestBodySize { get; set; } = "1gb";
            public string MaxRequestHeadersTotalSize { get; set; } = "128kb";
            public Http2Options Http2 { get; set; } = new();
        }

        public class Http2Options
        {
            public string MaxRequestHeaderFieldSize { get; set; } = null!;
        }

        public class TuningOptions
        {
            public int KeepAliveTimeoutSeconds { get; set; } = 120;
        }

        public class BodyLimitsOptions
        {
            public string MaxFormBodySize { get; set; } = "1gb";
        }
    }

}