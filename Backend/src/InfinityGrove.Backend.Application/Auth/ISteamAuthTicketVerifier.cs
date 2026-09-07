namespace InfinityGrove.Backend.Application.Auth;

/// <summary>
/// Verifies a Steam Auth Session Ticket against the Steamworks Web API (AD-5).
/// Implemented in Infrastructure; Application only depends on this port.
/// </summary>
public interface ISteamAuthTicketVerifier
{
    Task<SteamTicketVerificationResult> VerifyAsync(string ticketHex, CancellationToken cancellationToken);
}

public record SteamTicketVerificationResult(bool IsValid, string? SteamId64, string? FailureReason)
{
    public static SteamTicketVerificationResult Success(string steamId64) => new(true, steamId64, null);

    public static SteamTicketVerificationResult Failure(string reason) => new(false, null, reason);
}
