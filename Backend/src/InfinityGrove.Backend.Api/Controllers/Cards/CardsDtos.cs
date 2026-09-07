using InfinityGrove.Backend.Domain.Cards;

namespace InfinityGrove.Backend.Api.Controllers.Cards;

public record FuseCardRequest(Guid HeroDefinitionId);

public record FusionResponse(
    bool Success,
    string? RejectionReason,
    int? NewStarTier,
    IReadOnlyList<Guid>? ConsumedCardInstanceIds,
    Guid? OutboxEntryId);

public record PrepareToListResponse(bool Success, string? RejectionReason);

public record CardInstanceDto(Guid Id, Guid HeroDefinitionId, string State)
{
    public static CardInstanceDto FromDomain(CardInstance cardInstance) =>
        new(cardInstance.Id, cardInstance.HeroDefinitionId, cardInstance.State.ToString());
}
