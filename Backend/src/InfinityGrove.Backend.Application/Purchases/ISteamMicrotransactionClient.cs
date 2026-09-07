namespace InfinityGrove.Backend.Application.Purchases;

/// <summary>
/// Backend-only Steamworks Microtransaction Web API calls (AD-12): InitTxn
/// starts a real-money charge for one item and returns Steam's own transaction
/// id; FinalizeTxn captures it after Steam's authorization callback confirms
/// the player approved. The client never calls either directly — it only ever
/// sees the transaction id InitTxn returned, so it can drive Steam's own
/// payment UI.
/// </summary>
public interface ISteamMicrotransactionClient
{
    Task<SteamInitTxnResult> InitTxnAsync(SteamInitTxnRequest request, CancellationToken cancellationToken);

    /// <summary>Captures the charge for the order InitTxn already started — called once Steam's authorization callback has been validated.</summary>
    Task<SteamFinalizeTxnResult> FinalizeTxnAsync(long steamOrderId, CancellationToken cancellationToken);
}

public record SteamInitTxnRequest(
    string SteamId64,
    long OrderId,
    Guid HeroDefinitionId,
    uint SteamItemDefId,
    long PriceAmountMinorUnits,
    string Currency,
    string Description);

public record SteamInitTxnResult(bool Success, string? TransactionId, string? ErrorMessage)
{
    public static SteamInitTxnResult Ok(string transactionId) => new(true, transactionId, null);

    public static SteamInitTxnResult Failure(string errorMessage) => new(false, null, errorMessage);
}

public record SteamFinalizeTxnResult(bool Success, string? ErrorMessage)
{
    public static SteamFinalizeTxnResult Ok() => new(true, null);

    public static SteamFinalizeTxnResult Failure(string errorMessage) => new(false, errorMessage);
}
