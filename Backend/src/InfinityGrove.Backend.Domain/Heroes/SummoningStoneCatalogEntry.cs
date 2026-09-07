namespace InfinityGrove.Backend.Domain.Heroes;

/// <summary>
/// FR-49's Hero Block gate plus FR-28/FR-29's fixed price for one hero as a
/// Summoning Stone target. Exact block thresholds, hero-to-block assignment,
/// and pricing are tuning/content deliverables this PRD explicitly defers
/// (FR-49) — this is the swappable data contract those deliverables populate
/// (see <see cref="ISummoningStoneCatalog"/>'s config-backed implementation),
/// the same role <c>CardFusionCostCurve</c> plays for fusion.
/// </summary>
public record SummoningStoneCatalogEntry(
    int RequiredStage,
    long PriceAmountMinorUnits,
    string Currency,
    uint SteamItemDefId)
{
    /// <summary>FR-49: eligible once the account's own furthest cleared stage reaches this hero's block.</summary>
    public bool IsUnlockedAtStage(int furthestStageCleared) => furthestStageCleared >= RequiredStage;
}
