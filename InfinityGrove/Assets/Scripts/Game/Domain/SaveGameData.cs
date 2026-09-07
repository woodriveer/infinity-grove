using System;
using System.Collections.Generic;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// The full schema of the encrypted local save file (AD-9): the last state
    /// reconciled with the backend, plus any locally-appended events not yet
    /// confirmed synced, plus the timestamp offline gold accrual (FR-41) is
    /// computed from on next launch. This file is a cache, never authority - see
    /// AD-9's doc comment on InfinityGrove.Service.EncryptedSaveFileStore for why.
    /// </summary>
    public class SaveGameData
    {
        public const int CurrentSchemaVersion = 1;

        public int SchemaVersion { get; set; } = CurrentSchemaVersion;

        /// <summary>Empty until the first successful Steam auth exchange (AD-5).</summary>
        public string SteamId64 { get; set; } = string.Empty;

        /// <summary>FR-41: offline gold accrual on next launch is computed from this timestamp.</summary>
        public DateTimeOffset LastSeenUtc { get; set; }

        public PlayerStateSnapshot CanonicalState { get; set; } = PlayerStateSnapshot.Empty();

        /// <summary>Events appended locally that were not yet confirmed accepted/rejected by the backend.</summary>
        public List<PlayerEventRecord> PendingEvents { get; set; } = new List<PlayerEventRecord>();

        /// <summary>The sequence number the next locally-appended event will use (PlayerEventLog.SeedSequence).</summary>
        public long NextSequenceNumber { get; set; } = 1;

        public static SaveGameData CreateNew(DateTimeOffset nowUtc) => new SaveGameData
        {
            LastSeenUtc = nowUtc,
        };
    }
}
