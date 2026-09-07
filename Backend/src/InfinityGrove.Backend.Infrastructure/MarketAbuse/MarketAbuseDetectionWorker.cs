using InfinityGrove.Backend.Application.Events;
using InfinityGrove.Backend.Application.MarketAbuse;
using InfinityGrove.Backend.Domain.Events;
using InfinityGrove.Backend.Domain.MarketAbuse;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace InfinityGrove.Backend.Infrastructure.MarketAbuse;

/// <summary>
/// AD-14/NFR-8: periodically scans the same append-only event log AD-6 already
/// requires for progress reconciliation, looking for per-account cadence
/// anomalies scoped to Market-relevant paths — stage-clear/drop-farming rate
/// and hero-acquisition rate. Reuses the event log and scheduled-job pattern
/// already required for AD-6/AD-11/AD-13 rather than a dedicated detection
/// service, per the user's confirmed choice. This job only records a flag for
/// an ops pass to review (no admin UI is scoped for v1); it never suspends,
/// bans, or rate-limits an account itself. The listing-rate-limit half of
/// NFR-8 is a separate, inline precondition enforced by AD-8b's "prepare to
/// list" endpoint, not this job.
/// </summary>
public class MarketAbuseDetectionWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<MarketAbuseDetectionOptions> options,
    TimeProvider timeProvider,
    ILogger<MarketAbuseDetectionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var pollInterval = TimeSpan.FromMinutes(Math.Max(1, options.Value.PollIntervalMinutes));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ScanOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Unhandled error while scanning the event log for Market abuse signals.");
            }

            try
            {
                await Task.Delay(pollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
            }
        }
    }

    private async Task ScanOnceAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var eventRepository = scope.ServiceProvider.GetRequiredService<IPlayerEventRepository>();
        var flagRepository = scope.ServiceProvider.GetRequiredService<IMarketAbuseFlagRepository>();

        var nowUtc = timeProvider.GetUtcNow();
        var windowStart = nowUtc - TimeSpan.FromMinutes(Math.Max(1, options.Value.WindowMinutes));

        await ScanSignalAsync(
            eventRepository, flagRepository,
            PlayerEventType.StageCleared, MarketAbuseSignalType.AnomalousStageClearRate,
            options.Value.MaxStageClearsPerWindow, windowStart, nowUtc, cancellationToken);

        await ScanSignalAsync(
            eventRepository, flagRepository,
            PlayerEventType.HeroAcquired, MarketAbuseSignalType.AnomalousHeroAcquisitionRate,
            options.Value.MaxHeroAcquisitionsPerWindow, windowStart, nowUtc, cancellationToken);
    }

    private async Task ScanSignalAsync(
        IPlayerEventRepository eventRepository,
        IMarketAbuseFlagRepository flagRepository,
        PlayerEventType type,
        MarketAbuseSignalType signalType,
        int threshold,
        DateTimeOffset windowStart,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        var counts = await eventRepository.CountEventsByAccountSinceAsync(type, windowStart, cancellationToken);
        var flaggedAny = false;

        foreach (var count in counts)
        {
            if (count.Count < threshold)
            {
                continue;
            }

            // Dedup: skip if this account was already flagged for this signal
            // within the current lookback window, so a sustained anomaly
            // doesn't re-flag on every poll cycle.
            if (await flagRepository.ExistsSinceAsync(count.AccountId, signalType, windowStart, cancellationToken))
            {
                continue;
            }

            logger.LogWarning(
                "Market abuse signal {SignalType} for account {AccountId}: {Observed} events (threshold {Threshold}) in window {WindowStart:o}-{WindowEnd:o}.",
                signalType, count.AccountId, count.Count, threshold, windowStart, nowUtc);

            await flagRepository.AddAsync(
                MarketAbuseFlag.Raise(count.AccountId, signalType, count.Count, threshold, windowStart, nowUtc, nowUtc),
                cancellationToken);
            flaggedAny = true;
        }

        if (flaggedAny)
        {
            await flagRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
