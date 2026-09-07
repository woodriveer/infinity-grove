namespace InfinityGrove.Backend.Infrastructure.Market;

/// <summary>
/// AD-13's own poll-interval/request-pacing parameters — Architecture.md's Open
/// Questions defers the exact interval to implementation, not a fixed AD value.
/// </summary>
public class MarketPriceCacheOptions
{
    public const string SectionName = "MarketPriceCache";

    public string BaseUrl { get; set; } = "https://steamcommunity.com";

    /// <summary>Steam's numeric currency code for the `priceoverview` query (1 = USD).</summary>
    public int CurrencyId { get; set; } = 1;

    /// <summary>How often the whole tradeable-card catalog is re-polled.</summary>
    public int PollIntervalMinutes { get; set; } = 30;

    /// <summary>Delay between individual per-card requests within one poll pass, to keep call volume bounded and predictable regardless of catalog size (AD-13's reasoning).</summary>
    public int RequestDelayMilliseconds { get; set; } = 1500;
}
