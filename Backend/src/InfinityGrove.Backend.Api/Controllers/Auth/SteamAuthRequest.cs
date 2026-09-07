namespace InfinityGrove.Backend.Api.Controllers.Auth;

/// <summary>
/// The Auth Session Ticket obtained client-side via Facepunch.Steamworks, hex-encoded.
/// </summary>
public record SteamAuthRequest(string Ticket);
