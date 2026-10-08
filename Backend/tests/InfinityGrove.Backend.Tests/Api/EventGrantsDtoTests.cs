using InfinityGrove.Backend.Api.Controllers.Events;
using InfinityGrove.Backend.Application.Events;
using InfinityGrove.Backend.Application.Rewards;
using InfinityGrove.Backend.Domain.Events;
using InfinityGrove.Backend.Domain.Rewards;
using InfinityGrove.Backend.Tests.Events;

namespace InfinityGrove.Backend.Tests.Api;

public class EventGrantsDtoTests
{
    [Fact]
    public void Item_grants_reach_the_wire_with_parsed_affix_rolls()
    {
        var source = Guid.NewGuid();
        var grant = RewardGrant.ForItem(Guid.NewGuid(), source, "bark-blade", "[{\"affix\":\"power\",\"value\":3}]", FixedTimeProvider.Now);
        var result = new EventIngestionResult(source, PlayerEventStatus.Accepted, null, [RewardGrantDto.From(grant)]);

        var dto = EventIngestionResultDto.FromResult(result);

        var wire = Assert.Single(dto.Grants);
        Assert.Equal(grant.Id, wire.GrantId);
        Assert.Equal("Item", wire.Kind);
        Assert.Equal(source, wire.SourceClientEventId);
        Assert.Equal("bark-blade", wire.ItemId);
        Assert.Equal(new AffixRollDto("power", 3), Assert.Single(wire.AffixRolls!));
        Assert.Null(wire.HeroDefinitionId);
    }

    [Fact]
    public void Hero_grants_carry_the_hero_and_whether_it_is_new()
    {
        var hero = Guid.NewGuid();
        var grant = RewardGrant.ForHero(Guid.NewGuid(), Guid.NewGuid(), hero, isNewHero: false, FixedTimeProvider.Now);

        var wire = RewardGrantResponseDto.From(RewardGrantDto.From(grant));

        Assert.Equal("Hero", wire.Kind);
        Assert.Equal(hero, wire.HeroDefinitionId);
        Assert.False(wire.IsNewHero);
        Assert.Null(wire.AffixRolls);
    }

    [Fact]
    public void Results_without_grants_serialize_an_empty_list()
    {
        var dto = EventIngestionResultDto.FromResult(new EventIngestionResult(Guid.NewGuid(), PlayerEventStatus.Rejected, "no"));

        Assert.Empty(dto.Grants);
        Assert.Equal("no", dto.RejectionReason);
    }
}
