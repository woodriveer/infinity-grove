using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using InfinityGrove.Backend.Application.Purchases;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace InfinityGrove.Backend.Infrastructure.Steam;

/// <summary>
/// Backend-only Steamworks Microtransaction Web API calls (AD-12), modeled on
/// ISteamMicroTxn's InitTxn/FinalizeTxn form-encoded, publisher-key-authenticated
/// endpoints. As with <see cref="SteamworksInventoryPublisherClient"/>, the exact
/// request/response contract should be re-verified against current Steamworks
/// documentation before this runs against a real Steam App ID — this task's job
/// is the purchase saga and Hero Block validation around this call, not a
/// certified Steamworks integration, and this client is the single seam a
/// future correction would land in.
/// </summary>
public class SteamworksMicrotransactionClient(
    HttpClient httpClient,
    IOptions<SteamworksOptions> options,
    ILogger<SteamworksMicrotransactionClient> logger) : ISteamMicrotransactionClient
{
    public async Task<SteamInitTxnResult> InitTxnAsync(SteamInitTxnRequest request, CancellationToken cancellationToken)
    {
        var steamOptions = options.Value;
        if (string.IsNullOrWhiteSpace(steamOptions.PublisherKey))
        {
            logger.LogError("Steamworks publisher key is not configured.");
            return SteamInitTxnResult.Failure("Steam Microtransactions integration is not configured.");
        }

        var form = new Dictionary<string, string>
        {
            ["key"] = steamOptions.PublisherKey,
            ["appid"] = steamOptions.AppId.ToString(CultureInfo.InvariantCulture),
            ["orderid"] = request.OrderId.ToString(CultureInfo.InvariantCulture),
            ["steamid"] = request.SteamId64,
            ["itemcount"] = "1",
            ["language"] = "en",
            ["currency"] = request.Currency,
            ["itemid[0]"] = request.SteamItemDefId.ToString(CultureInfo.InvariantCulture),
            ["qty[0]"] = "1",
            ["amount[0]"] = request.PriceAmountMinorUnits.ToString(CultureInfo.InvariantCulture),
            ["description[0]"] = request.Description,
            ["category[0]"] = "SummoningStone",
        };

        try
        {
            using var response = await httpClient.PostAsync(
                "ISteamMicroTxn/InitTxn/v3/", new FormUrlEncodedContent(form), cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("Steamworks InitTxn returned {StatusCode}: {Body}", response.StatusCode, body);
                return SteamInitTxnResult.Failure($"Steam returned {(int)response.StatusCode}.");
            }

            var envelope = JsonSerializer.Deserialize<SteamMicroTxnEnvelope>(body);
            var transId = envelope?.Response?.Params?.TransId;
            if (envelope?.Response?.Result != "OK" || string.IsNullOrEmpty(transId))
            {
                logger.LogError("Steamworks InitTxn rejected the order: {Body}", body);
                return SteamInitTxnResult.Failure(envelope?.Response?.Error?.ErrorDesc ?? "Steam rejected the order.");
            }

            return SteamInitTxnResult.Ok(transId);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogError(ex, "Steamworks InitTxn call failed.");
            return SteamInitTxnResult.Failure("Could not reach Steam.");
        }
    }

    public async Task<SteamFinalizeTxnResult> FinalizeTxnAsync(long steamOrderId, CancellationToken cancellationToken)
    {
        var steamOptions = options.Value;
        if (string.IsNullOrWhiteSpace(steamOptions.PublisherKey))
        {
            logger.LogError("Steamworks publisher key is not configured.");
            return SteamFinalizeTxnResult.Failure("Steam Microtransactions integration is not configured.");
        }

        var form = new Dictionary<string, string>
        {
            ["key"] = steamOptions.PublisherKey,
            ["appid"] = steamOptions.AppId.ToString(CultureInfo.InvariantCulture),
            ["orderid"] = steamOrderId.ToString(CultureInfo.InvariantCulture),
        };

        try
        {
            using var response = await httpClient.PostAsync(
                "ISteamMicroTxn/FinalizeTxn/v2/", new FormUrlEncodedContent(form), cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("Steamworks FinalizeTxn returned {StatusCode}: {Body}", response.StatusCode, body);
                return SteamFinalizeTxnResult.Failure($"Steam returned {(int)response.StatusCode}.");
            }

            var envelope = JsonSerializer.Deserialize<SteamMicroTxnEnvelope>(body);
            if (envelope?.Response?.Result != "OK")
            {
                logger.LogError("Steamworks FinalizeTxn rejected order {OrderId}: {Body}", steamOrderId, body);
                return SteamFinalizeTxnResult.Failure(envelope?.Response?.Error?.ErrorDesc ?? "Steam rejected the finalize request.");
            }

            return SteamFinalizeTxnResult.Ok();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogError(ex, "Steamworks FinalizeTxn call failed for order {OrderId}.", steamOrderId);
            return SteamFinalizeTxnResult.Failure("Could not reach Steam.");
        }
    }

    private record SteamMicroTxnEnvelope([property: JsonPropertyName("response")] SteamMicroTxnResponseBody? Response);

    private record SteamMicroTxnResponseBody(
        [property: JsonPropertyName("result")] string? Result,
        [property: JsonPropertyName("params")] SteamMicroTxnResponseParams? Params,
        [property: JsonPropertyName("error")] SteamMicroTxnResponseError? Error);

    private record SteamMicroTxnResponseParams(
        [property: JsonPropertyName("orderid")] string? OrderId,
        [property: JsonPropertyName("transid")] string? TransId);

    private record SteamMicroTxnResponseError(
        [property: JsonPropertyName("errorcode")] int? ErrorCode,
        [property: JsonPropertyName("errordesc")] string? ErrorDesc);
}
