namespace InfinityGrove.Backend.Domain.Cards;

/// <summary>
/// FR-6/FR-8: the duplicate-card cost to advance a hero one star tier, and the
/// star cap. The exact curve is a tuning/spreadsheet deliverable this PRD
/// explicitly defers (FR-8) — this is a placeholder linear curve (current tier +
/// 1 duplicates) so the fusion transaction has a concrete, swappable rule to
/// enforce rather than an unbounded cost. Replace <see cref="DuplicatesRequiredForNextTier"/>
/// with the tuned curve when it lands; nothing else about the fusion saga changes.
/// </summary>
public static class CardFusionCostCurve
{
    public const int MaxStarTier = 12;

    public static int DuplicatesRequiredForNextTier(int currentStarTier) => currentStarTier + 1;
}
