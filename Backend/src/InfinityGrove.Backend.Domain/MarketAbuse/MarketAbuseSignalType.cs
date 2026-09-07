namespace InfinityGrove.Backend.Domain.MarketAbuse;

/// <summary>
/// The Market-scoped cadence anomalies AD-14/NFR-8's scheduled job detects over
/// the AD-6 event log. Narrower by design than a general anti-cheat taxonomy —
/// NFR-8 names exactly "anomalous per-account drop/farming rate detection", not
/// an open-ended signal set.
/// </summary>
public enum MarketAbuseSignalType
{
    /// <summary>Stage-clear cadence inconsistent with human play (NFR-8's own example).</summary>
    AnomalousStageClearRate = 0,

    /// <summary>Hero-card acquisition cadence inconsistent with human play — the drop-farming case NFR-8 exists to catch, since acquired cards are the Market-tradeable asset.</summary>
    AnomalousHeroAcquisitionRate = 1,
}
