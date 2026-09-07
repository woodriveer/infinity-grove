using InfinityGrove.Backend.Domain.Accounts;

namespace InfinityGrove.Backend.Application.Auth;

/// <summary>
/// Issues the short-lived backend session token (AD-10) that the client uses as a
/// bearer credential after the one-time Steam ticket exchange.
/// </summary>
public interface ISessionTokenService
{
    SessionToken CreateToken(Account account);
}

public record SessionToken(string Value, DateTimeOffset ExpiresAtUtc);
