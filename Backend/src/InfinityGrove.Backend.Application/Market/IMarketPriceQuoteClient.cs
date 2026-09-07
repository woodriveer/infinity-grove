namespace InfinityGrove.Backend.Application.Market;

/// <summary>
/// AD-13: a single call against Valve's unofficial, unsupported
/// `steamcommunity.com/market/priceoverview` endpoint. Not covered by any SLA —
/// callers must treat a failure as "unavailable this poll", never as a reason
/// to block anything else (see MarketPriceSnapshot's own "never overwrite a
/// good snapshot with a failure" rule).
/// </summary>
public interface IMarketPriceQuoteClient
{
    Task<MarketPriceQuoteResult> GetPriceOverviewAsync(
        uint appId, string marketHashName, int currencyId, CancellationToken cancellationToken);
}

public record MarketPriceQuoteResult(bool Success, string? LowestPrice, string? MedianPrice, string? Volume, string? ErrorMessage)
{
    public static MarketPriceQuoteResult Ok(string? lowestPrice, string? medianPrice, string? volume) =>
        new(true, lowestPrice, medianPrice, volume, null);

    public static MarketPriceQuoteResult Failure(string errorMessage) =>
        new(false, null, null, null, errorMessage);
}
