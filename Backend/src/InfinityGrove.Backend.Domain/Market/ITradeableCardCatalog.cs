namespace InfinityGrove.Backend.Domain.Market;

/// <summary>
/// The set of hero cards AD-13's Market price-cache job polls a reference price
/// for. No admin UI is scoped for v1 (Architecture.md Open Questions) — the
/// config-backed implementation is how a content pass populates this list,
/// mirroring <c>ISummoningStoneCatalog</c>.
/// </summary>
public interface ITradeableCardCatalog
{
    IReadOnlyList<TradeableCardCatalogEntry> GetAllEntries();
}
