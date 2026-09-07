using System;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// One entry in the client's append-only local event log (AD-6). The payload
    /// travels pre-serialized as JSON text so this record - and the save file that
    /// persists a backlog of not-yet-synced ones - never depends on any particular
    /// payload C# type.
    /// </summary>
    public class PlayerEventRecord
    {
        public Guid ClientEventId { get; set; }
        public long SequenceNumber { get; set; }
        public PlayerEventType Type { get; set; }
        public DateTimeOffset OccurredAtUtc { get; set; }
        public string PayloadJson { get; set; }
        public PlayerEventSyncStatus SyncStatus { get; set; } = PlayerEventSyncStatus.Pending;
        public string RejectionReason { get; set; }
    }
}
