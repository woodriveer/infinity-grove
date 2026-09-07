using System;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// Surfaced to the player exactly when the backend rejects one of their
    /// locally-applied actions (AD-6: "client reconciles silently unless an event
    /// is rejected, in which case it corrects the client and surfaces why").
    /// Everything else about reconciliation stays invisible to the player by design.
    /// </summary>
    public class ReconciliationCorrection
    {
        public PlayerEventType EventType { get; }
        public string Reason { get; }
        public DateTimeOffset OccurredAtUtc { get; }

        public ReconciliationCorrection(PlayerEventType eventType, string reason, DateTimeOffset occurredAtUtc)
        {
            EventType = eventType;
            Reason = reason;
            OccurredAtUtc = occurredAtUtc;
        }

        public string ToPlayerMessage()
        {
            switch (EventType)
            {
                case PlayerEventType.GoldEarned:
                case PlayerEventType.GoldSpent:
                    return $"Your gold was corrected by the server: {Reason}";
                case PlayerEventType.StageCleared:
                    return $"Your stage progress was corrected by the server: {Reason}";
                case PlayerEventType.HeroAcquired:
                    return $"A hero acquisition was rejected by the server: {Reason}";
                case PlayerEventType.ActiveSquadChanged:
                    return $"Your Active Squad was corrected by the server: {Reason}";
                default:
                    return $"An action was corrected by the server: {Reason}";
            }
        }
    }
}
