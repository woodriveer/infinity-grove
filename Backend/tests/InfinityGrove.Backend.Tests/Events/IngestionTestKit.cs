using InfinityGrove.Backend.Domain.Drops;

namespace InfinityGrove.Backend.Tests.Events;

/// <summary>Shared fixtures for ingestion tests that need drops.</summary>
internal static class IngestionTestKit
{
    public static readonly Guid Hero = Guid.Parse("00000000-0000-4000-8000-0000000000a1");

    public static DropCatalog Catalog(double normalChance = 0.03, double bossChance = 0.25) => new(
        [new DropHero("h", Hero, "Nature", 1)],
        [new DropStage(5, "Nature", true), new DropStage(10, "Nature", true)],
        [new DropItemBand(1, ["blade"])],
        [new DropItem("blade", "Weapon")],
        new Dictionary<string, IReadOnlyList<DropAffixRange>> { ["Weapon"] = [new DropAffixRange("Attack", 1, 50)] },
        normalChance, bossChance, 100);

    /// <summary>Returns scripted values, then <c>fallback</c> forever.</summary>
    public sealed class ScriptedRandom(double fallback, params double[] values) : IDropRandom
    {
        private int _next;
        public double NextDouble() => _next < values.Length ? values[_next++] : fallback;
    }
}
