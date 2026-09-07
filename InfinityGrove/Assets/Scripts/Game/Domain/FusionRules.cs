namespace InfinityGrove.Domain
{
    /// <summary>
    /// Pure fusion math (PRD FR-6/FR-8). The exact duplicate-cost curve is a
    /// tuning deliverable per FR-8; this is a placeholder curve isolated behind
    /// one method so tuning can replace it without touching Service/Presentation.
    /// </summary>
    public static class FusionRules
    {
        public const int MaxStarTier = 12;

        /// <summary>Duplicates required to advance from <paramref name="currentTier"/> to currentTier + 1.</summary>
        public static int DuplicatesRequiredForNextTier(int currentTier)
        {
            if (currentTier >= MaxStarTier) return 0;
            return currentTier + 1;
        }

        public static bool CanFuse(int currentTier, int duplicatesOwned)
        {
            if (currentTier >= MaxStarTier) return false;
            return duplicatesOwned >= DuplicatesRequiredForNextTier(currentTier);
        }
    }
}
