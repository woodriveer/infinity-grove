namespace InfinityGrove.Backend.Application.Purchases;

/// <summary>
/// AD-12's two synchronous steps: <see cref="InitiateAsync"/> validates FR-49
/// Hero Block eligibility and starts the Steamworks charge (InitTxn) before any
/// money moves; <see cref="AuthorizeAndFinalizeAsync"/> is driven by Steam's own
/// authorization callback and captures the charge (FinalizeTxn) before granting
/// the card through the existing outbox path (AD-8).
/// </summary>
public interface ISummoningStonePurchaseService
{
    Task<InitiatePurchaseResult> InitiateAsync(Guid accountId, Guid heroDefinitionId, CancellationToken cancellationToken);

    Task<FinalizePurchaseResult> AuthorizeAndFinalizeAsync(long steamOrderId, string steamId64, CancellationToken cancellationToken);
}

public record InitiatePurchaseResult(
    bool Success,
    string? RejectionReason,
    long? SteamOrderId,
    string? SteamTransactionId,
    long? PriceAmountMinorUnits,
    string? Currency)
{
    public static InitiatePurchaseResult Rejected(string reason) => new(false, reason, null, null, null, null);

    public static InitiatePurchaseResult Accepted(long steamOrderId, string steamTransactionId, long priceAmountMinorUnits, string currency) =>
        new(true, null, steamOrderId, steamTransactionId, priceAmountMinorUnits, currency);
}

public record FinalizePurchaseResult(bool Success, string? RejectionReason, Guid? CardInstanceId, Guid? OutboxEntryId)
{
    public static FinalizePurchaseResult Rejected(string reason) => new(false, reason, null, null);

    public static FinalizePurchaseResult Accepted(Guid cardInstanceId, Guid outboxEntryId) => new(true, null, cardInstanceId, outboxEntryId);
}
