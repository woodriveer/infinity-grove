using InfinityGrove.Backend.Domain.MarketAbuse;

namespace InfinityGrove.Backend.Application.MarketAbuse;

public interface IMarketAbuseFlagRepository
{
    /// <summary>Dedup guard: has this account already been flagged for this signal since <paramref name="sinceUtc"/>? Prevents a sustained anomaly from re-flagging on every poll cycle within the same lookback window.</summary>
    Task<bool> ExistsSinceAsync(Guid accountId, MarketAbuseSignalType signalType, DateTimeOffset sinceUtc, CancellationToken cancellationToken);

    Task AddAsync(MarketAbuseFlag flag, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
