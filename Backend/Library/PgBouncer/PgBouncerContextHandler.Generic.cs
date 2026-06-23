using Localize.Helper.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Library.PgBouncer
{
    public sealed class PgBouncerContextHandlerOptions<TContext>
        : PgBouncerContextHandlerOptions where TContext : DbContext
    {
        public string ConnectionString { get; set; } = string.Empty;
    }

    public interface IPgBouncerContextHandler<TContext> where TContext : DbContext
    {
        Task ExecuteWithRetryAsync(Func<TContext, Task> action, CancellationToken ct = default);
        Task<TResult> ExecuteWithRetryAsync<TResult>(Func<TContext, Task<TResult>> action, CancellationToken ct = default);
    }

    internal class PgBouncerContextHandler<TContext>(
        IPgBouncerContextHandler handler,
        PgBouncerContextHandlerOptions<TContext> options)
            : IPgBouncerContextHandler<TContext> where TContext : DbContext
    {
        public Task<TResult> ExecuteWithRetryAsync<TResult>(
            Func<TContext, Task<TResult>> action,
            CancellationToken ct = default)
        {
            void onOptions(PgBouncerContextHandlerOptions opt) => opt = options;
            return handler.ExecuteWithRetryAsync(options.ConnectionString, action, onOptions, ct);
        }

        public Task ExecuteWithRetryAsync(
            Func<TContext, Task> action,
            CancellationToken ct = default)
        {
            void onOptions(PgBouncerContextHandlerOptions opt) => opt = options;
            return handler.ExecuteWithRetryAsync(options.ConnectionString, action, onOptions, ct);
        }
    }

    public sealed class TypePgBouncerContextHandler(IServiceCollection services,
        Action<PgBouncerContextHandlerOptions>? onOptions)
    {
        internal readonly IServiceCollection Services = services;
        private readonly PgBouncerContextHandlerOptions _options = new();
        internal PgBouncerContextHandlerOptions GetOptions()
        {
            onOptions?.Invoke(_options);
            return _options;
        }
    }

    public static class PgBouncerContextHandlerExtensions
    {
        private static PgBouncerContextHandlerOptions<TContext> GetOptions<TContext>(TypePgBouncerContextHandler type,
            string connString) where TContext : DbContext
        {
            var globalOptions = type.GetOptions();
            PgBouncerContextHandlerOptions<TContext> options = new();
            globalOptions._CopyTo(options);
            options.ConnectionString = connString;
            return options;
        }

        public static TypePgBouncerContextHandler AddPgBouncerContextHandler(this IServiceCollection services,
            Action<PgBouncerContextHandlerOptions>? globalOptions = null)
                => new(services, globalOptions);

        public static TypePgBouncerContextHandler AddContext<TContext>(this TypePgBouncerContextHandler type,
            string connectionString) where TContext : DbContext
        {
            var options = GetOptions<TContext>(type, connectionString);
            type.Services.AddSingleton(options);
            type.Services.AddSingleton(typeof(IPgBouncerContextHandler<TContext>), typeof(PgBouncerContextHandler<TContext>));

            return type;
        }
    }
}
