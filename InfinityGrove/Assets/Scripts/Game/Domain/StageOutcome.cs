namespace InfinityGrove.Domain
{
    /// <summary>The three ways a stage attempt can resolve (PRD FR-11).</summary>
    public enum StageOutcome
    {
        Success,
        PowerGate,
        CompositionMismatch
    }
}
