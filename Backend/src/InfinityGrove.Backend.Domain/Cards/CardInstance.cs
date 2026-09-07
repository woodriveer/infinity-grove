namespace InfinityGrove.Backend.Domain.Cards;

/// <summary>
/// One Steam Inventory item instance representing a single owned copy of a hero
/// card (AD-8b). Every instance is minted Owned (marketable=false in Steam
/// Inventory). The real Steam-assigned item instance id is established by the
/// card-grant/mint outbox flow that owns acquisition (drops, Summoning Stone
/// grants) — out of this task's scope — so callers into the Steamworks Web API
/// use this aggregate's own <see cref="Id"/> as the stable external correlation
/// key in the meantime.
///
/// Only two paths ever change <see cref="State"/>: fusion's outbox saga
/// (Owned -> PendingOutbox -> Consumed, AD-8) and the synchronous "prepare to
/// list" authorization endpoint (Owned -> Listed, AD-8b). FR-33 requires both
/// paths to validate against the *current* state before transitioning — a
/// transition out of anything but its required starting state throws.
/// </summary>
public class CardInstance
{
    public Guid Id { get; private set; }
    public Guid AccountId { get; private set; }
    public Guid HeroDefinitionId { get; private set; }
    public CardInstanceState State { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private CardInstance()
    {
    }

    public static CardInstance Mint(Guid accountId, Guid heroDefinitionId, DateTimeOffset nowUtc) => new()
    {
        Id = Guid.NewGuid(),
        AccountId = accountId,
        HeroDefinitionId = heroDefinitionId,
        State = CardInstanceState.Owned,
        CreatedAtUtc = nowUtc,
        UpdatedAtUtc = nowUtc,
    };

    /// <summary>Fusion has selected this instance and written its outbox record — see AD-8.</summary>
    public void MarkPendingOutbox(DateTimeOffset nowUtc)
    {
        RequireState(CardInstanceState.Owned, "committed to fusion");
        State = CardInstanceState.PendingOutbox;
        UpdatedAtUtc = nowUtc;
    }

    /// <summary>The outbox worker confirmed Steam applied the consume mutation.</summary>
    public void MarkConsumed(DateTimeOffset nowUtc)
    {
        RequireState(CardInstanceState.PendingOutbox, "marked Consumed");
        State = CardInstanceState.Consumed;
        UpdatedAtUtc = nowUtc;
    }

    /// <summary>The "prepare to list" endpoint's Steamworks marketable-flip call succeeded — see AD-8b.</summary>
    public void MarkListed(DateTimeOffset nowUtc)
    {
        RequireState(CardInstanceState.Owned, "listed on the Market");
        State = CardInstanceState.Listed;
        UpdatedAtUtc = nowUtc;
    }

    private void RequireState(CardInstanceState required, string action)
    {
        if (State != required)
        {
            throw new CardInstanceStateException(
                $"Card instance {Id} must be {required} to be {action}; current state is {State}.");
        }
    }
}
