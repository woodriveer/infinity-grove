using System.Text.Json;
using InfinityGrove.Backend.Domain.Events;

namespace InfinityGrove.Backend.Application.Events;

/// <summary>One client-submitted event awaiting replay, as received from the batch endpoint (AD-6, AD-10).</summary>
public record IngestEventCommand(
    Guid ClientEventId,
    long SequenceNumber,
    PlayerEventType Type,
    DateTimeOffset OccurredAtUtc,
    JsonElement Payload);

public record EventIngestionResult(Guid ClientEventId, PlayerEventStatus Status, string? RejectionReason);

public record RosterEntrySnapshot(Guid HeroDefinitionId, int OwnedCount, int StarTier);

/// <summary>The canonical state the client reconciles its local view against after every batch (AD-6, AD-9).</summary>
public record PlayerProgressSnapshot(
    double GoldMantissa,
    int GoldExponent,
    int FurthestStageCleared,
    long LastAppliedSequence,
    IReadOnlyList<RosterEntrySnapshot> Roster,
    IReadOnlyList<Guid> ActiveSquadHeroIds)
{
    public static PlayerProgressSnapshot Empty() => new(0, 0, 0, 0, [], []);
}

public record IngestBatchResult(IReadOnlyList<EventIngestionResult> Results, PlayerProgressSnapshot CanonicalState);
