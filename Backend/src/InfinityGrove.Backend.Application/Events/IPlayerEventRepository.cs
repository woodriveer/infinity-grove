using InfinityGrove.Backend.Domain.Events;

namespace InfinityGrove.Backend.Application.Events;

public interface IPlayerEventRepository
{
    /// <summary>Idempotency lookup: has this exact client-submitted event already been ingested, and with what verdict?</summary>
    Task<PlayerEvent?> FindByClientEventIdAsync(Guid accountId, Guid clientEventId, CancellationToken cancellationToken);

    Task AddRangeAsync(IEnumerable<PlayerEvent> events, CancellationToken cancellationToken);

    /// <summary>AD-14/NFR-8: per-account count of Accepted events of <paramref name="type"/> occurring at or after <paramref name="sinceUtc"/> — the aggregation the Market abuse-detection job scans each run.</summary>
    Task<IReadOnlyList<AccountEventCount>> CountEventsByAccountSinceAsync(
        PlayerEventType type, DateTimeOffset sinceUtc, CancellationToken cancellationToken);
}
