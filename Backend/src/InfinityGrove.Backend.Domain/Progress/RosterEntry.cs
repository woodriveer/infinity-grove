using InfinityGrove.Backend.Domain.Cards;

namespace InfinityGrove.Backend.Domain.Progress;

/// <summary>
/// How many copies of a hero card an account currently owns (i.e. holds as
/// Owned <see cref="CardInstance"/> rows — FR-2/FR-17), and the hero's fusion
/// star tier (FR-6). The roster entry itself, once created, is permanent — it
/// is never removed even if every owned copy is later fused away, which is what
/// keeps FR-36's ranked entry gate (unique heroes ever unlocked) unaffected by
/// fusion's duplicate consumption.
/// </summary>
public class RosterEntry
{
    public Guid AccountId { get; private set; }
    public Guid HeroDefinitionId { get; private set; }
    public int OwnedCount { get; private set; }
    public int StarTier { get; private set; }

    private RosterEntry()
    {
    }

    private RosterEntry(Guid accountId, Guid heroDefinitionId, int ownedCount)
    {
        AccountId = accountId;
        HeroDefinitionId = heroDefinitionId;
        OwnedCount = ownedCount;
        StarTier = 0;
    }

    public static RosterEntry FirstCopy(Guid accountId, Guid heroDefinitionId) => new(accountId, heroDefinitionId, 1);

    public void AddDuplicate() => OwnedCount++;

    /// <summary>Throws if this hero cannot be fused further — checked before fusion touches any CardInstance.</summary>
    public void EnsureCanFuse()
    {
        if (StarTier >= CardFusionCostCurve.MaxStarTier)
        {
            throw new FusionValidationException(
                $"Hero {HeroDefinitionId} is already at the maximum star tier ({CardFusionCostCurve.MaxStarTier}).");
        }
    }

    /// <summary>FR-7: the consumed duplicates are removed from the player's fusable/Market-listable count, not merely hidden.</summary>
    public void ConsumeDuplicates(int count)
    {
        if (count > OwnedCount)
        {
            throw new FusionValidationException(
                $"Cannot consume {count} duplicate(s) of hero {HeroDefinitionId}; only {OwnedCount} owned.");
        }

        OwnedCount -= count;
    }

    public void FuseUp()
    {
        EnsureCanFuse();
        StarTier++;
    }
}
