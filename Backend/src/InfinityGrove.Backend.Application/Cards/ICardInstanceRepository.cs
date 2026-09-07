using InfinityGrove.Backend.Domain.Cards;

namespace InfinityGrove.Backend.Application.Cards;

public interface ICardInstanceRepository
{
    Task<CardInstance?> GetByIdAsync(Guid cardInstanceId, CancellationToken cancellationToken);

    /// <summary>Oldest-first Owned instances of a hero — fusion consumes these first (FIFO).</summary>
    Task<List<CardInstance>> GetOwnedByHeroAsync(Guid accountId, Guid heroDefinitionId, int take, CancellationToken cancellationToken);

    Task<List<CardInstance>> GetByAccountAsync(Guid accountId, CancellationToken cancellationToken);

    Task AddAsync(CardInstance cardInstance, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
