namespace InfinityGrove.Backend.Application.Events;

/// <summary>
/// One account's event count within a queried window — the aggregate
/// AD-14/NFR-8's Market abuse-detection job reads from the event log instead of
/// scanning individual <see cref="Domain.Events.PlayerEvent"/> rows itself.
/// </summary>
public record AccountEventCount(Guid AccountId, int Count, DateTimeOffset FirstOccurredAtUtc, DateTimeOffset LastOccurredAtUtc);
