using InfinityGrove.Backend.Domain.Progress;

namespace InfinityGrove.Backend.Application.Progress;

/// <summary>
/// Stage progression rules the backend cannot read from client content (stage-combat
/// design): AD-002's boss cadence, kept equal to content by the `stage-rules` vector family.
/// </summary>
public class ProgressOptions
{
    public const string SectionName = "Progress";

    /// <summary>A stage is a boss stage when <c>stageNumber % BossEvery == 0</c>.</summary>
    public int BossEvery { get; set; } = PlayerProgress.DefaultBossEvery;

    /// <summary>DROP-04: one kill is allowed per this many milliseconds of server time.</summary>
    public int MinKillIntervalMs { get; set; } = 400;

    /// <summary>DROP-04: the most kills that can bank while offline (108000 x 400 ms = 12 h).</summary>
    public int KillBucketCap { get; set; } = 108000;

    /// <summary>DROP-04: the most kills one MonsterKillsBatch event may claim.</summary>
    public int MaxKillsPerEvent { get; set; } = 1000;
}
