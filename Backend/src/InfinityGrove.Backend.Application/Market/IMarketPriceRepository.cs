using InfinityGrove.Backend.Domain.Market;

namespace InfinityGrove.Backend.Application.Market;

public interface IMarketPriceRepository
{
    Task<MarketPriceSnapshot?> GetByHeroAsync(Guid heroDefinitionId, CancellationToken cancellationToken);

    Task AddAsync(MarketPriceSnapshot snapshot, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
