using System;
using System.Collections.Generic;
using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// The client's append-only local event log (AD-6): every state-changing
    /// gameplay action becomes a discrete, independently validatable event here
    /// before it is opportunistically synced to the backend.
    /// </summary>
    public interface IPlayerEventLog
    {
        IReadOnlyList<PlayerEventRecord> PendingEvents { get; }

        /// <summary>The sequence number the next Append will use - persisted so a restart doesn't reuse a number already sent to the backend.</summary>
        long NextSequenceNumber { get; }

        /// <summary>Sets the sequence counter's floor so the next Append never reuses a number the backend (or an earlier session) has already applied - see AD-9's cross-device conflict handling.</summary>
        void SeedSequence(long nextSequenceNumber);

        /// <summary>Restores not-yet-resolved events from the local save file after a crash/quit before they were synced.</summary>
        void LoadPending(IEnumerable<PlayerEventRecord> pending);

        /// <summary>Appends one event with the next sequence number and a fresh idempotency id (AD-6).</summary>
        PlayerEventRecord Append(PlayerEventType type, object payload);

        /// <summary>Records the backend's verdict for a previously-appended event and removes it from <see cref="PendingEvents"/> either way (accepted and rejected events are both resolved - see AdvanceSequence on the backend).</summary>
        void ApplyResult(Guid clientEventId, PlayerEventSyncStatus status, string rejectionReason);
    }
}
