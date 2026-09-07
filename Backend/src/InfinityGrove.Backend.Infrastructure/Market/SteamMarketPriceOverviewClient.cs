using System.Net.Http.Json;
using System.Text.Json.Serialization;
using InfinityGrove.Backend.Application.Market;
using Microsoft.Extensions.Logging;

namespace InfinityGrove.Backend.Infrastructure.Market;

/// <summary>
/// AD-13: calls Valve's unofficial, unsupported
/// `steamcommunity.com/market/priceoverview` endpoint for a single card's
/// reference price. There is no officially supported Market pricing API — this
/// is the only viable source, carries no SLA, and can be rate-limited or
/// blocked without notice; every failure mode here is surfaced as a plain
/// <see cref="MarketPriceQuoteResult.Failure"/> for the caller to log and skip,
/// never thrown, so one bad response never aborts the rest of a poll pass.
/// </summary>
public class SteamMarketPriceOverviewClient(HttpClient httpClient, ILogger<SteamMarketPriceOverviewClient> logger)
    : IMarketPriceQuoteClient
{
    public async Task<MarketPriceQuoteResult> GetPriceOverviewAsync(
        uint appId, string marketHashName, int currencyId, CancellationToken cancellationToken)
    {
        var requestUri = $"/market/priceoverview/?appid={appId}&currency={currencyId}&market_hash_name={Uri.EscapeDataString(marketHashName)}";

        try
        {
            using var response = await httpClient.GetAsync(requestUri, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return MarketPriceQuoteResult.Failure(
                    $"priceoverview returned HTTP {(int)response.StatusCode} for '{marketHashName}'.");
            }

            var payload = await response.Content.ReadFromJsonAsync<PriceOverviewResponse>(cancellationToken: cancellationToken);
            if (payload is null || !payload.Success)
            {
                return MarketPriceQuoteResult.Failure(
                    $"priceoverview reported no price for '{marketHashName}' (success=false or empty body).");
            }

            return MarketPriceQuoteResult.Ok(payload.LowestPrice, payload.MedianPrice, payload.Volume);
        }
        catch (Exception ex) when (ex is HttpRequestException or System.Text.Json.JsonException or TaskCanceledException)
        {
            logger.LogWarning(ex, "priceoverview request failed for '{MarketHashName}'.", marketHashName);
            return MarketPriceQuoteResult.Failure(ex.Message);
        }
    }

    private class PriceOverviewResponse
    {
        public bool Success { get; set; }

        [JsonPropertyName("lowest_price")]
        public string? LowestPrice { get; set; }

        [JsonPropertyName("median_price")]
        public string? MedianPrice { get; set; }

        public string? Volume { get; set; }
    }
}
