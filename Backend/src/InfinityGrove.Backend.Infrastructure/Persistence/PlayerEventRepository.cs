using InfinityGrove.Backend.Application.Events;
using InfinityGrove.Backend.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace InfinityGrove.Backend.Infrastructure.Persistence;

public class PlayerEventRepository(InfinityGroveDbContext dbContext) : IPlayerEventRepository
{
    public Task<PlayerEvent?> FindByClientEventIdAsync(Guid accountId, Guid clientEventId, CancellationToken cancellationToken) =>
        dbContext.PlayerEvents.SingleOrDefaultAsync(e => e.AccountId == accountId && e.ClientEventId == clientEventId, cancellationToken);

    public async Task AddRangeAsync(IEnumerable<PlayerEvent> events, CancellationToken cancellationToken) =>
        await dbContext.PlayerEvents.AddRangeAsync(events, cancellationToken);

    public async Task<IReadOnlyList<AccountEventCount>> CountEventsByAccountSinceAsync(
        PlayerEventType type, DateTimeOffset sinceUtc, CancellationToken cancellationToken) =>
        await dbContext.PlayerEvents
            .Where(e => e.Type == type && e.Status == PlayerEventStatus.Accepted && e.OccurredAtUtc >= sinceUtc)
            .GroupBy(e => e.AccountId)
            .Select(g => new AccountEventCount(g.Key, g.Count(), g.Min(e => e.OccurredAtUtc), g.Max(e => e.OccurredAtUtc)))
            .ToListAsync(cancellationToken);
}
