namespace InfinityGrove.Backend.Domain.Market;

/// <summary>
/// AD-13: the Steam Community Market identity for one hero's card — the
/// `market_hash_name` the unofficial `priceoverview` endpoint requires. Every
/// hero card is a Steam Inventory item (FR-31) and thus Market-tradeable in
/// principle; this is the swappable content data a config-backed catalog
/// implementation populates, the same role <c>SummoningStoneCatalogEntry</c>
/// plays for stone eligibility/pricing.
/// </summary>
public record TradeableCardCatalogEntry(Guid HeroDefinitionId, string MarketHashName);
