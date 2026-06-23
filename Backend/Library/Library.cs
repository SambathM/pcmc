using Library.Extensions;
using Library.Http;
using Library.PgBouncer;
using Library.Services;
using Library.Services.QueueBackgroundTasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
namespace Library;

public static class Library
{
    public static (IServiceCollection, AppSettings) AddLibraryServicesCollection(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        AppSettings appSettings = configuration.Get<AppSettings>()
                ?? throw new InvalidOperationException("AppSettings configuration is missing.");

        services.AddRedisMultiplexerConfiguration();

        services.AddSingleton(appSettings);

        services.AddTransient<IWebService, WebService>();

        services.AddScoped<IGoogleCloudStorage, GoogleCloudStorage>();
        services.AddScoped<IHttpHelper, HttpHelper>();


        services.AddPgBouncerHelper();
        services.AddSingleton<RsaCryptoResolver>();

        // Background task queue throttle service for string tasks
        services.AddSingleton<BackgroundTaskQueueService>();
        services.AddSingleton<IBackgroundTaskQueueService>(sp =>
            sp.GetRequiredService<BackgroundTaskQueueService>());
        services.AddHostedService(sp =>
            sp.GetRequiredService<BackgroundTaskQueueService>());

        // Throttle service for string tasks (e.g., file uploads)
        services.AddSingleton<BackgroundTaskQueueThrottleService<string>>();
        services.AddSingleton<IBackgroundTaskQueueThrottleService<string>>(sp =>
            sp.GetRequiredService<BackgroundTaskQueueThrottleService<string>>());
        services.AddHostedService(sp =>
            sp.GetRequiredService<BackgroundTaskQueueThrottleService<string>>());

        return (services, appSettings);
    }
}

