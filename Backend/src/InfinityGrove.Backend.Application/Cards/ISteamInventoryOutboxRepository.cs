using InfinityGrove.Backend.Domain.Cards;

namespace InfinityGrove.Backend.Application.Cards;

public interface ISteamInventoryOutboxRepository
{
    Task AddAsync(SteamInventoryOutboxEntry entry, CancellationToken cancellationToken);

    /// <summary>Pending entries whose retry backoff has elapsed — the outbox worker's polling query (AD-8).</summary>
    Task<List<SteamInventoryOutboxEntry>> GetDueAsync(DateTimeOffset nowUtc, int maxBatchSize, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
