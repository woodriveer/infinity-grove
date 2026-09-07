using System;
using System.Collections.Generic;
using System.Linq;
using InfinityGrove.Domain;
using Newtonsoft.Json;
using UnityEngine;

namespace InfinityGrove.Service
{
    /// <inheritdoc cref="IPlayerEventLog"/>
    public class PlayerEventLog : IPlayerEventLog
    {
        private readonly List<PlayerEventRecord> _pending = new List<PlayerEventRecord>();
        private long _nextSequenceNumber = 1;

        public IReadOnlyList<PlayerEventRecord> PendingEvents => _pending;
        public long NextSequenceNumber => _nextSequenceNumber;

        public void SeedSequence(long nextSequenceNumber)
        {
            if (nextSequenceNumber > _nextSequenceNumber)
            {
                _nextSequenceNumber = nextSequenceNumber;
            }
        }

        public void LoadPending(IEnumerable<PlayerEventRecord> pending)
        {
            _pending.Clear();
            if (pending == null) return;

            foreach (var record in pending)
            {
                _pending.Add(record);
                SeedSequence(record.SequenceNumber + 1);
            }
        }

        public PlayerEventRecord Append(PlayerEventType type, object payload)
        {
            var record = new PlayerEventRecord
            {
                ClientEventId = Guid.NewGuid(),
                SequenceNumber = _nextSequenceNumber++,
                Type = type,
                OccurredAtUtc = DateTimeOffset.UtcNow,
                PayloadJson = JsonConvert.SerializeObject(payload),
                SyncStatus = PlayerEventSyncStatus.Pending,
            };

            _pending.Add(record);
            return record;
        }

        public void ApplyResult(Guid clientEventId, PlayerEventSyncStatus status, string rejectionReason)
        {
            var record = _pending.FirstOrDefault(e => e.ClientEventId == clientEventId);
            if (record == null)
            {
                Debug.LogWarning($"PlayerEventLog: received a result for unknown event {clientEventId}.");
                return;
            }

            record.SyncStatus = status;
            record.RejectionReason = rejectionReason;
            _pending.Remove(record);
        }
    }
}
