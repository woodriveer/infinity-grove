namespace InfinityGrove.Backend.Application.Events;

/// <summary>
/// AD-6's server side: replays a batch of client events against the account's
/// current <see cref="Domain.Progress.PlayerProgress"/>, persists the append-only
/// log entries, and returns the canonical state plus a per-event accept/reject
/// verdict for the client to reconcile against.
/// </summary>
public interface IPlayerEventIngestionService
{
    Task<IngestBatchResult> IngestAsync(Guid accountId, IReadOnlyList<IngestEventCommand> events, CancellationToken cancellationToken);

    Task<PlayerProgressSnapshot> GetStateAsync(Guid accountId, CancellationToken cancellationToken);
}
