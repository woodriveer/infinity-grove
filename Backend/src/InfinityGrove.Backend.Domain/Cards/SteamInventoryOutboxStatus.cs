namespace InfinityGrove.Backend.Domain.Cards;

public enum SteamInventoryOutboxStatus
{
    /// <summary>Not yet applied, or a prior attempt failed and is scheduled to retry.</summary>
    Pending = 0,

    /// <summary>The Steamworks Web API confirmed the mutation; terminal.</summary>
    Applied = 1,
}
