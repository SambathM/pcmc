using Library.PgBouncer;
using Library.Services.QueueBackgroundTasks;
using Localize.Logger;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;
using System.Globalization;

namespace Library.Jwt.Authenticators;

public sealed class CustomJwtBearerEvents(Func<TokenValidatedContext, ValidatedValidators, Task> custom)
{
    public Func<TokenValidatedContext, ValidatedValidators, Task> OnValidatedCustom { get; set; } = custom;
}

internal readonly struct Authenticator(
    IServiceCollection services,
    IConfiguration configuration,
    LocalizeJwtOptions options)
{
    private static readonly LocalizeLogger logger = new(typeof(Authenticator));
    private static string ReindexCacheKey => $"{AppSettings.Branch}:identity:authenticators:Authenticator:reindexing";

    public IServiceCollection Build()
    {
        // Capture options in local variable for use in lambda expressions
        var opts = options;

        services.AddAuthentication(options =>
        {
            options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.TokenValidationParameters = DefaultAuthentication.DefaultParameters(false);

            options.Events = new JwtBearerEvents
            {
                OnTokenValidated = ctx => OnTokenValidated(ctx, opts),
                OnAuthenticationFailed = ctx => OnAuthenticationFailed(ctx),
                OnChallenge = ctx => OnChallenge(ctx),
            };

            // Merge external events
            if (opts.Events?.OnTokenValidated != null)
                options.Events.OnTokenValidated += opts.Events.OnTokenValidated;

            if (opts.Events?.OnAuthenticationFailed != null)
                options.Events.OnAuthenticationFailed += opts.Events.OnAuthenticationFailed;
            if (opts.Events?.OnChallenge != null)
                options.Events.OnChallenge += opts.Events.OnChallenge;
        });

        // Default authorization: require authentication for endpoints unless AllowAnonymous
        services.AddAuthorizationBuilder()
            // Default authorization: require authentication for endpoints unless AllowAnonymous
            .SetFallbackPolicy(new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme)
            .Build());

        // Add PgBouncer context for session validation in token validation step
        var connectionString = configuration.GetSection("ConnectionString").Get<string>()
            ?? throw new InvalidOperationException("ConnectionString configuration is required.");
        services.AddPgBouncerContextHandler()
            .AddContext<UserSessionDbContext>(connectionString);

        return services;
    }


    private static Task OnChallenge(JwtBearerChallengeContext context)
    {
        // If the response already started, suppress default challenge (401)
        if (context.Response.HasStarted)
        {
            context.HandleResponse();
            return Task.CompletedTask;
        }

        // Check if response has Retry-After header (rate limit)
        var isRateLimitBlocked = context.Response.Headers.RetryAfter.Count > 0;
        var isAllowAnonymous = IsAllowAnonymousEndpoint(context.HttpContext);

        // Check for rate limit blocking before falling to anonymous endpoint
        if (isRateLimitBlocked || isAllowAnonymous)
            // Suppress the default challenge (401) and let the pipeline continue
            context.HandleResponse();

        // Default behavior (challenge proceeds)
        return Task.CompletedTask;
    }

    private static Task OnAuthenticationFailed(AuthenticationFailedContext context)
    {
        //if (Web.IsDevelopment())
        logger.WarnCaller("Authentication failed: {Exception}", [context.Exception.Message]);

        if (IsAllowAnonymousEndpoint(context.HttpContext))
            return Task.CompletedTask;

        // Keep the pipeline moving without producing a challenge here
        context.NoResult();
        return Task.CompletedTask;
    }


    private static async Task OnTokenValidated(TokenValidatedContext context, LocalizeJwtOptions options)
    {
        if (!options.ValidateRoleAddSession) return;

        // allow public endpoints
        if (IsAllowAnonymousEndpoint(context.HttpContext)) return;

        try
        {
            // Perform reindexing in background if not done recently to ensure session validation queries remain performant
            await PerformRindexing(context);

            var validator = new Validator(context, options);
            await validator.ValidateAsync();

            if (options.CustomEvents?.OnValidatedCustom != null)
                await options.CustomEvents.OnValidatedCustom(context, validator.Validated);
        }
        catch (Exception ex)
        {
            //if (Web.IsDevelopment() || ProjectConfig.CurrentBranch == EDeployMode.DEV)
            logger.WarnCaller("Token validation failed: {ex}", [ex.ToString()]);

            await TryInvalidAsync(context);
        }
    }

    private static async Task TryInvalidAsync(TokenValidatedContext context)
    {
        try
        {
            // Short-circuit: mark auth as failed and complete the response
            context.NoResult();
            // Mark auth as failed and let the challenge handle the response
            context.Fail("Unauthorized");
            await Task.CompletedTask;
            //await context.Response.SafeWriteAsync(401, "Unauthorized");
            //await context.HttpContext.Response.CompleteAsync();
        }
        catch { }
    }

    private static bool IsAllowAnonymousEndpoint(HttpContext httpContext)
    {
        //var request = httpContext.Request;

        //// 1. Treat SPA GET/HEAD (non-/api, no endpoint) as anonymous
        //if (httpContext.GetEndpoint() == null &&
        //    (HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method)) &&
        //    !request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase))
        //{
        //    return true;
        //}

        // 2. For everything else, fall back to endpoint metadata
        var endpoint = httpContext.GetEndpoint();
        if (endpoint == null)
            return false;

        // [AllowAnonymous] on action
        if (endpoint.Metadata.GetMetadata<AllowAnonymousAttribute>() != null)
            return true;

        // [AllowAnonymous] on controller
        var controllerDesc = endpoint.Metadata.GetMetadata<ControllerActionDescriptor>();
        if (controllerDesc != null)
        {
            return controllerDesc.ControllerTypeInfo
                .GetCustomAttributes(typeof(AllowAnonymousAttribute), true)
                .Length != 0;
        }

        return false;
    }

    //private static string _cachedReindexScript;
    //private static string ReindexScript => _cachedReindexScript ??= NpsqlUtility.GenerateReindexScipt([
    //    (nameof(ClientConnect), nameof(ClientConnect.client_id)),
    //    (nameof(ClientConnect), nameof(ClientConnect.is_internal_third_party)),
    //    (nameof(ClientConnect), nameof(ClientConnect.secret)),
    //    (nameof(ClientConnect), nameof(ClientConnect.UserId)),
    //    (nameof(UserSessionToken), nameof(UserSessionToken.UserSessionId)),
    //    (nameof(UserSessionToken), nameof(UserSessionToken.TokenType)),
    //    (nameof(UserSessionTenant), nameof(UserSessionTenant.UserSessionId)),
    //    (nameof(UserSessionTenant), nameof(UserSessionTenant.TenantId)),
    //    (nameof(UserSessionTenant), nameof(UserSessionTenant.Token)),
    //    (nameof(UserSession), nameof(UserSession.UserId)),
    //    (nameof(UserSession), nameof(UserSession.SessionType)),
    //    (nameof(UserSession), nameof(UserSession.IsActive)),
    //    (nameof(UserSession), nameof(UserSession.RevokeCount)),
    //    (nameof(UserSession), nameof(UserSession.CreatedAt)),
    //    (nameof(UserSession), nameof(UserSession.LastAccessed)),
    //    (nameof(BusinessMember), nameof(BusinessMember.business_id)),
    //    (nameof(BusinessMember), nameof(BusinessMember.user_id)),
    //    (nameof(BusinessMember), nameof(BusinessMember.invited_by)),
    //    (nameof(BusinessMember), nameof(BusinessMember.status_activation_id)),
    //    (nameof(BusinessMember), nameof(BusinessMember.is_active)),
    //    (nameof(BusinessMember), nameof(BusinessMember.member_type)),
    //]);

    private static async Task PerformRindexing(TokenValidatedContext context)
    {
        var window = TimeSpan.FromHours(6);
        var factory = context.GetService<IServiceScopeFactory>();
        var enqeue = context.GetService<IBackgroundTaskQueueService>();
        var cache = context.GetService<IMemoryCache>();

        // Throttle reindexing to at most once per defined window using in-memory cache for quick check
        if (cache.TryGetValue(ReindexCacheKey, out _)) return;

        await enqeue.EnqueueFunc(async () =>
        {
            using var scope = factory.CreateScope();
            var redis = scope.ServiceProvider.GetRequiredService<IConnectionMultiplexer>().GetDatabase();
            var handler = scope.ServiceProvider.GetRequiredService<IPgBouncerContextHandler<UserSessionDbContext>>();

            var value = await redis.StringGetAsync(ReindexCacheKey);
            if (value.HasValue && DateTime.TryParse(value, null, DateTimeStyles.RoundtripKind, out var date))
            {
                // Sync in-memory expiry with Redis if another instance has already performed reindexing
                var syncWindow = DateTime.UtcNow - date;
                cache.Set(ReindexCacheKey, true, syncWindow);
            }

            try
            {
                await redis.StringSetAsync(ReindexCacheKey, DateTime.UtcNow.ToString("O"), window, When.NotExists);
                cache.Set(ReindexCacheKey, true, window);
                // Create and re-index on ClientConnect.ClientId to optimize this query
                // await handler.ExecuteWithRetryAsync(db => db.Database.ExecuteSqlRawAsync(ReindexScript));

                logger.Info("Completed background reindexing for ClientConnect.");
            }
            catch { /*swallowed*/ }

        });
    }

}
