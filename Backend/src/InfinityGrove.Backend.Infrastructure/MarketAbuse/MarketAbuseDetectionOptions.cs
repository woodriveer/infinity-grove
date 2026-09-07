namespace InfinityGrove.Backend.Infrastructure.MarketAbuse;

/// <summary>
/// AD-14/NFR-8's own tuning parameters — exact interval, signals, and
/// thresholds are explicitly named a tuning/ops deliverable, not fixed by any
/// AD. These defaults are placeholders for a live-ops pass to replace, not a
/// balancing decision made here.
/// </summary>
public class MarketAbuseDetectionOptions
{
    public const string SectionName = "MarketAbuseDetection";

    /// <summary>How often the event log is re-scanned for new anomalies.</summary>
    public int PollIntervalMinutes { get; set; } = 15;

    /// <summary>The rolling lookback window each scan evaluates, in minutes.</summary>
    public int WindowMinutes { get; set; } = 60;

    /// <summary>StageCleared events per account within the window before AnomalousStageClearRate is raised.</summary>
    public int MaxStageClearsPerWindow { get; set; } = 500;

    /// <summary>HeroAcquired events per account within the window before AnomalousHeroAcquisitionRate is raised.</summary>
    public int MaxHeroAcquisitionsPerWindow { get; set; } = 200;
}
