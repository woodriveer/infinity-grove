namespace InfinityGrove.Backend.Domain.Cards;

/// <summary>
/// The Steam Inventory mutation a <see cref="SteamInventoryOutboxEntry"/> names.
/// Fusion (AD-8) produces <see cref="ConsumeCardInstances"/>; a Summoning Stone
/// purchase (AD-12) produces <see cref="GrantCardInstance"/> — both drain
/// through the same worker rather than a bespoke direct Steamworks call, per
/// AD-8's impact note.
/// </summary>
public enum SteamInventoryOutboxOperation
{
    ConsumeCardInstances = 0,

    /// <summary>AD-12: creates the real Steam Inventory item for a card minted by a completed Summoning Stone purchase.</summary>
    GrantCardInstance = 1,
}
