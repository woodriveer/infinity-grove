namespace InfinityGrove.Backend.Application.Cards;

/// <summary>
/// AD-8b's synchronous "prepare to list" authorization: the only path that ever
/// flips a card instance's Steam Inventory item to marketable=true. Rejects a
/// card whose current Postgres state is not Owned before making any Steam call,
/// and only commits the Listed transition after Steam confirms the flip.
/// </summary>
public interface IMarketListingService
{
    Task<PrepareToListResult> PrepareToListAsync(Guid accountId, Guid cardInstanceId, CancellationToken cancellationToken);
}

public record PrepareToListResult(bool Success, string? RejectionReason)
{
    public static readonly PrepareToListResult Ok = new(true, null);

    public static PrepareToListResult Rejected(string reason) => new(false, reason);
}
