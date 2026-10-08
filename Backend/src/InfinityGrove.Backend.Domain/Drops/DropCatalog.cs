namespace InfinityGrove.Backend.Domain.Drops;

public record DropHero(string HeroId, Guid ServerHeroId, string HeroType, int MinStage);

public record DropStage(int StageNumber, string FavoredType, bool IsBoss);

public record DropItemBand(int FromStage, IReadOnlyList<string> ItemIds);

public record DropItem(string ItemId, string Slot);

public record DropAffixRange(string Affix, int Min, int Max);

/// <summary>
/// Hero, stage and item data only the client content knows, generated into
/// <c>shared/drop-catalog/drop-catalog.json</c> by <c>npm run gen:drops</c>. The backend rolls
/// drops against it (AD-001) because it has no hero or item tables of its own.
/// </summary>
public sealed record DropCatalog(
    IReadOnlyList<DropHero> Heroes,
    IReadOnlyList<DropStage> Stages,
    IReadOnlyList<DropItemBand> ItemBands,
    IReadOnlyList<DropItem> Items,
    IReadOnlyDictionary<string, IReadOnlyList<DropAffixRange>> AffixRanges,
    double NormalDropChance,
    double BossDropChance,
    int BagCapacity)
{
    /// <summary>Throws <see cref="InvalidDropCatalogException"/> naming the first broken rule.</summary>
    public DropCatalog Validated()
    {
        Require(Heroes.Count > 0, "heroes is empty");
        Require(Stages.Count > 0, "stages is empty");
        Require(ItemBands.Count > 0, "itemBands is empty");
        Require(Items.Count > 0, "items is empty");
        Require(Heroes.All(h => h.MinStage >= 1), "a hero has minStage below 1");
        Require(Heroes.Select(h => h.ServerHeroId).Distinct().Count() == Heroes.Count, "duplicate serverHeroId");
        Require(ItemBands.Any(b => b.FromStage <= 1), "itemBands does not cover stage 1");
        Require(ItemBands.All(b => b.ItemIds.Count > 0), "an item band is empty");

        var itemIds = Items.Select(i => i.ItemId).ToHashSet();
        Require(ItemBands.SelectMany(b => b.ItemIds).All(itemIds.Contains), "an item band references an unknown item");
        Require(Items.All(i => AffixRanges.TryGetValue(i.Slot, out var r) && r.Count > 0), "an item slot has no affix ranges");
        Require(AffixRanges.Values.SelectMany(r => r).All(r => r.Min <= r.Max), "an affix range has min above max");
        Require(NormalDropChance is >= 0 and <= 1, "normalDropChance outside 0..1");
        Require(BossDropChance is >= 0 and <= 1, "bossDropChance outside 0..1");
        Require(BagCapacity >= 1, "bagCapacity below 1");
        return this;
    }

    private static void Require(bool ok, string reason)
    {
        if (!ok)
        {
            throw new InvalidDropCatalogException(reason);
        }
    }
}

public sealed class InvalidDropCatalogException(string reason)
    : Exception($"Invalid drop catalog: {reason}.");
