using InfinityGrove.Backend.Domain.Events;
using InfinityGrove.Backend.Domain.Progress;

namespace InfinityGrove.Backend.Tests.Progress;

/// <summary>FR-11/FR-13 order rule of <see cref="PlayerProgress.ApplyStageCleared"/>.</summary>
public class PlayerProgressStageClearedTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = Created.AddMinutes(5);

    private static PlayerProgress NewProgress() => PlayerProgress.CreateForAccount(Guid.NewGuid(), Created);

    [Fact]
    public void Clearing_the_next_stage_advances_furthest_stage()
    {
        var progress = NewProgress();

        progress.ApplyStageCleared(1, Later);
        progress.ApplyStageCleared(2, Later);

        Assert.Equal(2, progress.FurthestStageCleared);
        Assert.Equal(Later, progress.UpdatedAtUtc);
    }

    [Fact]
    public void Replaying_a_cleared_stage_is_a_no_op()
    {
        var progress = NewProgress();
        progress.ApplyStageCleared(1, Later);
        progress.ApplyStageCleared(2, Later);

        progress.ApplyStageCleared(1, Later);

        Assert.Equal(2, progress.FurthestStageCleared);
    }

    [Fact]
    public void Skipping_ahead_is_rejected_and_leaves_progress_unchanged()
    {
        var progress = NewProgress();
        progress.ApplyStageCleared(1, Later);

        var error = Assert.Throws<EventValidationException>(() => progress.ApplyStageCleared(3, Later));

        Assert.Equal("Cannot clear stage 3 before stage 2.", error.Message);
        Assert.Equal(1, progress.FurthestStageCleared);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Stage_numbers_below_one_are_rejected(int stageNumber)
    {
        var progress = NewProgress();

        var error = Assert.Throws<EventValidationException>(() => progress.ApplyStageCleared(stageNumber, Later));

        Assert.Equal("Stage number must be positive.", error.Message);
        Assert.Equal(0, progress.FurthestStageCleared);
        Assert.Equal(Created, progress.UpdatedAtUtc);
    }
}
