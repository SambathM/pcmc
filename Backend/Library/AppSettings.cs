using Library.Extensions;
using Library.Models;
using Library.PgBouncer;

namespace Library;

public sealed class AppSettings
{
    public static IServiceProvider ServiceProvider { get; private set; } = null!;
    public static void SetServiceProvider(IServiceProvider serviceProvider)
        => ServiceProvider = serviceProvider;

    public static string EnvKeyPrefix => DockerDev
            ? $"{Environment.MachineName}:docker"
            : Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")?.ToString().ToLower() == "development"
                ? $"{Environment.MachineName}:dev"
                : Branch.ToLower();

    public static string Branch
    {
        get
        {
            var branch = Environment.GetEnvironmentVariable("GIT_BRANCH");
            return string.IsNullOrWhiteSpace(branch) ? "dev" : branch;
        }

    }

    public static bool DockerDev
    {
        get
        {
            var dockerDev = Environment.GetEnvironmentVariable("DOCKER_DEV");
            return !string.IsNullOrWhiteSpace(dockerDev)
                    && bool.TryParse(dockerDev, out var result)
                    && result;
        }
    }

    public string MainDomain { get; set; } = "localize.dev";
    public string ConnectionString { get; set; } = string.Empty;
    public SignalRConfigs SignalR { get; set; } = new();
    public TelegramConfig TelegramConfig { get; set; } = new();
    public GoogleConfig GoogleConfig { get; set; } = new();

    public RecPgBouncer PgBouncer { get; set; } = new(6432);

    public AppSettingsConfigs Configs { get; set; } = new();

    public class SignalRConfigs
    {
        public string DefaultGroupName { get; set; } = "7f8c9e1b-3a2d-4c5e-9f0a-1b2c3d4e5f6g";
    }

    public class AppSettingsConfigs
    {

        public ConfigsHeaders Headers { get; set; } = new();
        public ConfigsKeys Keys { get; set; } = new();

        public ConfigsSecrets Secrets { get; set; } = new();

        public ConfigRedis Redis { get; set; } = new();
    }


    public class ConfigsSecrets
    {
        public string BackendSecret { get; set; } = string.Empty;
        public string RsaPrivateKeyBase64 { get; set; } = string.Empty;

        public string RefreshTokenKey { get; set; } = string.Empty;

        public string EncryptionKey { get; set; } = string.Empty;
    }

    public class ConfigsHeaders
    {
        public string XRefreshToken { get; set; } = string.Empty;
        public string XBackend { get; set; } = string.Empty;
        public string XTenant { get; set; } = string.Empty;
    }

    public class ConfigsKeys
    {
        public string RefreshToken { get; set; } = string.Empty;
        public string ApiToken { get; set; } = string.Empty;
        public string TenantNameToken { get; set; } = string.Empty;
    }

    public class ConfigRedis
    {
        public const string RedisConfigKey = "RedisConfig";

        public bool UseAsBackplane { get; set; }

        public SettingsConfig Settings { get; set; } = new();

        public class SettingsConfig
        {
            public string? Host { get; set; }

            public string? Password { get; set; }
        }
    }
}


public sealed class GoogleConfig
{
    public string GcloudStorageBucket { get; set; } = string.Empty;

    public string GcloudStorageCredentialsBase64 { get; set; } = string.Empty;

    public string GcloudStorageCredentialsJson
        => string.IsNullOrWhiteSpace(GcloudStorageCredentialsBase64)
        ? throw new InvalidOperationException("GcloudStorageCredentialsBase64 is not set.")
        : GcloudStorageCredentialsBase64.TryFromBase64String(out var result) && !string.IsNullOrWhiteSpace(result)
            ? result
            : throw new InvalidOperationException("GcloudStorageCredentialsBase64 is not a valid base64 string.");
}

