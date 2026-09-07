using InfinityGrove.Backend.Application.Events;

namespace InfinityGrove.Backend.Api.Controllers.Events;

public record RosterEntryDto(Guid HeroDefinitionId, int OwnedCount, int StarTier)
{
    public static RosterEntryDto FromSnapshot(RosterEntrySnapshot snapshot) =>
        new(snapshot.HeroDefinitionId, snapshot.OwnedCount, snapshot.StarTier);
}

/// <summary>The canonical state the client reconciles against (AD-6, AD-9). Gold travels as the same mantissa/exponent pair BreakInfinity.cs uses (AD-7).</summary>
public record PlayerStateDto(
    double GoldMantissa,
    int GoldExponent,
    int FurthestStageCleared,
    long LastAppliedSequence,
    IReadOnlyList<RosterEntryDto> Roster,
    IReadOnlyList<Guid> ActiveSquadHeroIds)
{
    public static PlayerStateDto FromSnapshot(PlayerProgressSnapshot snapshot) => new(
        snapshot.GoldMantissa,
        snapshot.GoldExponent,
        snapshot.FurthestStageCleared,
        snapshot.LastAppliedSequence,
        [.. snapshot.Roster.Select(RosterEntryDto.FromSnapshot)],
        snapshot.ActiveSquadHeroIds);
}

public record EventIngestionResultDto(Guid ClientEventId, string Status, string? RejectionReason)
{
    public static EventIngestionResultDto FromResult(EventIngestionResult result) =>
        new(result.ClientEventId, result.Status.ToString(), result.RejectionReason);
}

public record IngestEventsBatchResponse(IReadOnlyList<EventIngestionResultDto> Results, PlayerStateDto State);
