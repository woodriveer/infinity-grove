using System.Globalization;
using System.Text.Json;
using InfinityGrove.Backend.Application.Cards;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace InfinityGrove.Backend.Infrastructure.Steam;

/// <summary>
/// Backend-only Steamworks Web API calls that mutate a player's Steam Inventory
/// (AD-4, AD-8, AD-8b). Modeled on the Steam Inventory Service's
/// (IInventoryService) publisher-key POST methods, following the same
/// key/appid/input_json request shape those endpoints use. The exact
/// request/response contract should be re-verified against current Steamworks
/// documentation before this runs against a real Steam App ID — this task's
/// job is the outbox saga and card-instance state machine around this call
/// (AD-8/AD-8b), not a certified Steamworks integration, and this client is the
/// single seam a future correction would land in.
/// </summary>
public class SteamworksInventoryPublisherClient(
    HttpClient httpClient,
    IOptions<SteamworksOptions> options,
    ILogger<SteamworksInventoryPublisherClient> logger) : ISteamInventoryPublisherClient
{
    public Task<SteamInventoryOperationResult> ConsumeItemInstancesAsync(
        string steamId64, IReadOnlyList<string> steamItemInstanceIds, CancellationToken cancellationToken) =>
        CallAsync(
            "IInventoryService/ConsumeItem/v1/",
            new { steamid = steamId64, itemids = steamItemInstanceIds },
            cancellationToken);

    public Task<SteamInventoryOperationResult> SetItemMarketableAsync(
        string steamId64, string steamItemInstanceId, CancellationToken cancellationToken) =>
        CallAsync(
            "IInventoryService/ModifyItems/v1/",
            new { steamid = steamId64, itemid = steamItemInstanceId, marketable = true },
            cancellationToken);

    public Task<SteamInventoryOperationResult> GrantItemInstanceAsync(
        string steamId64, uint steamItemDefId, CancellationToken cancellationToken) =>
        CallAsync(
            "IInventoryService/AddPromoItem/v1/",
            new { steamid = steamId64, itemdefid = new[] { steamItemDefId } },
            cancellationToken);

    private async Task<SteamInventoryOperationResult> CallAsync(string relativeUri, object inputPayload, CancellationToken cancellationToken)
    {
        var steamOptions = options.Value;
        if (string.IsNullOrWhiteSpace(steamOptions.PublisherKey))
        {
            logger.LogError("Steamworks publisher key is not configured.");
            return SteamInventoryOperationResult.Failure("Steam Inventory integration is not configured.");
        }

        var form = new Dictionary<string, string>
        {
            ["key"] = steamOptions.PublisherKey,
            ["appid"] = steamOptions.AppId.ToString(CultureInfo.InvariantCulture),
            ["input_json"] = JsonSerializer.Serialize(inputPayload),
        };

        try
        {
            using var response = await httpClient.PostAsync(relativeUri, new FormUrlEncodedContent(form), cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogError(
                    "Steamworks Web API {RelativeUri} returned {StatusCode}: {Body}",
                    relativeUri, response.StatusCode, body);
                return SteamInventoryOperationResult.Failure($"Steam returned {(int)response.StatusCode}.");
            }

            return SteamInventoryOperationResult.Ok();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogError(ex, "Steamworks Web API call to {RelativeUri} failed.", relativeUri);
            return SteamInventoryOperationResult.Failure("Could not reach Steam.");
        }
    }
}
