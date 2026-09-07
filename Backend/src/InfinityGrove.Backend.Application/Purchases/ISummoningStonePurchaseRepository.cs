using InfinityGrove.Backend.Domain.Purchases;

namespace InfinityGrove.Backend.Application.Purchases;

public interface ISummoningStonePurchaseRepository
{
    Task<SummoningStonePurchase?> GetBySteamOrderIdAsync(long steamOrderId, CancellationToken cancellationToken);

    Task AddAsync(SummoningStonePurchase purchase, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
