using System.Text.Json.Serialization;

namespace InfinityGrove.Backend.Infrastructure.Steam;

// Shape of https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/
internal class SteamAuthenticateUserTicketResponse
{
    [JsonPropertyName("response")]
    public SteamAuthenticateUserTicketResponseBody? Response { get; set; }
}

internal class SteamAuthenticateUserTicketResponseBody
{
    [JsonPropertyName("params")]
    public SteamAuthenticateUserTicketParams? Params { get; set; }

    [JsonPropertyName("error")]
    public SteamAuthenticateUserTicketError? Error { get; set; }
}

internal class SteamAuthenticateUserTicketParams
{
    [JsonPropertyName("result")]
    public string? Result { get; set; }

    [JsonPropertyName("steamid")]
    public string? SteamId { get; set; }

    [JsonPropertyName("ownersteamid")]
    public string? OwnerSteamId { get; set; }

    [JsonPropertyName("vacbanned")]
    public bool VacBanned { get; set; }

    [JsonPropertyName("publisherbanned")]
    public bool PublisherBanned { get; set; }
}

internal class SteamAuthenticateUserTicketError
{
    [JsonPropertyName("errorcode")]
    public int ErrorCode { get; set; }

    [JsonPropertyName("errordesc")]
    public string? ErrorDesc { get; set; }
}
