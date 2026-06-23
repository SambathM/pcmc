using System.Collections.Concurrent;
using System.Diagnostics;

namespace TelegramEngine.Helpers
{
    /// <summary>
    /// Simple per-session minimum spacing rate limiter.
    /// Guarantees at least the specified delay between successive calls per session.
    /// </summary>
    internal static class TRateLimitHelper
    {
        private sealed class Entry
        {
            public long LastTicks; // Stopwatch ticks of last granted request
        }

        // Per session state
        private static readonly ConcurrentDictionary<long, Entry> _entries = new();
        // Per session gate objects to serialize for each session while still allowing parallel sessions
        private static readonly ConcurrentDictionary<long, object> _gates = new();

        // Cleanup control
        private static int _opCount;
        private const int CleanupEvery = 10_000; // operations
        private static readonly TimeSpan StaleThreshold = TimeSpan.FromMinutes(30);
        private static readonly long StaleThresholdTicks = (long)(StaleThreshold.TotalSeconds * Stopwatch.Frequency);

        /// <summary>
        /// Original signature (backward compatible). delaySeconds = minimum spacing between calls for a session.
        /// </summary>
        public static Task LimitAsync(double delaySeconds, long sessionId, CancellationToken cancellationToken = default)
            => LimitAsync(TimeSpan.FromSeconds(delaySeconds), sessionId, cancellationToken);

        /// <summary>
        /// Enforces at least <paramref name="minSpacing"/> between granted executions for the given <paramref name="sessionId"/>.
        /// If required, asynchronously waits remaining time.
        /// </summary>
        public static async Task LimitAsync(TimeSpan minSpacing, long sessionId, CancellationToken cancellationToken = default)
        {
            if (sessionId <= 0 || minSpacing <= TimeSpan.Zero)
                return;

            var minSpacingTicks = (long)(minSpacing.TotalSeconds * Stopwatch.Frequency);
            var gate = _gates.GetOrAdd(sessionId, static _ => new object());

            while (true)
            {
                long nowTicks = Stopwatch.GetTimestamp();
                long waitTicks = 0;

                lock (gate)
                {
                    var entry = _entries.GetOrAdd(sessionId, static _ => new Entry { LastTicks = 0 });
                    var since = nowTicks - entry.LastTicks;

                    if (entry.LastTicks == 0 || since >= minSpacingTicks)
                    {
                        // Grant immediately
                        entry.LastTicks = nowTicks;
                        break;
                    }

                    waitTicks = minSpacingTicks - since;
                }

                // Convert ticks (Stopwatch) to ms precisely
                double ms = waitTicks * 1000d / Stopwatch.Frequency;
                if (ms > 0)
                {
                    var delay = TimeSpan.FromMilliseconds(ms);
                    if (delay > TimeSpan.Zero)
                        await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
                }
            }

            // Opportunistic cleanup
            TryCleanup();
        }

        private static void TryCleanup()
        {
            // Only one thread performs cleanup when threshold reached
            if (Interlocked.Increment(ref _opCount) % CleanupEvery != 0)
                return;

            var cutoff = Stopwatch.GetTimestamp() - StaleThresholdTicks;

            foreach (var kvp in _entries)
            {
                // Safe read (Entry is reference type; LastTicks is long - atomic on 64-bit in 64-bit process)
                if (kvp.Value.LastTicks < cutoff)
                {
                    // Try remove both state and gate (best effort)
                    _entries.TryRemove(kvp.Key, out _);
                    _gates.TryRemove(kvp.Key, out _);
                }
            }
        }
    }
}