namespace InfinityGrove.Backend.Domain.Events;

/// <summary>
/// One immutable row in the append-only event log (AD-6). Never updated after
/// creation — a rejected event is recorded as Rejected, not deleted or corrected,
/// so the log remains a full audit trail (also what FR-33/FR-45's anti-tamper
/// trail and NFR-8's abuse-detection job read from).
/// </summary>
public class PlayerEvent
{
    public Guid Id { get; private set; }
    public Guid AccountId { get; private set; }

    /// <summary>Client-assigned id used to de-duplicate a batch resent after a network failure.</summary>
    public Guid ClientEventId { get; private set; }

    /// <summary>Per-account monotonic sequence assigned by the client, used to order and gap-check replay.</summary>
    public long SequenceNumber { get; private set; }

    public PlayerEventType Type { get; private set; }

    /// <summary>Raw JSON payload as submitted, shaped per <see cref="Type"/>.</summary>
    public string PayloadJson { get; private set; } = null!;

    public DateTimeOffset OccurredAtUtc { get; private set; }
    public DateTimeOffset ReceivedAtUtc { get; private set; }

    public PlayerEventStatus Status { get; private set; }
    public string? RejectionReason { get; private set; }

    private PlayerEvent()
    {
    }

    private static PlayerEvent Create(
        Guid accountId,
        Guid clientEventId,
        long sequenceNumber,
        PlayerEventType type,
        string payloadJson,
        DateTimeOffset occurredAtUtc,
        DateTimeOffset receivedAtUtc,
        PlayerEventStatus status,
        string? rejectionReason) => new()
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            ClientEventId = clientEventId,
            SequenceNumber = sequenceNumber,
            Type = type,
            PayloadJson = payloadJson,
            OccurredAtUtc = occurredAtUtc,
            ReceivedAtUtc = receivedAtUtc,
            Status = status,
            RejectionReason = rejectionReason,
        };

    public static PlayerEvent Accepted(
        Guid accountId,
        Guid clientEventId,
        long sequenceNumber,
        PlayerEventType type,
        string payloadJson,
        DateTimeOffset occurredAtUtc,
        DateTimeOffset receivedAtUtc) =>
        Create(accountId, clientEventId, sequenceNumber, type, payloadJson, occurredAtUtc, receivedAtUtc, PlayerEventStatus.Accepted, null);

    public static PlayerEvent Rejected(
        Guid accountId,
        Guid clientEventId,
        long sequenceNumber,
        PlayerEventType type,
        string payloadJson,
        DateTimeOffset occurredAtUtc,
        DateTimeOffset receivedAtUtc,
        string reason) =>
        Create(accountId, clientEventId, sequenceNumber, type, payloadJson, occurredAtUtc, receivedAtUtc, PlayerEventStatus.Rejected, reason);
}
