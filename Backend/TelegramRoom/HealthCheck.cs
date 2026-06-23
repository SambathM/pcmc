using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace TelegramRoom
{
    public class HealthCheck : IHealthCheck
    {
        private static readonly Random _rnd = new();

        public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(HealthCheckResult.Healthy());
        }
    }
}
