using Localize.Logger;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Npgsql;
using StackExchange.Redis;

namespace Library.PgBouncer;

public sealed class PgBouncerHealthProbe(IWebHostEnvironment env)
{
    private static string? _redisStateKey;
    public string RedisStateKey
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(_redisStateKey))
                return _redisStateKey;

            var envPrefix = AppSettings.Branch;
            _redisStateKey = AppSettings.DockerDev ? $"{envPrefix}dockerdev" : $"{envPrefix}";
            _redisStateKey = $"{_redisStateKey}:{AppSettings.Branch}:pgbouncer:health:state";
            if (env.IsDevelopment() || AppSettings.DockerDev)
                _redisStateKey = $"{Environment.MachineName.ToLowerInvariant()}:{_redisStateKey}".ToLowerInvariant();

            return _redisStateKey;
        }
    }
}

internal partial class PgBouncerContextHandler
{
    internal class PgBouncerContextHandlerProbe(
        ILocalizeLogger<PgBouncerContextHandlerProbe> logger,
        IConnectionMultiplexer mux,
        IWebHostEnvironment env,
        AppSettings appSettings,
        IServiceProvider svp) : BackgroundService
    {
        private volatile bool _isReady = false;
        private static readonly object _lock = new();
        private readonly PgBouncerHealthProbe _healthProbe = new(env);
        internal string TopicName
        {
            get
            {
                var envPrefix = env.IsDevelopment() ? "Dev" : "Prod";
                return AppSettings.DockerDev
                     ? $"{envPrefix}DockerDev{AppSettings.Branch}PgBouncerStatus"
                     : $"{envPrefix}{AppSettings.Branch}PgBouncerStatus";
            }
        }

        private readonly IDatabase _redis = mux.GetDatabase();

        public bool IsReady => _isReady;

        public void SetStatus(bool isReady)
        {
            if (isReady == _isReady) return;
            lock (_lock)
            {
                _isReady = isReady;
            }
        }


        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await TryPgBouncerFirstConnectAsync(stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await FallbackToRedisAsync();
                }
                catch (Exception ex)
                {
                    logger.Error("Error connecting to Redis: {Message}", ex.Message);
                }

                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }

        private async Task FallbackToRedisAsync()
        {
            try
            {
                var state = await _redis.StringGetAsync(_healthProbe.RedisStateKey);
                if (state.HasValue)
                {
                    bool availability = (bool)state;
                    SetStatus(availability);
                }
            }
            catch (Exception ex)
            {
                logger.Error("Error connecting to Redis: {Message}", ex.Message);
            }
        }

        private async Task TryPgBouncerFirstConnectAsync(CancellationToken stoppingToken)
        {
            // Get Helper Service to prevent circular dependency issues
            var handler = svp.GetRequiredService<IPgBouncerContextHandler>();
            var (_, pgBouncerConnString) = handler.GetConnectionStrings(appSettings.ConnectionString);
            var isReady = false;
            try
            {
                using var connection = new NpgsqlConnection(pgBouncerConnString);
                await connection.OpenAsync(stoppingToken);
                using var cmd = new NpgsqlCommand("SELECT 1;", connection);
                await cmd.ExecuteScalarAsync(stoppingToken);
                isReady = true;
            }
            catch (Exception ex)
            {
                logger.Error("Error connecting to PgBouncer: {Message}", ex.Message);
            }

            SetStatus(isReady);
        }


    }
}

