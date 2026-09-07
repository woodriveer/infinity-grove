namespace InfinityGrove.Backend.Infrastructure.Market;

/// <summary>
/// Config-bound source for <see cref="Domain.Market.TradeableCardCatalogEntry"/>
/// data. Per Architecture.md's Open Questions ("no admin UI is scoped for v1;
/// content changes are assumed to ship via direct data/config changes deployed
/// with the backend"), this section is how a content pass populates each
/// hero's `market_hash_name` — never hardcoded here.
/// </summary>
public class TradeableCardCatalogOptions
{
    public const string SectionName = "TradeableCards";

    /// <summary>
    /// HeroDefinitionId (as a GUID string) -> the exact Steam Market
    /// `market_hash_name` for that card. Keyed by string, not <see cref="Guid"/>,
    /// because Microsoft.Extensions.Configuration's binder cannot populate a
    /// <c>Dictionary&lt;Guid, ...&gt;</c> from config (verified empirically: it
    /// silently binds to zero entries) — <see cref="ConfiguredTradeableCardCatalog"/>
    /// parses each key itself.
    /// </summary>
    public Dictionary<string, string> Heroes { get; set; } = new();
}
