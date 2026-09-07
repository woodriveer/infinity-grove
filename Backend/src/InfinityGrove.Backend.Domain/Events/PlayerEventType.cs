namespace InfinityGrove.Backend.Domain.Events;

/// <summary>
/// The discrete, independently validatable event shapes this task's replay covers:
/// gold, stage progress, and roster state (AD-6). Fusion/Market/itemization event
/// types are added by the tasks that own those domains, not here.
/// </summary>
public enum PlayerEventType
{
    GoldEarned = 0,
    GoldSpent = 1,
    StageCleared = 2,
    HeroAcquired = 3,
    ActiveSquadChanged = 4,
}
