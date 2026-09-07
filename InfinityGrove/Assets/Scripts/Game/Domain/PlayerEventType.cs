namespace InfinityGrove.Domain
{
    /// <summary>
    /// Mirrors Backend/src/InfinityGrove.Backend.Domain/Events/PlayerEventType.cs
    /// exactly (name-for-name — both sides serialize this as a JSON string, see
    /// BackendSyncDtos). This is the full set of discrete, independently
    /// validatable event shapes the backend's replay covers today (AD-6); fusion/
    /// Market/itemization event types belong to the tasks that own those domains.
    /// </summary>
    public enum PlayerEventType
    {
        GoldEarned = 0,
        GoldSpent = 1,
        StageCleared = 2,
        HeroAcquired = 3,
        ActiveSquadChanged = 4,
    }
}
