using InfinityGrove.Backend.Domain.Drops;

namespace InfinityGrove.Backend.Tests.Drops;

public class DropRulesTests
{
    private static readonly Guid Nature1 = Guid.Parse("00000000-0000-4000-8000-000000000001");
    private static readonly Guid Nature2 = Guid.Parse("00000000-0000-4000-8000-000000000002");
    private static readonly Guid Fire = Guid.Parse("00000000-0000-4000-8000-000000000003");
    private static readonly Guid Water = Guid.Parse("00000000-0000-4000-8000-000000000004");
    private static readonly Guid Dark = Guid.Parse("00000000-0000-4000-8000-000000000005");
    private static readonly Guid Light = Guid.Parse("00000000-0000-4000-8000-000000000006");
    private static readonly Guid LateFire = Guid.Parse("00000000-0000-4000-8000-000000000007");

    private static DropCatalog Catalog() => new(
        [
            new DropHero("n1", Nature1, "Nature", 1),
            new DropHero("n2", Nature2, "Nature", 1),
            new DropHero("f", Fire, "Fire", 1),
            new DropHero("w", Water, "Water", 1),
            new DropHero("d", Dark, "Dark", 1),
            new DropHero("l", Light, "Light", 1),
            new DropHero("lf", LateFire, "Fire", 8),
        ],
        [new DropStage(5, "Nature", true), new DropStage(10, "Fire", true)],
        [
            new DropItemBand(1, ["blade", "mail"]),
            new DropItemBand(6, ["staff"]),
        ],
        [new DropItem("blade", "Weapon"), new DropItem("mail", "Chest"), new DropItem("staff", "Weapon")],
        new Dictionary<string, IReadOnlyList<DropAffixRange>>
        {
            ["Weapon"] = [new DropAffixRange("Attack", 1, 50), new DropAffixRange("Crit", 5, 10)],
            ["Chest"] = [new DropAffixRange("Defense", 1, 40)],
        },
        0.03, 0.25, 100);

    private sealed class Scripted(params double[] values) : IDropRandom
    {
        private int _next;
        public double NextDouble() => values[_next++];
    }

    private sealed class SeededRandom(int seed) : IDropRandom
    {
        private readonly Random _random = new(seed);
        public double NextDouble() => _random.NextDouble();
    }

    // Order at a Nature boss: Nature 0.40, then Dark, Fire, Light, Water at 0.15 each (total 1.0).
    [Theory]
    [InlineData(0.39, "Nature")]
    [InlineData(0.41, "Dark")]
    [InlineData(0.60, "Fire")]
    [InlineData(0.75, "Light")]
    [InlineData(0.90, "Water")]
    [InlineData(0.99, "Water")]
    public void TypeBandsFollowFavoredThenOthers(double roll, string expectedType)
    {
        var catalog = Catalog();

        var id = DropRules.RollHero(catalog, 5, new Scripted(roll, 0.0));

        Assert.Equal(expectedType, catalog.Heroes.First(h => h.ServerHeroId == id).HeroType);
    }

    [Fact]
    public void HeroIsUniformAmongEligibleOfTheType()
    {
        Assert.Equal(Nature1, DropRules.RollHero(Catalog(), 5, new Scripted(0.1, 0.49)));
        Assert.Equal(Nature2, DropRules.RollHero(Catalog(), 5, new Scripted(0.1, 0.5)));
    }

    [Fact]
    public void MinStageExcludesHeroes()
    {
        // Fire is favored at stage 10 and LateFire (minStage 8) is eligible there.
        Assert.Equal(Fire, DropRules.RollHero(Catalog(), 10, new Scripted(0.1, 0.0)));
        Assert.Equal(LateFire, DropRules.RollHero(Catalog(), 10, new Scripted(0.1, 0.5)));
        // At stage 5 the only Fire hero is Fire, never LateFire.
        Assert.Equal(Fire, DropRules.RollHero(Catalog(), 5, new Scripted(0.60, 0.99)));
    }

    [Fact]
    public void TypeWithoutEligibleHeroIsRerolledAmongTheRest()
    {
        var catalog = Catalog();
        catalog = catalog with { Heroes = catalog.Heroes.Where(h => h.HeroType != "Nature").ToList() };

        // Dark, Fire, Light, Water at 0.15 each: 0.0 is Dark, 0.99 is Water.
        Assert.Equal(Dark, DropRules.RollHero(catalog, 5, new Scripted(0.0, 0.0)));
        Assert.Equal(Water, DropRules.RollHero(catalog, 5, new Scripted(0.99, 0.0)));
    }

    [Fact]
    public void HeroDropChanceIsGuaranteedOnFirstDefeat()
    {
        Assert.Equal(1.0, DropRules.HeroDropChance(true));
        Assert.Equal(0.01, DropRules.HeroDropChance(false));
    }

    [Fact]
    public void ItemTemplateStaysInTheStageBand()
    {
        Assert.Equal("blade", DropRules.RollItem(Catalog(), 5, new Scripted(0.0, 0, 0)).ItemId);
        Assert.Equal("mail", DropRules.RollItem(Catalog(), 5, new Scripted(0.99, 0)).ItemId);
        Assert.Equal("staff", DropRules.RollItem(Catalog(), 6, new Scripted(0.5, 0, 0)).ItemId);
    }

    [Fact]
    public void AffixValuesReachBothRangeEnds()
    {
        var low = DropRules.RollItem(Catalog(), 1, new Scripted(0.0, 0.0, 0.0));
        var high = DropRules.RollItem(Catalog(), 1, new Scripted(0.0, 0.999999, 0.999999));

        Assert.Equal([1, 5], low.AffixRolls.Select(a => a.Value));
        Assert.Equal([50, 10], high.AffixRolls.Select(a => a.Value));
        Assert.Equal(["Attack", "Crit"], low.AffixRolls.Select(a => a.Affix));
    }

    [Fact]
    public void CountNormalDropsCountsRollsBelowChance()
    {
        Assert.Equal(2, DropRules.CountNormalDrops(4, 0.03, new Scripted(0.01, 0.5, 0.029, 0.03)));
        Assert.Equal(0, DropRules.CountNormalDrops(0, 0.03, new Scripted()));
    }

    [Fact]
    public void TypeSharesOver100000SeededRollsMatchTheTable()
    {
        var random = new SeededRandom(12345);
        var catalog = Catalog();
        var counts = new Dictionary<string, int>();
        for (var i = 0; i < 100_000; i++)
        {
            var id = DropRules.RollHero(catalog, 5, random);
            var type = catalog.Heroes.First(h => h.ServerHeroId == id).HeroType;
            counts[type] = counts.GetValueOrDefault(type) + 1;
        }

        Assert.InRange(counts["Nature"] / 1000.0, 39, 41);
        foreach (var type in new[] { "Fire", "Water", "Dark", "Light" })
        {
            Assert.InRange(counts[type] / 1000.0, 14, 16);
        }
    }
}
