using System.Security.Cryptography;

namespace InfinityGrove.Backend.Domain.Drops;

/// <summary>Source of uniform doubles in [0, 1); scripted in tests.</summary>
public interface IDropRandom
{
    double NextDouble();
}

public sealed class CryptoDropRandom : IDropRandom
{
    public double NextDouble() => RandomNumberGenerator.GetInt32(int.MaxValue) / (double)int.MaxValue;
}

public record RolledAffix(string Affix, int Value);

public record RolledItem(string ItemId, IReadOnlyList<RolledAffix> AffixRolls);

/// <summary>Pure drop rules (AD-001): every roll takes its randomness from an <see cref="IDropRandom"/>.</summary>
public static class DropRules
{
    public const double FavoredTypeWeight = 0.40;
    public const double OtherTypeWeight = 0.15;
    public const double FirstDefeatHeroChance = 1.0;
    public const double RepeatHeroChance = 0.01;

    public static double HeroDropChance(bool firstDefeat) =>
        firstDefeat ? FirstDefeatHeroChance : RepeatHeroChance;

    /// <summary>
    /// Picks a type (favored 0.40, others 0.15, renormalized over types that have an eligible hero),
    /// then a uniform eligible hero of that type.
    /// </summary>
    public static Guid RollHero(DropCatalog catalog, int bossStage, IDropRandom random)
    {
        var favored = catalog.Stages.FirstOrDefault(s => s.StageNumber == bossStage)?.FavoredType;
        var eligible = catalog.Heroes.Where(h => h.MinStage <= bossStage).ToList();
        if (eligible.Count == 0)
        {
            throw new InvalidOperationException($"No hero is eligible at stage {bossStage}.");
        }

        var types = catalog.Heroes.Select(h => h.HeroType)
            .Concat(catalog.Stages.Select(s => s.FavoredType))
            .Distinct()
            .OrderBy(t => t == favored ? 0 : 1)
            .ThenBy(t => t, StringComparer.Ordinal)
            .Where(t => eligible.Any(h => h.HeroType == t))
            .ToList();

        double Weight(string type) => type == favored ? FavoredTypeWeight : OtherTypeWeight;
        var roll = random.NextDouble() * types.Sum(Weight);
        var picked = types[^1];
        foreach (var type in types)
        {
            roll -= Weight(type);
            if (roll < 0)
            {
                picked = type;
                break;
            }
        }

        var pool = eligible.Where(h => h.HeroType == picked).ToList();
        return pool[Index(random.NextDouble(), pool.Count)].ServerHeroId;
    }

    /// <summary>Template uniform in the band for the stage (highest band at or below it); each slot affix uniform in [min, max].</summary>
    public static RolledItem RollItem(DropCatalog catalog, int stage, IDropRandom random)
    {
        var band = catalog.ItemBands.Where(b => b.FromStage <= stage).MaxBy(b => b.FromStage)
            ?? throw new InvalidOperationException($"No item band covers stage {stage}.");
        var itemId = band.ItemIds[Index(random.NextDouble(), band.ItemIds.Count)];
        var slot = catalog.Items.First(i => i.ItemId == itemId).Slot;
        var rolls = catalog.AffixRanges[slot]
            .Select(r => new RolledAffix(r.Affix, r.Min + Index(random.NextDouble(), r.Max - r.Min + 1)))
            .ToList();
        return new RolledItem(itemId, rolls);
    }

    public static int CountNormalDrops(int kills, double chance, IDropRandom random)
    {
        var drops = 0;
        for (var i = 0; i < kills; i++)
        {
            if (random.NextDouble() < chance)
            {
                drops++;
            }
        }

        return drops;
    }

    private static int Index(double unit, int count) => Math.Min((int)(unit * count), count - 1);
}
