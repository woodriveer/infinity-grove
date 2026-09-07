using System.Net.Http.Json;
using InfinityGrove.Backend.Application.Auth;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace InfinityGrove.Backend.Infrastructure.Steam;

/// <summary>
/// Verifies a client-supplied Auth Session Ticket against the Steamworks Web API
/// (AD-5): ISteamUserAuth/AuthenticateUserTicket. The publisher key never leaves
/// the backend (AD-4).
/// </summary>
public class SteamAuthTicketVerifier(
    HttpClient httpClient,
    IOptions<SteamworksOptions> options,
    ILogger<SteamAuthTicketVerifier> logger) : ISteamAuthTicketVerifier
{
    public async Task<SteamTicketVerificationResult> VerifyAsync(string ticketHex, CancellationToken cancellationToken)
    {
        var steamOptions = options.Value;
        if (string.IsNullOrWhiteSpace(steamOptions.PublisherKey))
        {
            logger.LogError("Steamworks publisher key is not configured.");
            return SteamTicketVerificationResult.Failure("Steam authentication is not configured.");
        }

        var requestUri =
            $"/ISteamUserAuth/AuthenticateUserTicket/v1/" +
            $"?key={Uri.EscapeDataString(steamOptions.PublisherKey)}" +
            $"&appid={steamOptions.AppId}" +
            $"&ticket={Uri.EscapeDataString(ticketHex)}";

        SteamAuthenticateUserTicketResponse? body;
        try
        {
            using var response = await httpClient.GetAsync(requestUri, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Steamworks Web API returned {StatusCode} while verifying an auth ticket.",
                    response.StatusCode);
                return SteamTicketVerificationResult.Failure("Steam rejected the ticket verification request.");
            }

            body = await response.Content.ReadFromJsonAsync<SteamAuthenticateUserTicketResponse>(cancellationToken: cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.LogError(ex, "Steamworks Web API call failed while verifying an auth ticket.");
            return SteamTicketVerificationResult.Failure("Could not reach Steam to verify the ticket.");
        }

        var responseParams = body?.Response?.Params;
        if (responseParams is null || !string.Equals(responseParams.Result, "OK", StringComparison.OrdinalIgnoreCase))
        {
            var reason = body?.Response?.Error?.ErrorDesc ?? responseParams?.Result ?? "Invalid Steam auth ticket.";
            return SteamTicketVerificationResult.Failure(reason);
        }

        if (string.IsNullOrWhiteSpace(responseParams.SteamId))
        {
            return SteamTicketVerificationResult.Failure("Steam did not return a SteamID64 for this ticket.");
        }

        if (responseParams.VacBanned || responseParams.PublisherBanned)
        {
            return SteamTicketVerificationResult.Failure("This Steam account is banned.");
        }

        return SteamTicketVerificationResult.Success(responseParams.SteamId);
    }
}
