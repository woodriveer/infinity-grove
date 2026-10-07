using System.Text.Json;
using InfinityGrove.Backend.Application.Events;
using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Domain.Events;

namespace InfinityGrove.Backend.Tests.Events;

/// <summary>
/// COMBAT-04 / COMBAT-08: <see cref="PlayerEventIngestionService"/> ingests queued
/// BossDefeated events and applies the boss-stage rule with the configured BossEvery.
/// </summary>
public class BossDefeatedIngestionTests
{
    private static readonly Guid AccountId = Guid.NewGuid();

    private readonly InMemoryProgressRepository _progress = new();
    private readonly InMemoryEventRepository _events = new();
    private long _sequence;

    private PlayerEventIngestionService NewService(int bossEvery = 5) => new(
        _progress, _events, new InMemoryCardRepository(), FixedTimeProvider.Instance,
        new ProgressOptions { BossEvery = bossEvery });

    private IngestEventCommand Event(PlayerEventType type, string payloadJson)
    {
        using var doc = JsonDocument.Parse(payloadJson);
        return new IngestEventCommand(Guid.NewGuid(), ++_sequence, type, FixedTimeProvider.Now, doc.RootElement.Clone());
    }

    private IngestEventCommand StageCleared(int stage) => Event(PlayerEventType.StageCleared, $$"""{"stageNumber":{{stage}}}""");

    private IngestEventCommand BossDefeated(int stage) => Event(PlayerEventType.BossDefeated, $$"""{"stageNumber":{{stage}}}""");

    private async Task ClearThrough(PlayerEventIngestionService service, int stage)
    {
        var batch = Enumerable.Range(1, stage).Select(StageCleared).ToList();
        var result = await service.IngestAsync(AccountId, batch, CancellationToken.None);
        Assert.All(result.Results, r => Assert.Equal(PlayerEventStatus.Accepted, r.Status));
    }

    [Fact]
    public async Task A_batch_with_BossDefeated_then_StageCleared_of_the_boss_stage_is_accepted()
    {
        var service = NewService();
        await ClearThrough(service, 4);

        var result = await service.IngestAsync(AccountId, [BossDefeated(5), StageCleared(5)], CancellationToken.None);

        Assert.Equal(
            [(PlayerEventStatus.Accepted, (string?)null), (PlayerEventStatus.Accepted, null)],
            result.Results.Select(r => (r.Status, r.RejectionReason)));
        Assert.Equal(5, result.CanonicalState.FurthestStageCleared);
        Assert.Equal(5, _progress.Find(AccountId)!.HighestBossDefeated);
        var stored = _events.Events.Single(e => e.Type == PlayerEventType.BossDefeated);
        Assert.Equal(PlayerEventStatus.Accepted, stored.Status);
    }

    [Fact]
    public async Task StageCleared_of_a_boss_stage_without_its_BossDefeated_is_rejected()
    {
        var service = NewService();
        await ClearThrough(service, 4);

        var result = await service.IngestAsync(AccountId, [StageCleared(5)], CancellationToken.None);

        var verdict = Assert.Single(result.Results);
        Assert.Equal(PlayerEventStatus.Rejected, verdict.Status);
        Assert.Equal("Cannot clear boss stage 5 before defeating its boss.", verdict.RejectionReason);
        Assert.Equal(4, result.CanonicalState.FurthestStageCleared);
        Assert.Equal(0, _progress.Find(AccountId)!.HighestBossDefeated);
    }

    [Theory]
    [InlineData("""{"stageNumber":"five"}""")]
    [InlineData("""[5]""")]
    public async Task A_malformed_BossDefeated_payload_is_rejected(string payloadJson)
    {
        var service = NewService();
        await ClearThrough(service, 4);

        var result = await service.IngestAsync(AccountId, [Event(PlayerEventType.BossDefeated, payloadJson)], CancellationToken.None);

        var verdict = Assert.Single(result.Results);
        Assert.Equal(PlayerEventStatus.Rejected, verdict.Status);
        Assert.Equal("Malformed BossDefeated payload.", verdict.RejectionReason);
        Assert.Equal(0, _progress.Find(AccountId)!.HighestBossDefeated);
    }

    [Fact]
    public async Task The_configured_BossEvery_decides_which_stages_are_boss_stages()
    {
        var service = NewService(bossEvery: 3);
        await ClearThrough(service, 2);

        var rejected = await service.IngestAsync(AccountId, [StageCleared(3)], CancellationToken.None);
        var accepted = await service.IngestAsync(AccountId, [BossDefeated(3), StageCleared(3)], CancellationToken.None);

        Assert.Equal("Cannot clear boss stage 3 before defeating its boss.", Assert.Single(rejected.Results).RejectionReason);
        Assert.All(accepted.Results, r => Assert.Equal(PlayerEventStatus.Accepted, r.Status));
        Assert.Equal(3, accepted.CanonicalState.FurthestStageCleared);
    }
}
