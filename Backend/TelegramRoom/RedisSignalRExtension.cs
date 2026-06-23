using Localize.Logger;
using Microsoft.AspNetCore.SignalR;
using StackExchange.Redis;

namespace TelegramRoom
{
    // Simple locator populated once at startup
    internal static class RedisMultiplexerLocator
    {
        private static IConnectionMultiplexer? _mux;
        public static void Set(IConnectionMultiplexer mux)
            => _mux = mux;

        public static Task<IConnectionMultiplexer> Get()
            => Task.FromResult(_mux ?? throw new InvalidOperationException("No Redis connection available."));
    }

    public static class RedisSignalRExtension
    {
        private static readonly LocalizeLogger _logger = new(typeof(RedisCommandException));
        public static void AddRedisSignalRConfig(
            this IServiceCollection services,
            //Library.AppSettings.ConfigRedis config,
            Action<HubOptions>? configure = null)
        {
            var builder = configure != null ? services.AddSignalR(configure) : services.AddSignalR();

            //_logger.Info("===> Using SignalR with RedisBackplane: {0}", config.UseAsBackplane);

            // Capture the shared multiplexer once when the container is built
            services.AddSingleton<IStartupFilter>(new StartupFilter(sp =>
            {
                var mux = sp.GetService<IConnectionMultiplexer>();
                if (mux != null) RedisMultiplexerLocator.Set(mux);
            }));

            //if (config.UseAsBackplane)
            //{
            //_logger.Info("===> Connecting to Redis at: {0}", config.Settings.Host);
            builder.AddRedisConfiguration(/*config*/);
            //}
        }

        private static void AddRedisConfiguration(this ISignalRServerBuilder builder/*, Library.AppSettings.ConfigRedis redisConfig*/)
        {
            builder.AddStackExchangeRedis(options =>
            {
                options.ConnectionFactory = (_) =>
                {
                    return RedisMultiplexerLocator.Get()
                        ?? throw new InvalidOperationException("No Redis connection available.");
                };
            });
        }
    }

    // Helper IStartupFilter to capture DI after the container builds
    internal sealed class StartupFilter(Action<IServiceProvider> onBuild) : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
        {
            return app =>
            {
                onBuild(app.ApplicationServices);
                next(app);
            };
        }
    }
}
