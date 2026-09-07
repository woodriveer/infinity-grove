namespace InfinityGrove.Backend.Domain.Purchases;

/// <summary>
/// A Summoning Stone purchase's lifecycle (AD-12). <see cref="Granted"/> and
/// <see cref="Failed"/> are the only terminal states — a purchase never moves
/// out of either once reached.
/// </summary>
public enum SummoningStonePurchaseStatus
{
    /// <summary>Steamworks InitTxn succeeded; awaiting Steam's authorization callback.</summary>
    Initiated = 0,

    /// <summary>Steamworks FinalizeTxn confirmed the charge; the card grant has not yet been queued.</summary>
    Finalized = 1,

    /// <summary>The chosen card was minted and its outbox grant entry queued (AD-8's path).</summary>
    Granted = 2,

    /// <summary>InitTxn/FinalizeTxn failed, or the callback failed validation. No charge was completed.</summary>
    Failed = 3,
}
