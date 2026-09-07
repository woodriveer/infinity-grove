namespace InfinityGrove.Backend.Domain.Purchases;

/// <summary>
/// AD-12's backend-owned transaction record, keyed by the Steam order id the
/// backend itself generates and passes to InitTxn. One row per Summoning Stone
/// purchase attempt: <see cref="Initiate"/> is written once InitTxn has already
/// succeeded (so <see cref="SteamTransactionId"/> is always known from
/// creation), and every later transition is driven by the InitTxn/FinalizeTxn
/// callback flow — never by the client directly.
/// </summary>
public class SummoningStonePurchase
{
    public Guid Id { get; private set; }
    public Guid AccountId { get; private set; }
    public Guid HeroDefinitionId { get; private set; }

    /// <summary>The backend-generated order id passed to InitTxn — Steam's callback correlates back through this.</summary>
    public long SteamOrderId { get; private set; }

    /// <summary>The transaction id InitTxn returned.</summary>
    public string SteamTransactionId { get; private set; } = null!;

    public long PriceAmountMinorUnits { get; private set; }
    public string Currency { get; private set; } = null!;

    public SummoningStonePurchaseStatus Status { get; private set; }

    /// <summary>Set once the card is minted (AD-8's outbox grant path) — the CardInstance the player received.</summary>
    public Guid? GrantedCardInstanceId { get; private set; }

    /// <summary>Set alongside <see cref="GrantedCardInstanceId"/> — the outbox entry draining the Steam Inventory side of the grant.</summary>
    public Guid? OutboxEntryId { get; private set; }

    public string? FailureReason { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private SummoningStonePurchase()
    {
    }

    public static SummoningStonePurchase Initiate(
        Guid accountId,
        Guid heroDefinitionId,
        long steamOrderId,
        string steamTransactionId,
        long priceAmountMinorUnits,
        string currency,
        DateTimeOffset nowUtc) => new()
    {
        Id = Guid.NewGuid(),
        AccountId = accountId,
        HeroDefinitionId = heroDefinitionId,
        SteamOrderId = steamOrderId,
        SteamTransactionId = steamTransactionId,
        PriceAmountMinorUnits = priceAmountMinorUnits,
        Currency = currency,
        Status = SummoningStonePurchaseStatus.Initiated,
        CreatedAtUtc = nowUtc,
        UpdatedAtUtc = nowUtc,
    };

    /// <summary>Steamworks FinalizeTxn confirmed the charge.</summary>
    public void MarkFinalized(DateTimeOffset nowUtc)
    {
        RequireState(SummoningStonePurchaseStatus.Initiated, "finalized");
        Status = SummoningStonePurchaseStatus.Finalized;
        UpdatedAtUtc = nowUtc;
    }

    /// <summary>The card was minted and its outbox grant entry queued — the purchase's terminal success state.</summary>
    public void MarkGranted(Guid cardInstanceId, Guid outboxEntryId, DateTimeOffset nowUtc)
    {
        RequireState(SummoningStonePurchaseStatus.Finalized, "granted");
        GrantedCardInstanceId = cardInstanceId;
        OutboxEntryId = outboxEntryId;
        Status = SummoningStonePurchaseStatus.Granted;
        UpdatedAtUtc = nowUtc;
    }

    /// <summary>No charge was completed (or completed but the grant could not be recorded) — terminal failure.</summary>
    public void MarkFailed(string reason, DateTimeOffset nowUtc)
    {
        if (Status is SummoningStonePurchaseStatus.Granted or SummoningStonePurchaseStatus.Failed)
        {
            throw new SummoningStonePurchaseStateException(
                $"Purchase {Id} cannot be marked Failed from terminal state {Status}.");
        }

        FailureReason = reason;
        Status = SummoningStonePurchaseStatus.Failed;
        UpdatedAtUtc = nowUtc;
    }

    private void RequireState(SummoningStonePurchaseStatus required, string action)
    {
        if (Status != required)
        {
            throw new SummoningStonePurchaseStateException(
                $"Purchase {Id} must be {required} to be {action}; current state is {Status}.");
        }
    }
}
