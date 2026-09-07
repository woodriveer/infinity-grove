namespace InfinityGrove.Backend.Application.Cards;

/// <summary>
/// Backend-only Steamworks Web API calls that mutate a player's Steam Inventory
/// (AD-4): the client never makes any of these directly — every call here uses
/// the publisher key. Implemented by the outbox worker (fusion's consume path,
/// AD-8) and the synchronous "prepare to list" endpoint (AD-8b).
/// </summary>
public interface ISteamInventoryPublisherClient
{
    /// <summary>AD-8: destroys the given item instances in the player's Steam Inventory — the mutation fusion's outbox saga drains.</summary>
    Task<SteamInventoryOperationResult> ConsumeItemInstancesAsync(
        string steamId64, IReadOnlyList<string> steamItemInstanceIds, CancellationToken cancellationToken);

    /// <summary>AD-8b: flips a single item instance's marketable flag to true — the call "prepare to list" makes before committing the Listed state transition.</summary>
    Task<SteamInventoryOperationResult> SetItemMarketableAsync(
        string steamId64, string steamItemInstanceId, CancellationToken cancellationToken);

    /// <summary>AD-12: mints one item from the given Steam item definition into the player's Steam Inventory — the mutation a Summoning Stone purchase's grant outbox entry drains.</summary>
    Task<SteamInventoryOperationResult> GrantItemInstanceAsync(
        string steamId64, uint steamItemDefId, CancellationToken cancellationToken);
}

public record SteamInventoryOperationResult(bool Success, string? ErrorMessage)
{
    public static SteamInventoryOperationResult Ok() => new(true, null);

    public static SteamInventoryOperationResult Failure(string errorMessage) => new(false, errorMessage);
}
