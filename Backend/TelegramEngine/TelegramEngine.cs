using Library;
using Library.Models;
using Library.PgBouncer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TelegramEngine.Data;
using TelegramEngine.Logics;
using TelegramEngine.Services;

namespace TelegramEngine;

public class TelegramOptions
{
    public int InstanceTimeoutMinutes { get; set; } = 3;
    public int ActiveActionTimeoutMinutes { get; set; } = 30;
    public int QrCodeInstanceTimeoutMinutes { get; set; } = 3;
    public int CleanupIntervalMilliseconds { get; set; } = 5_000;
    public int VerboseLogEveryRounds { get; set; } = 2;

    public Func<string, string, object, IServiceProvider, Task> SendMessageAsync { get; set; } = null!;

    public TServerConfig ServerConfig { get; set; } = null!;

    public TelegramStateEvents StateEvents { get; set; } = null!;
}

public class TelegramStateEvents
{
    public Action<TInstance, string> OnAuthorized { get; set; } = null!;
    public Action<TelegramSession> OnLoggedIn { get; set; } = null!;
    public Action<TelegramSession> OnLoggedOut { get; set; } = null!;
    public Action<TelegramSession, string> OnDisconnectedOrAuthRestart { get; set; } = null!;

}

public class TServerConfig
{
    public int ApiId { get; set; }
    public string? ApiHash { get; set; }
    public string? Host { get; set; }
}

public static class LocalizeTelegramExtensions
{
    public static void AddTelegramEngine(
        this IServiceCollection services,
        IConfiguration configuration,
        Action<TelegramOptions> optionAction)
    {
        var (_, appSettings) =
            services.AddLibraryServicesCollection(configuration);

        var options = new TelegramOptions();
        optionAction(options);
        options.ServerConfig ??= CreateServerConfig(appSettings.TelegramConfig);
        services.AddSingleton(options);


        services.AddTransient<ITelegramService, TelegramService>();
        services.AddTransient<ITelegramContactService, TelegramContactService>();
        // Lazy<> breaks the ITelegramService <-> ITelegramContactService circular dependency
        services.AddTransient<Lazy<ITelegramContactService>>(sp =>
            new Lazy<ITelegramContactService>(sp.GetRequiredService<ITelegramContactService>));
        services.AddTransient<ITelegramMessageService, TelegramMessageService>();
        services.AddTransient<ITelegramQrService, TelegramQrService>();
        services.AddTransient<ITelegramPhoneService, TelegramPhoneService>();
        services.AddTransient<ITelegramSessionService, TelegramSessionService>();

        services.AddScoped<ISignalRHubService, SignalRHubService>();

        services.AddSingleton<TelegramInstances>();
        services.AddHostedService(sp => sp.GetRequiredService<TelegramInstances>());

        services.AddPgBouncerContextHandler()
            .AddContext<TelegramContext>(appSettings.ConnectionString);
    }

    private static TServerConfig CreateServerConfig(TelegramConfig telegramConfig)
    {
        var host = AppSettings.Branch.Equals("dev", StringComparison.OrdinalIgnoreCase)
            ? telegramConfig?.Hosts?.DevHost
            : telegramConfig?.Hosts?.ProdHost;

        host ??= telegramConfig?.Hosts?.DevHost ?? telegramConfig?.Hosts?.ProdHost;

        return new()
        {
            ApiId = telegramConfig?.ApiId ?? 0,
            ApiHash = telegramConfig?.ApiHash,
            Host = host
        };
    }
}
