namespace InfinityGrove.Backend.Application.Events;

/// <summary>
/// Wire shapes for each <see cref="Domain.Events.PlayerEventType"/>'s payload.
/// Gold amounts travel as the same (mantissa, exponent) pair BreakInfinity.cs uses
/// internally (AD-7) so no precision is lost converting to/from JSON.
/// </summary>
public record GoldEarnedPayload(double GoldMantissa, int GoldExponent);

public record GoldSpentPayload(double GoldMantissa, int GoldExponent);

public record StageClearedPayload(int StageNumber);

public record HeroAcquiredPayload(Guid HeroDefinitionId);

public record ActiveSquadChangedPayload(IReadOnlyList<Guid> HeroDefinitionIds);

// Fusion (AD-8) is a synchronous request/response flow, not a client-submitted
// batched event — see InfinityGrove.Backend.Application.Cards.IFusionService.
// No PlayerEventType/payload exists for it here.
