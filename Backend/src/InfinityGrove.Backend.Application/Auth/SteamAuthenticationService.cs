using InfinityGrove.Backend.Application.Accounts;
using InfinityGrove.Backend.Domain.Accounts;

namespace InfinityGrove.Backend.Application.Auth;

public interface ISteamAuthenticationService
{
    Task<SteamAuthenticationResult> AuthenticateAsync(string ticketHex, CancellationToken cancellationToken);
}

public record SteamAuthenticationResult(bool Succeeded, string? FailureReason, Guid AccountId, string? SteamId64, SessionToken? SessionToken)
{
    public static SteamAuthenticationResult Failure(string reason) => new(false, reason, Guid.Empty, null, null);

    public static SteamAuthenticationResult Success(Account account, SessionToken sessionToken) =>
        new(true, null, account.Id, account.SteamId64, sessionToken);
}

/// <summary>
/// Orchestrates AD-5's login flow: verify the Steam Auth Session Ticket, create-or-map
/// the Account by SteamID64, and issue the AD-10 backend session token.
/// </summary>
public class SteamAuthenticationService(
    ISteamAuthTicketVerifier ticketVerifier,
    IAccountRepository accountRepository,
    ISessionTokenService sessionTokenService,
    TimeProvider timeProvider) : ISteamAuthenticationService
{
    public async Task<SteamAuthenticationResult> AuthenticateAsync(string ticketHex, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(ticketHex))
        {
            return SteamAuthenticationResult.Failure("Ticket must not be empty.");
        }

        var verification = await ticketVerifier.VerifyAsync(ticketHex, cancellationToken);
        if (!verification.IsValid || verification.SteamId64 is null)
        {
            return SteamAuthenticationResult.Failure(verification.FailureReason ?? "Steam ticket verification failed.");
        }

        var nowUtc = timeProvider.GetUtcNow();
        var account = await accountRepository.GetBySteamIdAsync(verification.SteamId64, cancellationToken);
        if (account is null)
        {
            account = Account.CreateForSteamId(verification.SteamId64, nowUtc);
            await accountRepository.AddAsync(account, cancellationToken);
        }
        else
        {
            account.RecordLogin(nowUtc);
        }

        await accountRepository.SaveChangesAsync(cancellationToken);

        var sessionToken = sessionTokenService.CreateToken(account);
        return SteamAuthenticationResult.Success(account, sessionToken);
    }
}
