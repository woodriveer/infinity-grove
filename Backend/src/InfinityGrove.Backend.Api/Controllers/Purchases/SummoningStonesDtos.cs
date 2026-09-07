namespace InfinityGrove.Backend.Api.Controllers.Purchases;

public record InitiatePurchaseRequest(Guid HeroDefinitionId);

public record InitiatePurchaseResponse(
    bool Success,
    string? RejectionReason,
    long? SteamOrderId,
    string? SteamTransactionId,
    long? PriceAmountMinorUnits,
    string? Currency);

/// <summary>The query parameters Steam's own microtransaction authorization callback sends (AD-12).</summary>
public record SteamMicroTxnAuthorizationCallback(long OrderId, string SteamId);

public record FinalizePurchaseResponse(bool Success, string? RejectionReason, Guid? CardInstanceId, Guid? OutboxEntryId);
