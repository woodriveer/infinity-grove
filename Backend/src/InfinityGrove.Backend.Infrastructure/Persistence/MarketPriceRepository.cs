using InfinityGrove.Backend.Application.Market;
using InfinityGrove.Backend.Domain.Market;
using Microsoft.EntityFrameworkCore;

namespace InfinityGrove.Backend.Infrastructure.Persistence;

public class MarketPriceRepository(InfinityGroveDbContext dbContext) : IMarketPriceRepository
{
    public Task<MarketPriceSnapshot?> GetByHeroAsync(Guid heroDefinitionId, CancellationToken cancellationToken) =>
        dbContext.MarketPriceSnapshots.SingleOrDefaultAsync(s => s.HeroDefinitionId == heroDefinitionId, cancellationToken);

    public async Task AddAsync(MarketPriceSnapshot snapshot, CancellationToken cancellationToken) =>
        await dbContext.MarketPriceSnapshots.AddAsync(snapshot, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        SaveChangesGuard.RunAsync(dbContext, cancellationToken);
}
