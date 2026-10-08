using System.Text.Json;
using InfinityGrove.Backend.Domain.Drops;

namespace InfinityGrove.Backend.Infrastructure.Drops;

/// <summary>Loads the catalog embedded from <c>shared/drop-catalog/drop-catalog.json</c>.</summary>
public static class EmbeddedDropCatalogLoader
{
    public const string ResourceName = "drop-catalog.json";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static DropCatalog Load()
    {
        var assembly = typeof(EmbeddedDropCatalogLoader).Assembly;
        using var stream = assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidDropCatalogException($"embedded resource {ResourceName} is missing");
        return Parse(stream);
    }

    public static DropCatalog Parse(Stream json)
    {
        try
        {
            var raw = JsonSerializer.Deserialize<RawCatalog>(json, Json)
                ?? throw new InvalidDropCatalogException("the file is empty");
            return raw.ToCatalog().Validated();
        }
        catch (JsonException e)
        {
            throw new InvalidDropCatalogException($"malformed JSON ({e.Message})");
        }
    }

    private sealed record RawCatalog(
        List<DropHero>? Heroes,
        List<DropStage>? Stages,
        List<DropItemBand>? ItemBands,
        List<DropItem>? Items,
        Dictionary<string, List<DropAffixRange>>? AffixRanges,
        double NormalDropChance,
        double BossDropChance,
        int BagCapacity)
    {
        public DropCatalog ToCatalog() => new(
            Heroes ?? [],
            Stages ?? [],
            ItemBands ?? [],
            Items ?? [],
            (AffixRanges ?? []).ToDictionary(p => p.Key, p => (IReadOnlyList<DropAffixRange>)p.Value),
            NormalDropChance,
            BossDropChance,
            BagCapacity);
    }
}
