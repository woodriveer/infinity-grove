namespace InfinityGrove.Backend.Domain.MarketAbuse;

/// <summary>
/// One detection hit from AD-14's scheduled Market-scoped abuse-detection job:
/// an account whose event-log cadence for <see cref="SignalType"/> exceeded its
/// configured threshold within a lookback window. This is the audit trail an
/// ops pass reviews and acts on (no admin UI is scoped for v1, per
/// Architecture.md's Open Questions) — raising a flag never itself suspends,
/// bans, or rate-limits the account. The listing-rate-limit half of NFR-8 is a
/// separate, inline precondition enforced by AD-8b's "prepare to list"
/// endpoint, not this job.
/// </summary>
public class MarketAbuseFlag
{
    public Guid Id { get; private set; }
    public Guid AccountId { get; private set; }
    public MarketAbuseSignalType SignalType { get; private set; }
    public int ObservedEventCount { get; private set; }
    public int ThresholdEventCount { get; private set; }
    public DateTimeOffset WindowStartUtc { get; private set; }
    public DateTimeOffset WindowEndUtc { get; private set; }
    public DateTimeOffset DetectedAtUtc { get; private set; }

    private MarketAbuseFlag()
    {
    }

    public static MarketAbuseFlag Raise(
        Guid accountId,
        MarketAbuseSignalType signalType,
        int observedEventCount,
        int thresholdEventCount,
        DateTimeOffset windowStartUtc,
        DateTimeOffset windowEndUtc,
        DateTimeOffset detectedAtUtc) => new()
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            SignalType = signalType,
            ObservedEventCount = observedEventCount,
            ThresholdEventCount = thresholdEventCount,
            WindowStartUtc = windowStartUtc,
            WindowEndUtc = windowEndUtc,
            DetectedAtUtc = detectedAtUtc,
        };
}
