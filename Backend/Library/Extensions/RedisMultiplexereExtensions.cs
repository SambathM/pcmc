using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Library.Extensions
{
    public sealed class RecRedisConfig
    {
        public bool AbortOnConnectFail { get; set; } = false;
        public int ConnectTimeout { get; set; } = 20000;
        public int SyncTimeout { get; set; } = 30000;
        public int AsyncTimeout { get; set; } = 30000;
        public int KeepAlive { get; set; } = 60;
        public int ConnectRetry { get; set; } = 5;
        public int ReconnectRetryPolicyMs { get; set; } = 5000;
        public bool ResolveDns { get; set; } = true;
    }

    internal static class RedisMultiplexereExtensions
    {
        internal static void AddRedisMultiplexerConfiguration(this IServiceCollection services)
        {
            if (services.Any(s => s.ServiceType == typeof(IConnectionMultiplexer)))
                return;

            services.AddSingleton<IConnectionMultiplexer>(sp =>
            {
                var redisOptions = BuildOptions(sp);
                var mux = ConnectionMultiplexer.Connect(redisOptions);
                var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Redis");
                mux.ConnectionFailed += (_, a) => logger.LogError(a.Exception, "Redis connection failed: {FailureType}", a.FailureType);
                mux.ConnectionRestored += (_, a) => logger.LogInformation("Redis connection restored: {FailureType}", a.FailureType);
                return mux;
            });

            // Create a single RedisCache instance that reuses the shared multiplexer
            services.AddSingleton(sp =>
            {
                var options = new RedisCacheOptions
                {
                    ConnectionMultiplexerFactory = () =>
                        Task.FromResult(sp.GetRequiredService<IConnectionMultiplexer>())
                };
                return new RedisCache(options);
            });

            // Expose it both as RedisCache and IDistributedCache to avoid breaks
            services.AddSingleton<IDistributedCache>(sp => sp.GetRequiredService<RedisCache>());
        }

        private static ConfigurationOptions BuildOptions(IServiceProvider svp)
        {
            var appSettings = svp.GetRequiredService<AppSettings>();
            var env = svp.GetRequiredService<IHostEnvironment>();

            var settings = appSettings.Configs.Redis.Settings;
            RecRedisConfig options =
                svp.GetService<IOptions<RecRedisConfig>>()?.Value
                    ?? new();

            var envPrefix = env.IsDevelopment() ? "Dev" : "Prod";
            var channelPrefix = AppSettings.DockerDev
                ? $"nearrsar:{AppSettings.Branch}:{envPrefix}:docker:"
                : $"nearrsar:{AppSettings.Branch}:{envPrefix}:";

            var config = new ConfigurationOptions
            {
                AbortOnConnectFail = options.AbortOnConnectFail,
                Password = settings.Password,
                ConnectTimeout = options.ConnectTimeout,
                SyncTimeout = options.SyncTimeout,
                AsyncTimeout = options.AsyncTimeout,
                KeepAlive = options.KeepAlive,
                ConnectRetry = options.ConnectRetry,
                ReconnectRetryPolicy = new ExponentialRetry(options.ReconnectRetryPolicyMs),
                ResolveDns = options.ResolveDns,
                TieBreaker = string.Empty,
                ClientName = $"{AppSettings.Branch}-{Environment.MachineName}",
                ChannelPrefix = RedisChannel.Literal(channelPrefix)
            };

            config.EndPoints.Add(
                settings.Host
                ?? throw new InvalidOperationException("Redis host is not set."));

            return config;
        }
    }
}
