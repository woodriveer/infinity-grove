using InfinityGrove.Backend.Domain.Progress;

namespace InfinityGrove.Backend.Application.Progress;

public interface IPlayerProgressRepository
{
    Task<PlayerProgress?> GetByAccountIdAsync(Guid accountId, CancellationToken cancellationToken);

    Task AddAsync(PlayerProgress progress, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
