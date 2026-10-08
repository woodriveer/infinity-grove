using InfinityGrove.Backend.Application.Rewards;
using InfinityGrove.Backend.Domain.Rewards;
using Microsoft.EntityFrameworkCore;

namespace InfinityGrove.Backend.Infrastructure.Persistence;

public class RewardGrantRepository(InfinityGroveDbContext dbContext) : IRewardGrantRepository
{
    public Task AddRangeAsync(IEnumerable<RewardGrant> grants, CancellationToken cancellationToken)
    {
        dbContext.RewardGrants.AddRange(grants);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<RewardGrant>> ListBySourceEventAsync(
        Guid accountId, Guid sourceClientEventId, CancellationToken cancellationToken) =>
        await dbContext.RewardGrants
            .Where(g => g.AccountId == accountId && g.SourceClientEventId == sourceClientEventId)
            .OrderBy(g => g.CreatedAtUtc).ThenBy(g => g.Id)
            .ToListAsync(cancellationToken);
}
