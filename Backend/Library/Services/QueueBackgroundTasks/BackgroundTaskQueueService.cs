using Library.Extensions;
using Localize.Logger;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using System.Linq.Expressions;
using System.Reflection;
using System.Threading.Channels;

namespace Library.Services.QueueBackgroundTasks
{
    public interface IBackgroundTaskQueueService
    {
        Task Enqueue<TService>(Expression<Func<TService, Task>> workItem, Expression<Action>? onComplete = null, CancellationToken cancellationToken = default);
        Task Enqueue<TService>(Expression<Action<TService>> workItem, Expression<Action>? onComplete = null, CancellationToken cancellationToken = default);
        Task Enqueue(Expression<Func<Task>> workItem, Expression<Action>? onComplete = null, CancellationToken cancellationToken = default);
        Task Enqueue(Expression<Action> workItem, Expression<Action>? onComplete = null, CancellationToken cancellationToken = default);
        bool TryEnqueue<TService>(Expression<Func<TService, Task>> workItem, Expression<Action>? onComplete = null);
        Task EnqueueFunc(Func<Task> workItem, Action? onComplete = null, CancellationToken cancellationToken = default);
        Task EnqueueFunc(Action workItem, Action? onComplete = null, CancellationToken cancellationToken = default);

        int QueueLength { get; }
    }

    public class BackgroundTaskQueueService : BackgroundService, IBackgroundTaskQueueService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly Channel<Func<IServiceProvider, CancellationToken, Task>> _queue;
        private readonly BackgroundTaskConfig _config;
        private Task? _backgroundTask;
        private readonly LocalizeLogger<BackgroundTaskQueueService> logger = new();
        private readonly SemaphoreSlim _concurrencyLimiter;

        public BackgroundTaskQueueService(
            IServiceProvider serviceProvider,
            BackgroundTaskConfig? config = null)
        {
            _config = config ?? new();
            _serviceProvider = serviceProvider;
            _queue = Channel.CreateBounded<Func<IServiceProvider, CancellationToken, Task>>(
                new BoundedChannelOptions(_config.Capacity) { FullMode = BoundedChannelFullMode.Wait });

            _concurrencyLimiter = new SemaphoreSlim(_config.MaxParallelism, _config.MaxParallelism);
        }

        public int QueueLength => _queue.Reader.Count;

        public Task Enqueue<TService>(Expression<Func<TService, Task>> workItem, Expression<Action>? onComplete = null, CancellationToken cancellationToken = default)
            => EnqueueInternal(workItem.Body, typeof(TService), onComplete, cancellationToken);

        public Task Enqueue<TService>(Expression<Action<TService>> workItem, Expression<Action>? onComplete = null, CancellationToken cancellationToken = default)
            => EnqueueInternal(workItem.Body, typeof(TService), onComplete, cancellationToken);

        public Task Enqueue(Expression<Func<Task>> workItem, Expression<Action>? onComplete = null, CancellationToken cancellationToken = default)
            => EnqueueInternal(workItem.Body, null, onComplete, cancellationToken);

        public Task Enqueue(Expression<Action> workItem, Expression<Action>? onComplete = null, CancellationToken cancellationToken = default)
            => EnqueueInternal(workItem.Body, null, onComplete, cancellationToken);

        public Task EnqueueFunc(Func<Task> workItem, Action? onComplete = null, CancellationToken cancellationToken = default)
            => EnqueueInternalFunc(workItem, onComplete, cancellationToken);

        public Task EnqueueFunc(Action workItem, Action? onComplete = null, CancellationToken cancellationToken = default)
            => EnqueueInternalFunc(() => { workItem(); return Task.CompletedTask; }, onComplete, cancellationToken);

        internal async Task EnqueueInternal(Expression body, Type? serviceType, Expression<Action>? onComplete, CancellationToken cancellationToken)
        {
            var workItem = CreateExecuteWorkItem(body, serviceType, onComplete);
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            linkedCts.CancelAfter(_config.MaxEnqueueWaitTime);
            await _queue.Writer.WriteAsync(workItem, linkedCts.Token);
        }

        private async Task EnqueueInternalFunc(Func<Task> workItem, Action? onComplete, CancellationToken cancellationToken)
        {
            async Task wrapper(IServiceProvider sp, CancellationToken ct)
            {
                await ExecuteWithRetryAsync(async () => await workItem(), workItem.Method, null, ct);
                onComplete?.Invoke();
            }
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            linkedCts.CancelAfter(_config.MaxEnqueueWaitTime);
            await _queue.Writer.WriteAsync(wrapper, linkedCts.Token);
        }

        public bool TryEnqueue<TService>(Expression<Func<TService, Task>> workItem, Expression<Action>? onComplete = null)
            => TryEnqueueInternal(workItem.Body, typeof(TService), onComplete);

        internal bool TryEnqueueInternal(Expression body, Type? serviceType, Expression<Action>? onComplete)
        {
            var workItem = CreateExecuteWorkItem(body, serviceType, onComplete);
            return _queue.Writer.TryWrite(workItem);
        }


        private Func<IServiceProvider, CancellationToken, Task> CreateExecuteWorkItem(Expression body, Type? serviceType, Expression<Action>? onComplete)
        {
            if (body is MethodCallExpression methodCall)
            {
                var method = methodCall.Method;
                var parameters = methodCall.Arguments.Select(a => a.LambdaValueAccessor()).ToArray();

                return async (sp, ct) =>
                {
                    var type = serviceType ?? method.DeclaringType
                        ?? throw new InvalidOperationException("Unable to resolve background task service type.");

                    await ExecuteWithRetryAsync(async () =>
                    {
                        if (method.IsStatic)
                        {
                            var result = method.Invoke(null, parameters);
                            if (result is Task t) await t;
                        }
                        else
                        {
                            using var scope = sp.CreateScope();
                            var target = ResolveTarget(scope.ServiceProvider, type);
                            var result = method.Invoke(target, parameters);
                            if (result is Task t) await t;
                        }
                    }, method, type, ct);

                    onComplete?.Compile().InvokeSafely(logger);
                };
            }
            else
            {
                var lambda = body as LambdaExpression ?? Expression.Lambda(body);
                return async (sp, ct) =>
                {
                    await ExecuteWithRetryAsync(async () =>
                    {
                        var result = lambda.Compile().DynamicInvoke();
                        if (result is Task t) await t;
                    }, lambda.Type.GetMethod("Invoke")!, serviceType, ct);

                    onComplete?.Compile().InvokeSafely(logger);
                };
            }
        }

        private static object ResolveTarget(IServiceProvider sp, Type type)
        {
            //bool isController = typeof(ControllerBase).IsAssignableFrom(type) || typeof(Controller).IsAssignableFrom(type);

            return sp.GetService(type) ?? ActivatorUtilities.CreateInstance(sp, type);
        }

        private async Task ExecuteWithRetryAsync(Func<Task> operation, MethodInfo method, Type? serviceType, CancellationToken ct)
        {
            int attempt = 0;
            while (!_config.Stop && attempt < _config.RetryLimit)
            {
                try
                {
                    await operation();
#if DEBUG
                    //logger.Info($"Background task completed successfully in {serviceType?.Name}.{method?.Name} on attempt {attempt + 1}");
#endif
                    return;
                }
                catch (Exception ex) when (_config.RetryFilter?.Invoke(ex) ?? true)
                {
                    logger.Warn("Retry {0}/{1} - Error in {2}.{3}: {4}", attempt + 1, _config.RetryLimit, serviceType?.Name, method?.Name, ex.Message);
                    attempt++;
                    await Task.Delay(_config.RetryDelay, ct);
                }
            }

            logger.Error("Background task permanently failed in {0}.{1}", serviceType?.Name, method?.Name);
        }

        protected override Task ExecuteAsync(CancellationToken cancellationToken)
        {
            AppSettings.SetServiceProvider(_serviceProvider); // Ensure AppSettings has the service provider for static access

            _backgroundTask = Task.Run(async () =>
            {
                await foreach (var workItem in _queue.Reader.ReadAllAsync(cancellationToken))
                {
                    await _concurrencyLimiter.WaitAsync(cancellationToken); // limit concurrency

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await workItem(_serviceProvider, cancellationToken);
                        }
                        catch (OperationCanceledException)
                        {
                            logger.Info("Work item was cancelled.");
                        }
                        catch (Exception ex)
                        {
                            logger.Error("Unhandled background task error: {0}", ex.ToString());
                        }
                        finally
                        {
                            _concurrencyLimiter.Release(); // always release
                        }
                    }, cancellationToken);
                }
            }, cancellationToken);

            return Task.CompletedTask;
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _queue.Writer.Complete();
            if (_backgroundTask != null)
            {
                try
                {
                    await _backgroundTask.WaitAsync(cancellationToken);
                    _concurrencyLimiter.Dispose();
                }
                catch (OperationCanceledException) { logger.Warn("Forced background task shutdown."); }
            }

        }

        public void Dispose(bool disposing)
        {
            if (disposing)
            {
                _concurrencyLimiter?.Dispose();
                base.Dispose();
            }
        }
    }


    internal static class DelegateExtensions
    {
        public static void InvokeSafely(this Action? action, LocalizeLogger<BackgroundTaskQueueService> logger)
        {
            try { action?.Invoke(); }
            catch (Exception ex) { logger.Warn("Exception during OnComplete: {0}", ex.ToString()); }
        }

        public static void InvokeSafely<T>(this Action<T> action, LocalizeLogger<BackgroundTaskQueueService> logger, T arg)
        {
            try { action(arg); }
            catch (Exception ex) { logger.Warn("Exception during OnComplete: {0}", ex.ToString()); }
        }

        public static void AddBackgroundTaskQueueService(this IServiceCollection services, Action<BackgroundTaskConfig>? configure = null)
        {
            // Try remove existing service if it exists
            // This is useful for reconfiguring the service in tests or different environments
            services.RemoveAll<BackgroundTaskQueueService>();
            services.RemoveAll<IBackgroundTaskQueueService>();

            var config = new BackgroundTaskConfig();
            configure?.Invoke(config);

            services.AddSingleton(sp =>
            {
                var service = new BackgroundTaskQueueService(sp, config);
                return service;
            });

            services.AddSingleton<IBackgroundTaskQueueService>(sp => sp.GetRequiredService<BackgroundTaskQueueService>());
            services.AddHostedService(sp => sp.GetRequiredService<BackgroundTaskQueueService>());
        }
    }

    public class BackgroundTaskConfig
    {
        public int MaxParallelism { get; set; } = 1;
        public bool Stop { get; set; } = false;
        public int RetryLimit { get; set; } = 3;
        public int Capacity { get; set; } = 1000;
        public TimeSpan RetryDelay { get; set; } = TimeSpan.FromMilliseconds(500);
        public Func<Exception, bool>? RetryFilter { get; set; }
        public TimeSpan MaxEnqueueWaitTime { get; set; } = TimeSpan.FromSeconds(30);
    }

}
