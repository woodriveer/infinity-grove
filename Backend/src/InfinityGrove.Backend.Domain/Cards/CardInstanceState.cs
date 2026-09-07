namespace InfinityGrove.Backend.Domain.Cards;

/// <summary>
/// The four mutually-exclusive states a hero card's Steam Inventory item
/// instance can be in (AD-8b). FR-33 requires exactly one of these to hold true
/// at any moment: a card is never simultaneously fusable and Market-listable.
/// </summary>
public enum CardInstanceState
{
    /// <summary>Minted, marketable=false in Steam Inventory. The only state fusion or listing may start from.</summary>
    Owned = 0,

    /// <summary>The synchronous "prepare to list" call succeeded; marketable=true in Steam Inventory. Blocks fusion until the listing resolves.</summary>
    Listed = 1,

    /// <summary>Fusion has committed to consuming this instance and written the outbox record; awaiting the background worker's Steamworks confirmation (AD-8).</summary>
    PendingOutbox = 2,

    /// <summary>The outbox worker confirmed Steam consumed the item. Terminal — never removed from history, never returned to Owned.</summary>
    Consumed = 3,
}
