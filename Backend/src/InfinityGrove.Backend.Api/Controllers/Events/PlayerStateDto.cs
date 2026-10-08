using System.Text.Json;
using InfinityGrove.Backend.Application.Events;
using InfinityGrove.Backend.Application.Rewards;

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

public record AffixRollDto(string Affix, int Value);

/// <summary>One reward the server decided for an event (AD-001); the client applies it once by <see cref="GrantId"/>.</summary>
public record RewardGrantResponseDto(
    Guid GrantId,
    string Kind,
    Guid SourceClientEventId,
    Guid? HeroDefinitionId,
    bool? IsNewHero,
    string? ItemId,
    IReadOnlyList<AffixRollDto>? AffixRolls)
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static RewardGrantResponseDto From(RewardGrantDto grant) => new(
        grant.GrantId,
        grant.Kind,
        grant.SourceClientEventId,
        grant.HeroDefinitionId,
        grant.IsNewHero,
        grant.ItemId,
        grant.AffixRollsJson is null
            ? null
            : JsonSerializer.Deserialize<List<AffixRollDto>>(grant.AffixRollsJson, Web));
}

public record EventIngestionResultDto(
    Guid ClientEventId, string Status, string? RejectionReason, IReadOnlyList<RewardGrantResponseDto> Grants)
{
    public static EventIngestionResultDto FromResult(EventIngestionResult result) =>
        new(result.ClientEventId, result.Status.ToString(), result.RejectionReason,
            [.. result.Grants.Select(RewardGrantResponseDto.From)]);
}

public record IngestEventsBatchResponse(IReadOnlyList<EventIngestionResultDto> Results, PlayerStateDto State);
