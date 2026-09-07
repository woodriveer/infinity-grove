namespace InfinityGrove.Domain
{
    /// <summary>
    /// Everything the Fusion UI needs to render in one shot (PRD FR-6 AC): current
    /// tier, duplicates owned/required, and a preview of the ability gained.
    /// </summary>
    public readonly struct FusionPreview
    {
        public int CurrentStarTier { get; }
        public int DuplicatesOwned { get; }
        public int DuplicatesRequired { get; }
        public string NextTierAbilityDescription { get; }
        public bool CanFuse { get; }
        public bool IsMaxTier { get; }

        public FusionPreview(int currentStarTier, int duplicatesOwned, int duplicatesRequired, string nextTierAbilityDescription, bool canFuse, bool isMaxTier)
        {
            CurrentStarTier = currentStarTier;
            DuplicatesOwned = duplicatesOwned;
            DuplicatesRequired = duplicatesRequired;
            NextTierAbilityDescription = nextTierAbilityDescription;
            CanFuse = canFuse;
            IsMaxTier = isMaxTier;
        }
    }
}
