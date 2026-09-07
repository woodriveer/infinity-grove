using InfinityGrove.Backend.Application.Cards;
using InfinityGrove.Backend.Domain.Cards;
using Microsoft.EntityFrameworkCore;

namespace InfinityGrove.Backend.Infrastructure.Persistence;

public class CardInstanceRepository(InfinityGroveDbContext dbContext) : ICardInstanceRepository
{
    public Task<CardInstance?> GetByIdAsync(Guid cardInstanceId, CancellationToken cancellationToken) =>
        dbContext.CardInstances.SingleOrDefaultAsync(c => c.Id == cardInstanceId, cancellationToken);

    public Task<List<CardInstance>> GetOwnedByHeroAsync(Guid accountId, Guid heroDefinitionId, int take, CancellationToken cancellationToken) =>
        dbContext.CardInstances
            .Where(c => c.AccountId == accountId && c.HeroDefinitionId == heroDefinitionId && c.State == CardInstanceState.Owned)
            .OrderBy(c => c.CreatedAtUtc)
            .Take(take)
            .ToListAsync(cancellationToken);

    public Task<List<CardInstance>> GetByAccountAsync(Guid accountId, CancellationToken cancellationToken) =>
        dbContext.CardInstances.Where(c => c.AccountId == accountId).ToListAsync(cancellationToken);

    public async Task AddAsync(CardInstance cardInstance, CancellationToken cancellationToken) =>
        await dbContext.CardInstances.AddAsync(cardInstance, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        SaveChangesGuard.RunAsync(dbContext, cancellationToken);
}
