namespace InfinityGrove.Backend.Application.Cards;

/// <summary>
/// AD-8: fuses duplicate copies of a hero into its next star tier as one
/// Postgres transaction, and hands the Steam Inventory side off to the outbox
/// saga. The client sees the new star tier and each consumed card instance's
/// PendingOutbox state immediately; the outbox worker's later Applied/Consumed
/// transition is what "fusion is fully complete" ultimately depends on.
/// </summary>
public interface IFusionService
{
    Task<FusionResult> FuseAsync(Guid accountId, Guid heroDefinitionId, CancellationToken cancellationToken);
}

public record FusionResult(
    bool Success,
    string? RejectionReason,
    int? NewStarTier,
    IReadOnlyList<Guid>? ConsumedCardInstanceIds,
    Guid? OutboxEntryId)
{
    public static FusionResult Rejected(string reason) => new(false, reason, null, null, null);

    public static FusionResult Accepted(int newStarTier, IReadOnlyList<Guid> consumedCardInstanceIds, Guid outboxEntryId) =>
        new(true, null, newStarTier, consumedCardInstanceIds, outboxEntryId);
}
