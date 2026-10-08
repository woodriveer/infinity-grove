using InfinityGrove.Backend.Domain.Progress;

namespace InfinityGrove.Backend.Tests.Progress;

/// <summary>DROP-04 AC 2: token bucket of <see cref="PlayerProgress.TryConsumeKills"/>.</summary>
public class PlayerProgressKillAllowanceTests
{
    private const int Interval = 400;
    private const int Cap = 1000;
    private static readonly DateTimeOffset T0 = new(2026, 10, 8, 12, 0, 0, TimeSpan.Zero);

    private static PlayerProgress NewProgress() => PlayerProgress.CreateForAccount(Guid.NewGuid(), T0);

    [Fact]
    public void FirstCall_StartsWithAFullBucket()
    {
        var progress = NewProgress();

        Assert.True(progress.TryConsumeKills(Cap, T0, Interval, Cap));
        Assert.Equal(0, progress.KillAllowance);
        Assert.False(progress.TryConsumeKills(1, T0, Interval, Cap));
    }

    [Fact]
    public void FirstCall_AboveTheCap_IsRefusedAndLeavesNoState()
    {
        var progress = NewProgress();

        Assert.False(progress.TryConsumeKills(Cap + 1, T0, Interval, Cap));
        Assert.Null(progress.KillAllowance);
        Assert.Null(progress.KillAllowanceAtUtc);
    }

    [Fact]
    public void RefillsOneKillPerInterval()
    {
        var progress = NewProgress();
        progress.TryConsumeKills(Cap, T0, Interval, Cap);

        Assert.False(progress.TryConsumeKills(11, T0.AddMilliseconds(10 * Interval + 399), Interval, Cap));
        Assert.True(progress.TryConsumeKills(10, T0.AddMilliseconds(10 * Interval + 399), Interval, Cap));
        // 399 ms of the partial interval are kept: one more ms makes the 11th kill.
        Assert.True(progress.TryConsumeKills(1, T0.AddMilliseconds(11 * Interval), Interval, Cap));
    }

    [Fact]
    public void Refill_IsCappedAtTheBucketSize()
    {
        var progress = NewProgress();
        progress.TryConsumeKills(Cap, T0, Interval, Cap);

        var muchLater = T0.AddDays(30);
        Assert.False(progress.TryConsumeKills(Cap + 1, muchLater, Interval, Cap));
        Assert.True(progress.TryConsumeKills(Cap, muchLater, Interval, Cap));
    }

    [Fact]
    public void RefusedClaim_LeavesTheBucketUnchanged()
    {
        var progress = NewProgress();
        progress.TryConsumeKills(Cap - 5, T0, Interval, Cap);
        var allowance = progress.KillAllowance;
        var at = progress.KillAllowanceAtUtc;

        Assert.False(progress.TryConsumeKills(500, T0.AddMilliseconds(Interval), Interval, Cap));

        Assert.Equal(allowance, progress.KillAllowance);
        Assert.Equal(at, progress.KillAllowanceAtUtc);
    }

    [Fact]
    public void ClockGoingBackwards_GrantsNothing()
    {
        var progress = NewProgress();
        progress.TryConsumeKills(Cap, T0.AddHours(1), Interval, Cap);

        Assert.False(progress.TryConsumeKills(1, T0, Interval, Cap));
        Assert.Equal(0, progress.KillAllowance);
        Assert.Equal(T0.AddHours(1), progress.KillAllowanceAtUtc);
    }
}
