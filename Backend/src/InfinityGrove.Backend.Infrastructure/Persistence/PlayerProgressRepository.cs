using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Domain.Progress;
using Microsoft.EntityFrameworkCore;

namespace InfinityGrove.Backend.Infrastructure.Persistence;

public class PlayerProgressRepository(InfinityGroveDbContext dbContext) : IPlayerProgressRepository
{
    public Task<PlayerProgress?> GetByAccountIdAsync(Guid accountId, CancellationToken cancellationToken) =>
        dbContext.PlayerProgresses
            .Include(p => p.Roster)
            .SingleOrDefaultAsync(p => p.AccountId == accountId, cancellationToken);

    public async Task AddAsync(PlayerProgress progress, CancellationToken cancellationToken) =>
        await dbContext.PlayerProgresses.AddAsync(progress, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        SaveChangesGuard.RunAsync(dbContext, cancellationToken);
}
