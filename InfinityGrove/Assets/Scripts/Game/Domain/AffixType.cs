namespace InfinityGrove.Domain
{
    /// <summary>
    /// Rollable affixes (PRD FR-22). Which affixes are valid for a given
    /// <see cref="EquipmentSlot"/> is fixed by <c>CraftingRules.AffixesForSlot</c>.
    /// </summary>
    public enum AffixType
    {
        CritChance,
        AttackPercent,
        CritDamage,
        Defense,
        Speed,
        Precision
    }
}
