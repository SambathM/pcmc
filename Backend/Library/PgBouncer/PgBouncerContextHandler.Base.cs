using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Collections.Concurrent;
using System.Reflection;
using System.Text.RegularExpressions;
using static Library.PgBouncer.PgBouncerContextHandler;

namespace Library.PgBouncer;

public class PgBouncerContextHandlerOptions
{
    public int MaxRetryAttempts { get; set; } = 5;
    public int RetryDelayMilliseconds { get; set; } = 500;
    public Func<Exception, bool>? ShouldRetrytFunc { get; set; }
    private int _retryAttempts = 0;
    internal void Attempt() => _retryAttempts++;
    public int RetryAttempts => _retryAttempts;
    /// <summary>
    /// Whether to retry on transient errors when PgBouncer is not ready. Default is true. If false, will throw immediately on PgBouncer connection failure without retrying.
    /// </summary>
    public bool RetryOnTransientErrors { get; set; } = true;
}

internal sealed record ConstructorInfoRec(ConstructorInfo Constructor, int ParamCount);
public record RecPgBouncer(int Port, string? Host = null);

internal partial class PgBouncerContextHandler
{
    private static readonly Random _random = new();
    internal sealed record RecConnectionStringObject(string PgBouncerConnString, string DirectConnString, string? OriginalConnString = null);

    private static readonly ConcurrentDictionary<string, RecConnectionStringObject> _connStringCache = [];
    private static readonly ConcurrentDictionary<string, ConstructorInfoRec> _cacheConstructor = [];

    private RecConnectionStringObject CreateOrAddCache(string connStringOrDbName)
    {
        var created = _connStringCache.GetOrAdd(connStringOrDbName, _ =>
        {
            string? originalConnString = null;
            string dbName;

            if (IsConnectionString(connStringOrDbName, out var parsedDb))
            {
                originalConnString = connStringOrDbName;
                dbName = parsedDb;
            }
            else
            {
                // Input is already a db name
                dbName = connStringOrDbName;
            }

            var baseConn = _appSettings.ConnectionString;
            var directConn = RegExpressions.RegexPgDatabase().Replace(baseConn, $"Database={dbName};");
            directConn = AppendPoolingOptions(directConn);

            var pgBouncerConn = RegExpressions.RegexPgServer().Replace(
                RegExpressions.RegexPgPort().Replace(directConn, $"Port={_pgBouncerConfig.Port};"),
                $"Server={_pgBouncerHost};"
            );

            // Disable client-side pooling/multiplexing for PgBouncer connections
            if (!pgBouncerConn.Contains("Pooling=", StringComparison.OrdinalIgnoreCase))
                pgBouncerConn += (pgBouncerConn.EndsWith(';') ? "" : ";") + "Pooling=false;";
            if (!pgBouncerConn.Contains("Multiplexing=", StringComparison.OrdinalIgnoreCase))
                pgBouncerConn += "Multiplexing=false;";

            var obj = new RecConnectionStringObject(
                PgBouncerConnString: pgBouncerConn,
                DirectConnString: directConn,
                OriginalConnString: originalConnString
            );

            // Cache under canonical dbName and also original string (if provided)
            _connStringCache.TryAdd(dbName ?? string.Empty, obj);
            if (!string.IsNullOrWhiteSpace(originalConnString))
                _connStringCache.TryAdd(originalConnString, obj);

            return obj;
        });

        return created;
    }

    private static async Task JitteredDelay(DateTime startTime, int jitterMilliseconds, CancellationToken ct)
    {
        var baseDelay = TimeSpan.FromMicroseconds(500);
        var jitter = TimeSpan.FromMicroseconds(_random.Next(0, jitterMilliseconds));
        var delay = baseDelay + jitter;
        var elapsed = DateTime.UtcNow - startTime;
        var remaining = delay - elapsed;
        if (remaining > TimeSpan.Zero)
        {
            await Task.Delay(remaining, ct);
        }
    }

    private TContext CreateDbContext<TContext>(string? connStringOrDbName = null)
        where TContext : DbContext
    {
        var (directConn, pgBouncerConn) = GetConnectionStrings(connStringOrDbName
            ?? throw new ArgumentNullException(nameof(connStringOrDbName)));
        string activeConn = _probe.IsReady ? pgBouncerConn : directConn;
        return BuildContext<TContext>(activeConn);
    }

    private static bool TryGetCached(string connStringOrDbName, out RecConnectionStringObject connObj)
    {
        // Exact key first
        if (_connStringCache.TryGetValue(connStringOrDbName, out connObj!))
            return true;

        // If it's a connection string, normalize to dbName and try that key
        if (IsConnectionString(connStringOrDbName, out var dbName))
            return _connStringCache.TryGetValue(dbName ?? string.Empty, out connObj!);

        // Otherwise treat input as dbName
        return _connStringCache.TryGetValue(connStringOrDbName, out connObj!);
    }

    private static bool IsConnectionString(string input, out string dbName)
    {
        dbName = input;
        if (input.Contains("Server=", StringComparison.OrdinalIgnoreCase) ||
            input.Contains("Host=", StringComparison.OrdinalIgnoreCase))
        {
            dbName = RegExpressions.RegexPgDatabase().Match(input).Groups[1].Value;
            return true;
        }
        return false;
    }


    private static string AppendPoolingOptions(string conn)
    {
        static bool HasKey(string c, string key) => c.Contains($"{key}=", StringComparison.OrdinalIgnoreCase);

        var parts = new List<string>();

        if (!HasKey(conn, "Pooling")) parts.Add("Pooling=true;");
        // Avoid multiplexing by default; PgBouncer handles pooling/multiplexing at its layer.
        if (!HasKey(conn, "Multiplexing")) parts.Add("Multiplexing=false;");
        if (!HasKey(conn, "Maximum Pool Size")) parts.Add("Maximum Pool Size=100;");
        if (!HasKey(conn, "Minimum Pool Size")) parts.Add("Minimum Pool Size=5;");
        if (!HasKey(conn, "Timeout")) parts.Add("Timeout=3;");

        return parts.Count == 0 ? conn : $"{conn}{(conn.EndsWith(';') ? "" : ";")}{string.Join(string.Empty, parts)}";
    }

    internal static TContext BuildContext<TContext>(string connString)
        where TContext : DbContext
    {
        var options = new DbContextOptionsBuilder<TContext>()
            .UseNpgsql(connString, npgsql => npgsql.CommandTimeout(3))
            .Options;

        var typeContext = typeof(TContext);
        var compositeKey = typeContext.AssemblyQualifiedName ?? typeContext.FullName ?? typeContext.Name;

        if (_cacheConstructor.TryGetValue(compositeKey, out var info))
        {

            return info.ParamCount == 1
                ? (TContext)info.Constructor.Invoke([options])
                : (TContext)info.Constructor.Invoke([options, null]);
        }

        static bool IsValidParameter(ParameterInfo p) =>
             p.ParameterType == typeof(DbContextOptions<TContext>) ||
             p.ParameterType == typeof(DbContextOptions) ||
             p.ParameterType.IsAssignableFrom(typeof(DbContextOptions<TContext>));

        foreach (var constructor in typeContext.GetConstructors())
        {
            var parameters = constructor.GetParameters();
            if (parameters.Length == 1 && IsValidParameter(parameters[0]))
            {
                _cacheConstructor[compositeKey] = new ConstructorInfoRec(constructor, 1);
                return (TContext)constructor.Invoke([options]);
            }
            if (parameters.Length == 2 && IsValidParameter(parameters[0]))
            {
                _cacheConstructor[compositeKey] = new ConstructorInfoRec(constructor, 2);
                return (TContext)constructor.Invoke([options, null]);
            }
        }

        throw new InvalidOperationException($"No suitable constructor found for {typeof(TContext).Name}.");
    }


}

internal static partial class RegExpressions
{
    // Fix: Remove ^ from pattern to match Port=xxxx; anywhere in the string
    [GeneratedRegex(@"Port=\d+;", RegexOptions.Compiled)]
    internal static partial Regex RegexPgPort();

    [GeneratedRegex(@"Database=([^;]+);", RegexOptions.Compiled)]
    internal static partial Regex RegexPgDatabase();

    [GeneratedRegex(@"Server=([^;]+);", RegexOptions.Compiled)]
    internal static partial Regex RegexPgServer();


    internal static IServiceCollection AddPgBouncerHelper(this IServiceCollection services)
    {
        services.AddSingleton<PgBouncerContextHandlerProbe>();
        services.AddHostedService(sp => sp.GetRequiredService<PgBouncerContextHandlerProbe>());

        services.AddSingleton<IPgBouncerContextHandler, PgBouncerContextHandler>();
        return services;
    }
}
