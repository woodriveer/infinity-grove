using System.Text.Json;
using InfinityGrove.Backend.Application.Events;
using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Domain.Events;

namespace InfinityGrove.Backend.Tests.Events;

/// <summary>DROP-03 / DROP-04: MonsterKillsBatch validation, the kill bucket and server-side item drops.</summary>
public class MonsterKillsBatchIngestionTests
{
    private static readonly Guid AccountId = Guid.NewGuid();

    private readonly InMemoryProgressRepository _progress = new();
    private readonly InMemoryEventRepository _events = new();
    private readonly InMemoryRewardGrantRepository _grants = new();
    private long _sequence;

    private PlayerEventIngestionService NewService(
        IngestionTestKit.ScriptedRandom? random = null, double normalChance = 0.03, ProgressOptions? options = null) => new(
        _progress, _events, new InMemoryCardRepository(), FixedTimeProvider.Instance,
        options ?? new ProgressOptions { BossEvery = 5 },
        _grants, IngestionTestKit.Catalog(normalChance), random ?? new IngestionTestKit.ScriptedRandom(0.999));

    private IngestEventCommand Event(PlayerEventType type, string payloadJson, Guid? id = null)
    {
        using var doc = JsonDocument.Parse(payloadJson);
        return new IngestEventCommand(id ?? Guid.NewGuid(), ++_sequence, type, FixedTimeProvider.Now, doc.RootElement.Clone());
    }

    private IngestEventCommand Kills(int stage, int count, Guid? id = null) =>
        Event(PlayerEventType.MonsterKillsBatch, $$"""{"stageNumber":{{stage}},"count":{{count}}}""", id);

    private async Task ClearThrough(PlayerEventIngestionService service, int stage)
    {
        var batch = Enumerable.Range(1, stage).Select(s => Event(PlayerEventType.StageCleared, $$"""{"stageNumber":{{s}}}""")).ToList();
        await service.IngestAsync(AccountId, batch, CancellationToken.None);
    }

    [Fact]
    public async Task Ten_kills_with_two_scripted_drops_grant_two_items_with_server_minted_ids()
    {
        // 10 Bernoulli draws: the 3rd and 7th fall under 0.03; then item rolls (template, affix) per drop.
        var draws = new double[] { 0.5, 0.5, 0.01, 0.5, 0.5, 0.5, 0.02, 0.5, 0.5, 0.5, 0.0, 0.0, 0.99, 0.99 };
        var service = NewService(new IngestionTestKit.ScriptedRandom(0.999, draws));

        var result = await service.IngestAsync(AccountId, [Kills(1, 10)], CancellationToken.None);

        var verdict = Assert.Single(result.Results);
        Assert.Equal(PlayerEventStatus.Accepted, verdict.Status);
        Assert.Equal(2, verdict.Grants.Count);
        Assert.All(verdict.Grants, g =>
        {
            Assert.Equal("Item", g.Kind);
            Assert.Equal("blade", g.ItemId);
            Assert.NotEqual(Guid.Empty, g.GrantId);
        });
        Assert.Contains("\"value\":1}", verdict.Grants[0].AffixRollsJson);
        Assert.Contains("\"value\":50}", verdict.Grants[1].AffixRollsJson);
        Assert.Equal(verdict.Grants.Select(g => g.GrantId), _grants.Grants.Select(g => g.Id));
    }

    [Fact]
    public async Task A_zero_drop_chance_grants_nothing()
    {
        var service = NewService(new IngestionTestKit.ScriptedRandom(0.0), normalChance: 0.0);

        var result = await service.IngestAsync(AccountId, [Kills(1, 500)], CancellationToken.None);

        Assert.Equal(PlayerEventStatus.Accepted, Assert.Single(result.Results).Status);
        Assert.Empty(result.Results[0].Grants);
        Assert.Empty(_grants.Grants);
    }

    [Fact]
    public async Task Kills_beyond_the_bucket_are_rejected_whole_and_nothing_is_granted()
    {
        var options = new ProgressOptions { BossEvery = 5, KillBucketCap = 20 };
        var service = NewService(new IngestionTestKit.ScriptedRandom(0.999), options: options);

        var first = await service.IngestAsync(AccountId, [Kills(1, 20)], CancellationToken.None);
        var second = await service.IngestAsync(AccountId, [Kills(1, 1)], CancellationToken.None);

        Assert.Equal(PlayerEventStatus.Accepted, first.Results[0].Status);
        var verdict = Assert.Single(second.Results);
        Assert.Equal(PlayerEventStatus.Rejected, verdict.Status);
        Assert.Equal("Kill rate exceeds the possible maximum.", verdict.RejectionReason);
        Assert.Empty(verdict.Grants);
        Assert.Empty(_grants.Grants);
        Assert.Equal(PlayerEventStatus.Rejected, _events.Events.Last().Status);
    }

    [Theory]
    [InlineData(3, 1, 0, "Cannot clear stage 3 before stage 1.")]
    [InlineData(5, 1, 4, "Stage 5 is a boss stage and has no normal monster kills.")]
    [InlineData(1, 0, 0, "Kill count must be between 1 and 1000.")]
    [InlineData(1, 1001, 0, "Kill count must be between 1 and 1000.")]
    public async Task Invalid_batches_are_rejected_whole_without_grants(int stage, int count, int clearedThrough, string reason)
    {
        var service = NewService(new IngestionTestKit.ScriptedRandom(0.0));
        await ClearThrough(service, clearedThrough);

        var result = await service.IngestAsync(AccountId, [Kills(stage, count)], CancellationToken.None);

        var verdict = Assert.Single(result.Results);
        Assert.Equal(PlayerEventStatus.Rejected, verdict.Status);
        Assert.Equal(reason, verdict.RejectionReason);
        Assert.Empty(verdict.Grants);
        Assert.Empty(_grants.Grants);
    }

    [Fact]
    public async Task A_rejected_batch_does_not_spend_the_bucket()
    {
        var options = new ProgressOptions { BossEvery = 5, KillBucketCap = 10 };
        var service = NewService(new IngestionTestKit.ScriptedRandom(0.999), options: options);

        await service.IngestAsync(AccountId, [Kills(1, 11)], CancellationToken.None);
        var result = await service.IngestAsync(AccountId, [Kills(1, 10)], CancellationToken.None);

        Assert.Equal(PlayerEventStatus.Accepted, Assert.Single(result.Results).Status);
    }

    [Fact]
    public async Task Resending_a_recorded_batch_returns_the_same_grants_and_rolls_nothing_new()
    {
        var service = NewService(new IngestionTestKit.ScriptedRandom(0.0));
        var batch = Kills(1, 3);

        var first = await service.IngestAsync(AccountId, [batch], CancellationToken.None);
        var resent = await service.IngestAsync(AccountId, [batch], CancellationToken.None);

        Assert.Equal(3, first.Results[0].Grants.Count);
        Assert.Equal(first.Results[0].Grants.Select(g => g.GrantId), resent.Results[0].Grants.Select(g => g.GrantId));
        Assert.Equal(3, _grants.Grants.Count);
    }

    [Theory]
    [InlineData("""{"stageNumber":"one","count":3}""")]
    [InlineData("""[1,3]""")]
    public async Task A_malformed_payload_is_rejected(string payloadJson)
    {
        var service = NewService();

        var result = await service.IngestAsync(AccountId, [Event(PlayerEventType.MonsterKillsBatch, payloadJson)], CancellationToken.None);

        Assert.Equal("Malformed MonsterKillsBatch payload.", Assert.Single(result.Results).RejectionReason);
    }
}
