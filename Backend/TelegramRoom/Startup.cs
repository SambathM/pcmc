using Library.Extensions;
using Library.Helpers;
using Library.Http;
using Library.Models;
using Localize.Logger;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using TelegramEngine;
using TelegramEngine.Data;
using TelegramRoom.Services;

namespace TelegramRoom;

public class Startup(IConfiguration configuration)
{
    private void HandleDeserializationError(
        object? sender,
        Newtonsoft.Json.Serialization.ErrorEventArgs? errorArgs)
    {
        var currentError = errorArgs?.ErrorContext.Error.Message;
        Console.WriteLine(currentError);
        if (errorArgs != null)
        {
            errorArgs.ErrorContext.Handled = true;
        }
    }

    public void ConfigureServices(IServiceCollection services)
    {
        ServicePointManager.Expect100Continue = true;
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls
        | SecurityProtocolType.Tls11
        | SecurityProtocolType.Tls12;

        JwtSecurityTokenHandler.DefaultMapInboundClaims = false;
        JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
        JwtSecurityTokenHandler.DefaultOutboundClaimTypeMap.Clear();

        services.AddForwardedHeaderOptions(configuration);

        //required in every startup on the top of every services  

        services.NpgSqlEnableLegacyTimestampBehavior();

        services.TryAddSingleton(services);
        services.AddControllers(o => o.InputFormatters.Insert(o.InputFormatters.Count, new TextPlainInputFormatter()))
        .AddNewtonsoftJson((options) =>
        {
            options.SerializerSettings.ReferenceLoopHandling = ReferenceLoopHandling.Ignore;
            options.SerializerSettings.ContractResolver = new CamelCasePropertyNamesContractResolver();
            options.SerializerSettings.Error = HandleDeserializationError;
        });

        services.AddSwaggerDocumentationService();

        services.AddTelegramEngine(configuration,
            opt =>
            {
                opt.SendMessageAsync = async (group, method, msg, svp) =>
                {
                    using var scope = svp.CreateScope();
                    await scope.ServiceProvider
                        .GetRequiredService<ISignalRHub>()
                            .SendAsync(group, method, msg);
                };
            });

        services.AddScoped<ISignalRHub, SignalRHub>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IUserSessionService, UserSessionService>();
        services.AddScoped<IUtilityService, UtilityService>();
        services.AddScoped<IWebConfig, WebConfig>();
        services.AddScoped<IApiLoginService, ApiLoginService>();
        services.AddSingleton(typeof(ILocalizeLogger<>), typeof(LocalizeLogger<>));

        services.AddHttpContextAccessor();
        services.AddMemoryCache();

        var connString = configuration.GetSection("ConnectionString").Get<string>();
        services.AddDbContext<TelegramContext>(options =>
            options.UseNpgsql(connString, opt => opt.MigrationsAssembly("TelegramRoom")));

        services.AddHealthChecks().AddCheck<HealthCheck>("Healthy check");

        services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.WithOrigins("http://localhost:4200")
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials();
            });
        });

        services.AddRedisSignalRConfig();

    }

    public void Configure(
        IApplicationBuilder app,
        IWebHostEnvironment env,
        TelegramContext dbContext)
    {

        if (env.IsDevelopment())
        {
            app.UseSwaggerDocumentation();
            app.UseDeveloperExceptionPage();
        }

        app.UseStaticFiles();
        app.UseCors();
        app.UseRouting();
        //app.UseAuthentication(); // populate HttpContext.User
        //app.UseAuthorization();

        app.UseEndpoints(enp =>
        {
            enp.MapHealthChecks("/ready")
                .AllowAnonymous();

            enp.MapHub<SignalRHub>("/messagehub", options =>
            {
                options.TransportMaxBufferSize = 4000;
                options.ApplicationMaxBufferSize = 4000;

            }).AllowAnonymous();

            enp.MapControllers();

        });

        dbContext.Database.Migrate();

        // One-time sweep of dead sessions accumulated in the DB — any session whose
        // refresh token has already expired can never be renewed. Cascades to its
        // tokens / tenants via the ON DELETE CASCADE FKs.
        var now = DateTime.UtcNow;
        dbContext.UserSessions
            .Where(x => !x.Tokens.Any(tx => tx.TokenType == ETokenType.Refresh && tx.ExpiredAt > now))
            .ExecuteDelete();

    }

}
