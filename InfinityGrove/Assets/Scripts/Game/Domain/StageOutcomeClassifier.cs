using System.Collections.Generic;
using System.Linq;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// Pure Power Gate vs Composition Mismatch classification (PRD FR-11). Kept
    /// as a single, order-of-checks function so the AC's two guarantees hold by
    /// construction: below the power floor is always a Power Gate regardless of
    /// composition, and at/above the power floor a type mismatch is always a
    /// Composition Mismatch, never a Power Gate.
    /// </summary>
    public static class StageOutcomeClassifier
    {
        public static StageOutcome Classify(int squadPower, int powerFloor, HeroType stageFavoredType, IEnumerable<HeroType> squadTypes)
        {
            if (squadPower < powerFloor)
                return StageOutcome.PowerGate;

            bool matchesModifier = squadTypes != null && squadTypes.Contains(stageFavoredType);
            return matchesModifier ? StageOutcome.Success : StageOutcome.CompositionMismatch;
        }
    }
}
