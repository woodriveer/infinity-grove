using InfinityGrove.Backend.Application.Rewards;
using InfinityGrove.Backend.Domain.Rewards;
using InfinityGrove.Backend.Tests.Events;

namespace InfinityGrove.Backend.Tests.Rewards;

public class RewardGrantTests
{
    private static readonly DateTimeOffset Now = FixedTimeProvider.Now;
    private const string Rolls = "[{\"affix\":\"power\",\"value\":3}]";

    [Fact]
    public async Task Stored_grants_come_back_by_source_event_id()
    {
        var repo = new InMemoryRewardGrantRepository();
        var account = Guid.NewGuid();
        var eventA = Guid.NewGuid();
        var eventB = Guid.NewGuid();
        var item = RewardGrant.ForItem(account, eventA, "iron-sword", Rolls, Now);
        var hero = RewardGrant.ForHero(account, eventA, Guid.NewGuid(), isNewHero: true, Now);
        var other = RewardGrant.ForItem(account, eventB, "oak-staff", Rolls, Now);
        await repo.AddRangeAsync([item, hero, other], CancellationToken.None);

        var found = await repo.ListBySourceEventAsync(account, eventA, CancellationToken.None);

        Assert.Equal(new[] { item.Id, hero.Id }.Order(), found.Select(g => g.Id).Order());
    }

    [Fact]
    public async Task Grants_are_only_returned_to_the_owning_account()
    {
        var repo = new InMemoryRewardGrantRepository();
        var owner = Guid.NewGuid();
        var sourceEvent = Guid.NewGuid();
        await repo.AddRangeAsync([RewardGrant.ForItem(owner, sourceEvent, "iron-sword", Rolls, Now)], CancellationToken.None);

        Assert.Empty(await repo.ListBySourceEventAsync(Guid.NewGuid(), sourceEvent, CancellationToken.None));
        Assert.Single(await repo.ListBySourceEventAsync(owner, sourceEvent, CancellationToken.None));
    }

    [Fact]
    public void Hero_and_item_factories_fill_only_their_own_fields_and_mint_distinct_ids()
    {
        var account = Guid.NewGuid();
        var sourceEvent = Guid.NewGuid();
        var heroId = Guid.NewGuid();
        var hero = RewardGrant.ForHero(account, sourceEvent, heroId, isNewHero: false, Now);
        var item = RewardGrant.ForItem(account, sourceEvent, "iron-sword", Rolls, Now);

        Assert.Equal(RewardGrantKind.Hero, hero.Kind);
        Assert.Equal(heroId, hero.HeroDefinitionId);
        Assert.False(hero.IsNewHero);
        Assert.Null(hero.ItemId);
        Assert.Equal(RewardGrantKind.Item, item.Kind);
        Assert.Equal("iron-sword", item.ItemId);
        Assert.Equal(Rolls, item.AffixRollsJson);
        Assert.Null(item.HeroDefinitionId);
        Assert.NotEqual(hero.Id, item.Id);
    }

    [Fact]
    public void Dto_carries_the_grant_fields()
    {
        var grant = RewardGrant.ForItem(Guid.NewGuid(), Guid.NewGuid(), "iron-sword", Rolls, Now);

        var dto = RewardGrantDto.From(grant);

        Assert.Equal(grant.Id, dto.GrantId);
        Assert.Equal("Item", dto.Kind);
        Assert.Equal("iron-sword", dto.ItemId);
        Assert.Equal(Rolls, dto.AffixRollsJson);
        Assert.Equal(grant.SourceClientEventId, dto.SourceClientEventId);
    }
}
