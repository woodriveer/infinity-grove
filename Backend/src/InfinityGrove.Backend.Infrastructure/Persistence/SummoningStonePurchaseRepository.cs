using InfinityGrove.Backend.Application.Purchases;
using InfinityGrove.Backend.Domain.Purchases;
using Microsoft.EntityFrameworkCore;

namespace InfinityGrove.Backend.Infrastructure.Persistence;

public class SummoningStonePurchaseRepository(InfinityGroveDbContext dbContext) : ISummoningStonePurchaseRepository
{
    public Task<SummoningStonePurchase?> GetBySteamOrderIdAsync(long steamOrderId, CancellationToken cancellationToken) =>
        dbContext.SummoningStonePurchases.SingleOrDefaultAsync(p => p.SteamOrderId == steamOrderId, cancellationToken);

    public async Task AddAsync(SummoningStonePurchase purchase, CancellationToken cancellationToken) =>
        await dbContext.SummoningStonePurchases.AddAsync(purchase, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        SaveChangesGuard.RunAsync(dbContext, cancellationToken);
}
