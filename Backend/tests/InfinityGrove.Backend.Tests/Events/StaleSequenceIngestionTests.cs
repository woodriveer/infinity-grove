using System.Text.Json;
using InfinityGrove.Backend.Application.Events;
using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Domain.Events;

namespace InfinityGrove.Backend.Tests.Events;

/// <summary>SESSION-03: an unknown event behind the cursor is rejected, not silently accepted.</summary>
public class StaleSequenceIngestionTests
{
    private static readonly Guid AccountId = Guid.NewGuid();

    private readonly InMemoryProgressRepository _progress = new();
    private readonly InMemoryEventRepository _events = new();

    private PlayerEventIngestionService NewService() => new(
        _progress, _events, new InMemoryCardRepository(), FixedTimeProvider.Instance,
        new ProgressOptions { BossEvery = 5 });

    private static IngestEventCommand StageCleared(long sequence, int stage, Guid? id = null)
    {
        using var doc = JsonDocument.Parse($$"""{"stageNumber":{{stage}}}""");
        return new IngestEventCommand(id ?? Guid.NewGuid(), sequence, PlayerEventType.StageCleared, FixedTimeProvider.Now, doc.RootElement.Clone());
    }

    private async Task<PlayerEventIngestionService> WithCursorAt3()
    {
        var service = NewService();
        await service.IngestAsync(AccountId, [StageCleared(1, 1), StageCleared(2, 2), StageCleared(3, 3)], CancellationToken.None);
        return service;
    }

    [Fact]
    public async Task An_unknown_event_behind_the_cursor_is_rejected_with_the_exact_reason_and_not_persisted()
    {
        var service = await WithCursorAt3();
        var stored = _events.Events.Count;

        var result = await service.IngestAsync(AccountId, [StageCleared(2, 4)], CancellationToken.None);

        var verdict = Assert.Single(result.Results);
        Assert.Equal(PlayerEventStatus.Rejected, verdict.Status);
        Assert.Equal("Stale sequence; resend after login.", verdict.RejectionReason);
        Assert.Equal(stored, _events.Events.Count);
        Assert.Equal(3, _progress.Find(AccountId)!.LastAppliedSequence);
        Assert.Equal(3, result.CanonicalState.FurthestStageCleared);
    }

    [Fact]
    public async Task An_unknown_event_exactly_at_the_cursor_is_rejected_as_stale()
    {
        var service = await WithCursorAt3();

        var result = await service.IngestAsync(AccountId, [StageCleared(3, 4)], CancellationToken.None);

        var verdict = Assert.Single(result.Results);
        Assert.Equal(PlayerEventStatus.Rejected, verdict.Status);
        Assert.Equal("Stale sequence; resend after login.", verdict.RejectionReason);
        Assert.Equal(3, _progress.Find(AccountId)!.LastAppliedSequence);
    }

    [Fact]
    public async Task The_same_event_id_renumbered_above_the_cursor_is_then_accepted()
    {
        var service = await WithCursorAt3();
        var id = Guid.NewGuid();
        var first = await service.IngestAsync(AccountId, [StageCleared(1, 4, id)], CancellationToken.None);
        Assert.Equal(PlayerEventStatus.Rejected, Assert.Single(first.Results).Status);

        var second = await service.IngestAsync(AccountId, [StageCleared(4, 4, id)], CancellationToken.None);

        Assert.Equal(PlayerEventStatus.Accepted, Assert.Single(second.Results).Status);
        Assert.Equal(4, second.CanonicalState.FurthestStageCleared);
        Assert.Equal(4, _progress.Find(AccountId)!.LastAppliedSequence);
    }

    [Fact]
    public async Task A_known_event_id_resent_behind_the_cursor_returns_its_prior_verdict()
    {
        var service = NewService();
        var id = Guid.NewGuid();
        await service.IngestAsync(AccountId, [StageCleared(1, 1, id), StageCleared(2, 2)], CancellationToken.None);

        var result = await service.IngestAsync(AccountId, [StageCleared(1, 1, id)], CancellationToken.None);

        var verdict = Assert.Single(result.Results);
        Assert.Equal(PlayerEventStatus.Accepted, verdict.Status);
        Assert.Null(verdict.RejectionReason);
    }
}
