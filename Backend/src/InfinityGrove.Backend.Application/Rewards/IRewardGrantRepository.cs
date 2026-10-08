using InfinityGrove.Backend.Domain.Rewards;

namespace InfinityGrove.Backend.Application.Rewards;

public interface IRewardGrantRepository
{
    Task AddRangeAsync(IEnumerable<RewardGrant> grants, CancellationToken cancellationToken);

    /// <summary>Grants of one source event, only for the owning account, oldest first.</summary>
    Task<IReadOnlyList<RewardGrant>> ListBySourceEventAsync(
        Guid accountId, Guid sourceClientEventId, CancellationToken cancellationToken);
}
