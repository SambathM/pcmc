using Localize.Logger;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Npgsql;

namespace Library.PgBouncer
{
    public interface IPgBouncerContextHandler
    {
        bool IsPgBouncerAvailable { get; }
        Task<TResult> ExecuteWithRetryAsync<TResult, TContext>(
            string connStringOrDbName, Func<TContext, Task<TResult>> action,
            Action<PgBouncerContextHandlerOptions>? onOptions = null,
            CancellationToken ct = default) where TContext : DbContext;

        Task ExecuteWithRetryAsync<TContext>(
            string connStringOrDbName,
            Func<TContext, Task> action,
            Action<PgBouncerContextHandlerOptions>? onOptions = null,
            CancellationToken ct = default) where TContext : DbContext;

        (Func<Task<NpgsqlConnection>> connectionFactory, string connString) GetConnectionFactory(string dbName);
        (string direct, string pgBouncer) GetConnectionStrings(string connStringOrDbName);
        void SetAvailability(bool available);
    }

    internal partial class PgBouncerContextHandler : IPgBouncerContextHandler
    {
        private readonly RecPgBouncer _pgBouncerConfig;
        private readonly string _pgBouncerHost;

        private readonly PgBouncerContextHandlerProbe _probe;
        private readonly ILocalizeLogger<PgBouncerContextHandler> _logger;
        private readonly IWebHostEnvironment _env;
        private readonly AppSettings _appSettings;

        public PgBouncerContextHandler(
            AppSettings appSettings,
            IConfiguration configuration,
            PgBouncerContextHandlerProbe probe,
            IWebHostEnvironment env,
            ILocalizeLogger<PgBouncerContextHandler> logger
        )
        {
            _env = env;
            _appSettings = appSettings;
            _logger = logger;
            _probe = probe;
            _pgBouncerConfig = configuration
                .GetSection("PgBouncer")
                .Get<RecPgBouncer>() ?? new(env.IsDevelopment() ? 6433 : 6432);

            _pgBouncerHost = new Uri(_appSettings.PgBouncer.Host ?? "http://localhost").Host;
        }

        public bool IsPgBouncerAvailable => _probe.IsReady;
        public void SetAvailability(bool available) => _probe.SetStatus(available);

        public async Task<TResult> ExecuteWithRetryAsync<TResult, TContext>(
            string connStringOrDbName,
            Func<TContext, Task<TResult>> action,
            Action<PgBouncerContextHandlerOptions>? onOptions = null,
            CancellationToken ct = default)
            where TContext : DbContext
        {
            var options = new PgBouncerContextHandlerOptions();
            onOptions?.Invoke(options);

            while (options.RetryAttempts < options.MaxRetryAttempts)
            {
                if (ct.IsCancellationRequested == true) return default!;
                var startTime = DateTime.UtcNow;

                async Task OnExceptionAsync(Exception ex, bool reportFailure = true)
                {
                    options.Attempt();
                    _logger.WarnCaller($"Attempt {options.RetryAttempts} failed: {ex.Message}. Retrying in {options.RetryDelayMilliseconds}ms...");

                    // Force direct connection next time
                    if (reportFailure)
                        SetAvailability(false);

                    await JitteredDelay(startTime, options.RetryDelayMilliseconds, ct);
                }

                try
                {
                    using var ctx = CreateDbContext<TContext>(connStringOrDbName);
                    return await action(ctx);
                }
                catch (Exception ex) when
                (
                    (options.RetryOnTransientErrors && ex.IsPostgresqlConcurrentError(out var state))
                    || options.ShouldRetrytFunc?.Invoke(ex) == true
                )
                {
                    // Retry but not report as PgBouncer failure since it may be a transient concurrency issue
                    await OnExceptionAsync(ex, false);
                }
                catch (Exception ex) when (ex.IsPostgresqlConnectionException(out _))
                {
                    // Report as PgBouncer failure and retry
                    await OnExceptionAsync(ex);
                }
            }
            _logger.ErrorCaller($"Max retry attempts ({options.MaxRetryAttempts}) reached.");
            return default!;
        }

        public async Task ExecuteWithRetryAsync<TContext>(
            string connStringOrDbName,
            Func<TContext, Task> action,
            Action<PgBouncerContextHandlerOptions>? onOptions = null,
            CancellationToken ct = default)
            where TContext : DbContext
        {
            await ExecuteWithRetryAsync<object, TContext>(connStringOrDbName,
                async (ctx) =>
                {
                    await action(ctx);
                    return new object();
                }, onOptions, ct);
        }


        public (Func<Task<NpgsqlConnection>> connectionFactory, string connString) GetConnectionFactory(string connStringOrDbName)
        {
            var (directConn, pgBouncerConn) = GetConnectionStrings(connStringOrDbName);
            var activeConn = _probe.IsReady ? pgBouncerConn : directConn;

            async Task<NpgsqlConnection> OpenConnectionAsync(string connString)
            {
                var connection = new NpgsqlConnection(connString);
                if (connection.State != System.Data.ConnectionState.Open)
                    await connection.OpenAsync();
                return connection;
            }

            async Task<NpgsqlConnection> factory()
            {
                try
                {
                    var connection = await OpenConnectionAsync(activeConn);
                    if (_env.IsDevelopment())
                        _logger.SuccessCaller($"Connected to {(activeConn == pgBouncerConn ? "PgBouncer" : "direct")}.");
                    return connection;
                }
                catch (Exception ex)
                {
                    _logger.WarnCaller($"Connection failed ({ex.Message}). Falling back to direct connection.");
                    return await OpenConnectionAsync(directConn);
                }
            }

            return (factory, activeConn);
        }

        public (string direct, string pgBouncer) GetConnectionStrings(string connStringOrDbName)
        {
            // Ensure non-null
            if (string.IsNullOrWhiteSpace(connStringOrDbName))
                throw new ArgumentNullException(nameof(connStringOrDbName));

            if (TryGetCached(connStringOrDbName, out var cached))
                return (cached.DirectConnString, cached.PgBouncerConnString);

            var created = CreateOrAddCache(connStringOrDbName);

            return (created.DirectConnString, created.PgBouncerConnString);
        }

    }

}
