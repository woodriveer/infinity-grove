namespace InfinityGrove.Domain
{
    /// <summary>
    /// Local-only lifecycle of one appended event, before/after it reaches the
    /// backend (AD-6). <see cref="Accepted"/>/<see cref="Rejected"/> mirror the
    /// backend's PlayerEventStatus; <see cref="Pending"/> has no server-side
    /// equivalent - it only exists in the client's append-only log while an event
    /// has not yet been included in a synced batch.
    /// </summary>
    public enum PlayerEventSyncStatus
    {
        Pending,
        Accepted,
        Rejected,
    }
}
