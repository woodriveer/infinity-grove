using InfinityGrove.Backend.Domain.Rewards;

namespace InfinityGrove.Backend.Application.Rewards;

public record RewardGrantDto(
    Guid GrantId,
    string Kind,
    Guid? HeroDefinitionId,
    bool? IsNewHero,
    string? ItemId,
    string? AffixRollsJson,
    Guid SourceClientEventId)
{
    public static RewardGrantDto From(RewardGrant grant) => new(
        grant.Id,
        grant.Kind.ToString(),
        grant.HeroDefinitionId,
        grant.IsNewHero,
        grant.ItemId,
        grant.AffixRollsJson,
        grant.SourceClientEventId);
}
