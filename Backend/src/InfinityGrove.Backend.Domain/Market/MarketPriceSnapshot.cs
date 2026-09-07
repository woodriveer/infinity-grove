namespace InfinityGrove.Backend.Domain.Market;

/// <summary>
/// AD-13: the last-known Steam Community Market reference price for one hero's
/// card, as returned by the unofficial `priceoverview` endpoint, plus the
/// timestamp it was fetched. One row per hero — a cache of the latest
/// successful poll, not a price-history table — so FR-29's card detail view
/// can show "updated Xh ago" against <see cref="FetchedAtUtc"/>. A failed poll
/// (Valve blocks/changes the endpoint, per this AD's own risk note) never
/// overwrites the last good snapshot; it is simply not upserted, so the
/// displayed price ages rather than disappearing.
/// </summary>
public class MarketPriceSnapshot
{
    public Guid HeroDefinitionId { get; private set; }
    public string Currency { get; private set; } = null!;

    /// <summary>Valve's own display-formatted string (e.g. "$0.10") — never parsed into a numeric type here; FR-29 only needs a soft reference, not a computable value.</summary>
    public string? LowestPriceDisplay { get; private set; }

    public string? MedianPriceDisplay { get; private set; }
    public string? Volume { get; private set; }
    public DateTimeOffset FetchedAtUtc { get; private set; }

    private MarketPriceSnapshot()
    {
    }

    public static MarketPriceSnapshot Create(
        Guid heroDefinitionId,
        string currency,
        string? lowestPriceDisplay,
        string? medianPriceDisplay,
        string? volume,
        DateTimeOffset fetchedAtUtc) => new()
        {
            HeroDefinitionId = heroDefinitionId,
            Currency = currency,
            LowestPriceDisplay = lowestPriceDisplay,
            MedianPriceDisplay = medianPriceDisplay,
            Volume = volume,
            FetchedAtUtc = fetchedAtUtc,
        };

    /// <summary>A later successful poll replaces this snapshot's values in place.</summary>
    public void Refresh(string currency, string? lowestPriceDisplay, string? medianPriceDisplay, string? volume, DateTimeOffset fetchedAtUtc)
    {
        Currency = currency;
        LowestPriceDisplay = lowestPriceDisplay;
        MedianPriceDisplay = medianPriceDisplay;
        Volume = volume;
        FetchedAtUtc = fetchedAtUtc;
    }
}
