using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Collections.Concurrent;
using System.Linq.Expressions;

namespace Library.Services.QueueBackgroundTasks
{
    #region Background Queue + Throttle

    public interface IBackgroundTaskQueueThrottleService<TProperty> where TProperty : notnull
    {
        void AddOption(BackgroundTaskOption<TProperty> option, bool overwrite = false);

        Task Enqueue(Expression<Func<Task>> workItem, TProperty item);
        Task Enqueue<TService>(Expression<Func<TService, Task>> workItem, TProperty item);

        Task ParallelExecuteAsync<TService>(
            IEnumerable<(Expression<Func<TService, Task>> workItem, TProperty item)> tasks);
    }

    public sealed class BackgroundTaskQueueThrottleService<TProperty>(IServiceProvider serviceProvider, int maxParallelism = 50)
        : IBackgroundTaskQueueThrottleService<TProperty>, IHostedService, IDisposable
        where TProperty : notnull
    {
        private readonly SemaphoreSlim _executionGate = new(maxParallelism, maxParallelism);
        private readonly ConcurrentDictionary<TProperty, byte> _activeItems = new();
        private static readonly List<BackgroundTaskOption<TProperty>> Options = [];

        #region Options

        public void AddOption(BackgroundTaskOption<TProperty> option, bool overwrite = false)
        {
            ArgumentNullException.ThrowIfNull(option);
            lock (Options)
            {
                if (!overwrite && Options.Count != 0) return;
                Options.Clear();
                Options.Add(option);
            }
        }

        private static BackgroundTaskOption<TProperty> GetOption()
            => Options.FirstOrDefault()
               ?? throw new InvalidOperationException("No BackgroundTaskOption registered.");
        #endregion

        #region Public API

        public Task Enqueue(Expression<Func<Task>> workItem, TProperty item)
            => InternalAsync<object>(workItem, item);

        public Task Enqueue<TService>(Expression<Func<TService, Task>> workItem, TProperty item)
            => InternalAsync<TService>(workItem, item);

        public async Task ParallelExecuteAsync<TService>(
            IEnumerable<(Expression<Func<TService, Task>> workItem, TProperty item)> tasks)
        {
            await Task.WhenAll(tasks.Select(t => InternalAsync<TService>(t.workItem, t.item)));
        }

        #endregion

        #region Internal Logic

        private async Task InternalAsync<TService>(LambdaExpression workItem, TProperty item)
        {
            ArgumentNullException.ThrowIfNull(item);

            var option = GetOption();

            // Soft throttle: check adaptive / business filter
            await WaitForAllowanceAsync(option);

            // Hard throttle: max parallelism
            await _executionGate.WaitAsync();

            _activeItems.TryAdd(item, 0);

            try
            {
                using var scope = serviceProvider.CreateScope();
                var tService = typeof(TService);
                // Resolve the service instance from DI
                TService serviceInstance = tService == typeof(object)
                    ? default!
                    : (TService)scope.ServiceProvider.GetRequiredService(tService);

                if (tService == typeof(object))
                {
                    var compiled = ((Expression<Func<Task>>)workItem).Compile();
                    await compiled();
                }
                else
                {
                    var compiled = ((Expression<Func<TService, Task>>)workItem).Compile();
                    await compiled(serviceInstance);
                }
            }
            finally
            {
                Cleanup(item);
            }
        }

        private async Task WaitForAllowanceAsync(BackgroundTaskOption<TProperty> option)
        {
            if (option.AllowedEnqueueFilter == null && option.AdaptiveThrottle == null)
                return;

            var sw = System.Diagnostics.Stopwatch.StartNew();

            while (true)
            {
                if (option.AdaptiveThrottle?.Invoke() == false)
                    throw new TimeoutException("System resource throttle rejected enqueue.");

                if (option.AllowedEnqueueFilter == null ||
                    option.AllowedEnqueueFilter([.. _activeItems.Keys]))
                    return;

                if (sw.Elapsed > TimeSpan.FromMinutes(1))
                    throw new TimeoutException("Unable to enqueue task due to throttle limits.");

                await Task.Delay(250);
            }
        }

        private void Cleanup(TProperty item)
        {
            _activeItems.TryRemove(item, out _);
            _executionGate.Release();
        }

        #endregion

        // Implement IHostedService
        public Task StartAsync(CancellationToken cancellationToken)
        {
            // No background processing loop, so just return completed task
            return Task.CompletedTask;
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            // No background processing loop, so just return completed task
            return Task.CompletedTask;
        }

        public void Dispose()
        {
            _executionGate?.Dispose();
        }
    }

    public sealed class BackgroundTaskOption<TProperty> where TProperty : notnull
    {
        /// <summary>Optional soft throttle based on currently executing items</summary>
        public Func<List<TProperty>, bool>? AllowedEnqueueFilter { get; set; }

        /// <summary>Optional system-level adaptive throttle</summary>
        public Func<bool>? AdaptiveThrottle { get; set; }
    }

    #endregion


    #region DI Extensions

    public static class BackgroundTaskQueueThrottleServiceExtensions
    {
        public static void AddBackgroundTaskQueueThrottleService<TProperty>(
            this IServiceCollection services,
            Action<BackgroundTaskOption<TProperty>> configure)
            where TProperty : notnull
        {
            var option = new BackgroundTaskOption<TProperty>();
            configure(option);

            services.AddSingleton(sp =>
            {
                var svc = new BackgroundTaskQueueThrottleService<TProperty>(sp);
                svc.AddOption(option, overwrite: true);
                return svc;
            });

            services.AddSingleton<IBackgroundTaskQueueThrottleService<TProperty>>(sp =>
                sp.GetRequiredService<BackgroundTaskQueueThrottleService<TProperty>>());

            services.AddHostedService(sp =>
                sp.GetRequiredService<BackgroundTaskQueueThrottleService<TProperty>>());
        }
    }

    #endregion
}
