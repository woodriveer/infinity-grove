using InfinityGrove.Backend.Domain.Events;
using InfinityGrove.Backend.Domain.Progress;

namespace InfinityGrove.Backend.Tests.Progress;

/// <summary>
/// COMBAT-04 / AD-002: order rule of <see cref="PlayerProgress.ApplyBossDefeated"/> and the
/// boss-stage guard of <see cref="PlayerProgress.ApplyStageCleared"/>.
/// </summary>
public class PlayerProgressBossDefeatedTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = Created.AddMinutes(5);
    private const int BossEvery = 5;

    private static PlayerProgress NewProgress() => PlayerProgress.CreateForAccount(Guid.NewGuid(), Created);

    private static PlayerProgress ClearedThrough(int stageNumber)
    {
        var progress = NewProgress();
        for (var stage = 1; stage <= stageNumber; stage++)
        {
            if (PlayerProgress.IsBossStage(stage, BossEvery))
            {
                progress.ApplyBossDefeated(stage, BossEvery, Created);
            }

            progress.ApplyStageCleared(stage, BossEvery, Created);
        }

        return progress;
    }

    [Fact]
    public void Defeating_the_boss_of_the_next_stage_records_it()
    {
        var progress = ClearedThrough(4);

        progress.ApplyBossDefeated(5, BossEvery, Later);

        Assert.Equal(5, progress.HighestBossDefeated);
        Assert.Equal(4, progress.FurthestStageCleared);
        Assert.Equal(Later, progress.UpdatedAtUtc);
    }

    [Fact]
    public void Replaying_a_defeated_boss_is_a_no_op()
    {
        var progress = ClearedThrough(10);

        progress.ApplyBossDefeated(5, BossEvery, Later);

        Assert.Equal(10, progress.HighestBossDefeated);
        Assert.Equal(10, progress.FurthestStageCleared);
    }

    [Fact]
    public void Defeating_a_boss_ahead_of_progress_is_rejected()
    {
        var progress = ClearedThrough(4);

        var error = Assert.Throws<EventValidationException>(() => progress.ApplyBossDefeated(10, BossEvery, Later));

        Assert.Equal("Cannot clear stage 10 before stage 5.", error.Message);
        Assert.Equal(0, progress.HighestBossDefeated);
        Assert.Equal(Created, progress.UpdatedAtUtc);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void Boss_stage_numbers_below_one_are_rejected(int stageNumber)
    {
        var progress = NewProgress();

        var error = Assert.Throws<EventValidationException>(
            () => progress.ApplyBossDefeated(stageNumber, BossEvery, Later));

        Assert.Equal("Stage number must be positive.", error.Message);
        Assert.Equal(0, progress.HighestBossDefeated);
    }

    [Fact]
    public void Defeating_a_boss_on_a_non_boss_stage_is_rejected()
    {
        var progress = ClearedThrough(3);

        var error = Assert.Throws<EventValidationException>(() => progress.ApplyBossDefeated(4, BossEvery, Later));

        Assert.Equal("Stage 4 is not a boss stage.", error.Message);
        Assert.Equal(0, progress.HighestBossDefeated);
        Assert.Equal(Created, progress.UpdatedAtUtc);
    }

    [Fact]
    public void Clearing_a_boss_stage_before_its_boss_is_rejected()
    {
        var progress = ClearedThrough(4);

        var error = Assert.Throws<EventValidationException>(() => progress.ApplyStageCleared(5, BossEvery, Later));

        Assert.Equal("Cannot clear boss stage 5 before defeating its boss.", error.Message);
        Assert.Equal(4, progress.FurthestStageCleared);
        Assert.Equal(Created, progress.UpdatedAtUtc);
    }

    [Fact]
    public void Clearing_a_boss_stage_after_its_boss_is_accepted()
    {
        var progress = ClearedThrough(4);
        progress.ApplyBossDefeated(5, BossEvery, Later);

        progress.ApplyStageCleared(5, BossEvery, Later);

        Assert.Equal(5, progress.FurthestStageCleared);
    }

    [Fact]
    public void An_earlier_boss_does_not_unlock_a_later_boss_stage()
    {
        var progress = ClearedThrough(9);

        var error = Assert.Throws<EventValidationException>(() => progress.ApplyStageCleared(10, BossEvery, Later));

        Assert.Equal("Cannot clear boss stage 10 before defeating its boss.", error.Message);
        Assert.Equal(5, progress.HighestBossDefeated);
        Assert.Equal(9, progress.FurthestStageCleared);
    }
}
