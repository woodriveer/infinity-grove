namespace InfinityGrove.Domain
{
    /// <summary>
    /// Everything the crafting UI needs before the player commits currency
    /// (PRD FR-22 AC): current roll, re-roll cost, and the possible range.
    /// </summary>
    public readonly struct CraftingPreview
    {
        public AffixType Affix { get; }
        public float CurrentRoll { get; }
        public float MinRoll { get; }
        public float MaxRoll { get; }
        public int RerollCost { get; }

        public CraftingPreview(AffixType affix, float currentRoll, float minRoll, float maxRoll, int rerollCost)
        {
            Affix = affix;
            CurrentRoll = currentRoll;
            MinRoll = minRoll;
            MaxRoll = maxRoll;
            RerollCost = rerollCost;
        }
    }
}
