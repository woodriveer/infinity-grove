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
}
