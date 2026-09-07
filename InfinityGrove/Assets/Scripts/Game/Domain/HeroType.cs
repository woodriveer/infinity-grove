namespace InfinityGrove.Domain
{
    /// <summary>
    /// The rotating type/element axis used for stage modifiers (PRD FR-10) and
    /// Composition Mismatch detection (FR-11). Every hero has exactly one type.
    /// </summary>
    public enum HeroType
    {
        Fire,
        Water,
        Nature,
        Light,
        Dark
    }
}
