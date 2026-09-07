namespace InfinityGrove.Backend.Infrastructure.Heroes;

/// <summary>
/// Config-bound source for <see cref="Domain.Heroes.SummoningStoneCatalogEntry"/>
/// data. Per Architecture.md's Open Questions ("no admin UI is scoped for v1;
/// content changes are assumed to ship via direct data/config changes deployed
/// with the backend"), this section is how a content pass populates Hero Block
/// thresholds and Summoning Stone pricing — never hardcoded here.
/// </summary>
public class SummoningStoneCatalogOptions
{
    public const string SectionName = "SummoningStones";

    public Dictionary<Guid, SummoningStoneCatalogEntryOptions> Heroes { get; set; } = new();
}

public class SummoningStoneCatalogEntryOptions
{
    /// <summary>FR-49: the account's own furthest cleared stage required for this hero to be stone-eligible.</summary>
    public int RequiredStage { get; set; }

    public long PriceAmountMinorUnits { get; set; }

    public string Currency { get; set; } = "USD";

    public uint SteamItemDefId { get; set; }
}
