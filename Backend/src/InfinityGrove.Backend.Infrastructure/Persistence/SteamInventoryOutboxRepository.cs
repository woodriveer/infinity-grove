using InfinityGrove.Backend.Application.Cards;
using InfinityGrove.Backend.Domain.Cards;
using Microsoft.EntityFrameworkCore;

namespace InfinityGrove.Backend.Infrastructure.Persistence;

public class SteamInventoryOutboxRepository(InfinityGroveDbContext dbContext) : ISteamInventoryOutboxRepository
{
    public async Task AddAsync(SteamInventoryOutboxEntry entry, CancellationToken cancellationToken) =>
        await dbContext.SteamInventoryOutboxEntries.AddAsync(entry, cancellationToken);

    public Task<List<SteamInventoryOutboxEntry>> GetDueAsync(DateTimeOffset nowUtc, int maxBatchSize, CancellationToken cancellationToken) =>
        dbContext.SteamInventoryOutboxEntries
            .Where(e => e.Status == SteamInventoryOutboxStatus.Pending && e.NextAttemptAtUtc <= nowUtc)
            .OrderBy(e => e.NextAttemptAtUtc)
            .Take(maxBatchSize)
            .ToListAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        SaveChangesGuard.RunAsync(dbContext, cancellationToken);
}
