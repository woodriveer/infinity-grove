using System.Text;
using InfinityGrove.Backend.Domain.Drops;
using InfinityGrove.Backend.Infrastructure.Drops;

namespace InfinityGrove.Backend.Tests.Drops;

public class DropCatalogTests
{
    private const string Valid = """
        {"heroes":[{"heroId":"a","serverHeroId":"1f6e0000-0000-4000-8000-000000000001","heroType":"Nature","minStage":1}],
         "stages":[{"stageNumber":1,"favoredType":"Nature","isBoss":false}],
         "itemBands":[{"fromStage":1,"itemIds":["blade"]}],
         "items":[{"itemId":"blade","slot":"Weapon"}],
         "affixRanges":{"Weapon":[{"affix":"AttackPercent","min":1,"max":50}]},
         "normalDropChance":0.03,"bossDropChance":0.25,"bagCapacity":100}
        """;

    private static DropCatalog Parse(string json) =>
        EmbeddedDropCatalogLoader.Parse(new MemoryStream(Encoding.UTF8.GetBytes(json)));

    [Fact]
    public void EmbeddedCatalogLoadsWithHeroesAndBands()
    {
        var catalog = EmbeddedDropCatalogLoader.Load();

        Assert.NotEmpty(catalog.Heroes);
        Assert.NotEmpty(catalog.ItemBands);
        Assert.NotEmpty(catalog.AffixRanges);
        Assert.Contains(catalog.Stages, s => s.IsBoss);
        Assert.Equal(0.25, catalog.BossDropChance);
    }

    [Fact]
    public void MinimalCatalogParses()
    {
        var catalog = Parse(Valid);

        Assert.Equal(Guid.Parse("1f6e0000-0000-4000-8000-000000000001"), catalog.Heroes[0].ServerHeroId);
        Assert.Equal(1, catalog.AffixRanges["Weapon"][0].Min);
    }

    [Fact]
    public void MalformedJsonIsRefused()
    {
        var e = Assert.Throws<InvalidDropCatalogException>(() => Parse("{ not json"));
        Assert.Contains("malformed JSON", e.Message);
    }

    [Theory]
    [InlineData("\"minStage\":1", "\"minStage\":0", "minStage below 1")]
    [InlineData("\"fromStage\":1", "\"fromStage\":2", "does not cover stage 1")]
    [InlineData("\"itemIds\":[\"blade\"]", "\"itemIds\":[\"ghost\"]", "unknown item")]
    [InlineData("\"min\":1,\"max\":50", "\"min\":60,\"max\":50", "min above max")]
    [InlineData("\"bossDropChance\":0.25", "\"bossDropChance\":1.5", "bossDropChance outside 0..1")]
    [InlineData("\"bagCapacity\":100", "\"bagCapacity\":0", "bagCapacity below 1")]
    public void BrokenCatalogIsRefusedWithTheRule(string find, string replace, string expected)
    {
        var e = Assert.Throws<InvalidDropCatalogException>(() => Parse(Valid.Replace(find, replace)));
        Assert.Contains(expected, e.Message);
    }

    [Fact]
    public void MissingFieldsAreRefused()
    {
        var e = Assert.Throws<InvalidDropCatalogException>(() => Parse("{}"));
        Assert.Contains("heroes is empty", e.Message);
    }
}
