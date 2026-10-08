using System.Text.Json;
using InfinityGrove.Backend.Application.Events;
using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Domain.Events;

namespace InfinityGrove.Backend.Tests.Events;

/// <summary>DROP-01 / DROP-03 / DROP-04 / DROP-05: hero and item grants on BossDefeated.</summary>
public class BossDropsIngestionTests
{
    private static readonly Guid AccountId = Guid.NewGuid();

    private readonly InMemoryProgressRepository _progress = new();
    private readonly InMemoryEventRepository _events = new();
    private readonly InMemoryRewardGrantRepository _grants = new();
    private readonly InMemoryCardRepository _cards = new();
    private long _sequence;

    private PlayerEventIngestionService NewService(IngestionTestKit.ScriptedRandom random) => new(
        _progress, _events, _cards, FixedTimeProvider.Instance, new ProgressOptions { BossEvery = 5 },
        _grants, IngestionTestKit.Catalog(), random);

    private IngestEventCommand Event(PlayerEventType type, string payloadJson, Guid? id = null)
    {
        using var doc = JsonDocument.Parse(payloadJson);
        return new IngestEventCommand(id ?? Guid.NewGuid(), ++_sequence, type, FixedTimeProvider.Now, doc.RootElement.Clone());
    }

    private IngestEventCommand Boss(int stage, Guid? id = null) =>
        Event(PlayerEventType.BossDefeated, $$"""{"stageNumber":{{stage}}}""", id);

    private async Task ClearThrough(PlayerEventIngestionService service, int stage)
    {
        var batch = Enumerable.Range(1, stage).Select(s => Event(PlayerEventType.StageCleared, $$"""{"stageNumber":{{s}}}""")).ToList();
        await service.IngestAsync(AccountId, batch, CancellationToken.None);
    }

    // Draw order: hero chance, [type, hero index], item chance, [template, affix].
    [Fact]
    public async Task First_defeat_always_grants_a_hero_that_lands_in_the_canonical_roster()
    {
        var service = NewService(new IngestionTestKit.ScriptedRandom(0.5, 0.9999));
        await ClearThrough(service, 4);

        var result = await service.IngestAsync(AccountId, [Boss(5)], CancellationToken.None);

        var grant = Assert.Single(Assert.Single(result.Results).Grants);
        Assert.Equal("Hero", grant.Kind);
        Assert.Equal(IngestionTestKit.Hero, grant.HeroDefinitionId);
        Assert.True(grant.IsNewHero);
        Assert.Contains(result.CanonicalState.Roster, r => r.HeroDefinitionId == IngestionTestKit.Hero && r.OwnedCount == 1);
        Assert.Single(await _cards.GetByAccountAsync(AccountId, CancellationToken.None));
        Assert.Single(_grants.Grants);
    }

    [Theory]
    [InlineData(0.009, 1)]
    [InlineData(0.011, 0)]
    public async Task A_repeat_defeat_grants_a_hero_at_one_percent(double roll, int heroGrants)
    {
        var first = NewService(new IngestionTestKit.ScriptedRandom(0.999));
        await ClearThrough(first, 4);
        await first.IngestAsync(AccountId, [Boss(5)], CancellationToken.None);
        var repeat = NewService(new IngestionTestKit.ScriptedRandom(0.5, roll));

        var result = await repeat.IngestAsync(AccountId, [Boss(5)], CancellationToken.None);

        var grants = result.Results[0].Grants.Where(g => g.Kind == "Hero").ToList();
        Assert.Equal(heroGrants, grants.Count);
        if (heroGrants == 1)
        {
            Assert.False(grants[0].IsNewHero);
            Assert.Contains(result.CanonicalState.Roster, r => r.OwnedCount == 2);
        }
    }

    [Theory]
    [InlineData(0.999, 0.1, 1, 1)] // first defeat: hero yes, item yes (0.1 < 0.25)
    [InlineData(0.999, 0.3, 1, 0)] // hero yes, item no
    public async Task Hero_and_item_are_rolled_independently_on_a_first_defeat(double heroRoll, double itemRoll, int heroes, int items)
    {
        // hero chance, type, hero idx, item chance, template, affix
        var service = NewService(new IngestionTestKit.ScriptedRandom(0.5, heroRoll, 0.5, 0.5, itemRoll));
        await ClearThrough(service, 4);

        var result = await service.IngestAsync(AccountId, [Boss(5)], CancellationToken.None);

        var grants = result.Results[0].Grants;
        Assert.Equal(heroes, grants.Count(g => g.Kind == "Hero"));
        Assert.Equal(items, grants.Count(g => g.Kind == "Item"));
    }

    [Fact]
    public async Task An_item_can_drop_without_a_hero_on_a_repeat_defeat()
    {
        var first = NewService(new IngestionTestKit.ScriptedRandom(0.999));
        await ClearThrough(first, 4);
        await first.IngestAsync(AccountId, [Boss(5)], CancellationToken.None);
        var repeat = NewService(new IngestionTestKit.ScriptedRandom(0.5, 0.5, 0.1));

        var result = await repeat.IngestAsync(AccountId, [Boss(5)], CancellationToken.None);

        var grant = Assert.Single(result.Results[0].Grants);
        Assert.Equal("Item", grant.Kind);
        Assert.Equal("blade", grant.ItemId);
    }

    [Fact]
    public async Task A_boss_beyond_furthest_plus_one_is_rejected_without_grants()
    {
        var service = NewService(new IngestionTestKit.ScriptedRandom(0.0));
        await ClearThrough(service, 4);

        var result = await service.IngestAsync(AccountId, [Boss(10)], CancellationToken.None);

        var verdict = Assert.Single(result.Results);
        Assert.Equal(PlayerEventStatus.Rejected, verdict.Status);
        Assert.Equal("Cannot clear stage 10 before stage 5.", verdict.RejectionReason);
        Assert.Empty(verdict.Grants);
        Assert.Empty(_grants.Grants);
        Assert.Empty(await _cards.GetByAccountAsync(AccountId, CancellationToken.None));
    }

    [Fact]
    public async Task The_same_first_defeat_from_a_second_device_is_a_repeat_and_a_resend_returns_stored_grants()
    {
        var service = NewService(new IngestionTestKit.ScriptedRandom(0.5, 0.9999, 0.5, 0.5, 0.99));
        await ClearThrough(service, 4);
        var firstDevice = Boss(5);

        var first = await service.IngestAsync(AccountId, [firstDevice], CancellationToken.None);
        var secondDevice = await service.IngestAsync(AccountId, [Boss(5)], CancellationToken.None);
        var resent = await service.IngestAsync(AccountId, [firstDevice], CancellationToken.None);

        Assert.Single(first.Results[0].Grants, g => g.Kind == "Hero");
        Assert.DoesNotContain(secondDevice.Results[0].Grants, g => g.Kind == "Hero");
        Assert.Equal(first.Results[0].Grants.Select(g => g.GrantId), resent.Results[0].Grants.Select(g => g.GrantId));
        Assert.Single(await _cards.GetByAccountAsync(AccountId, CancellationToken.None));
    }
}
