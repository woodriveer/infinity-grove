using InfinityGrove.Backend.Application.Accounts;

namespace InfinityGrove.Backend.Application.Auth;

public interface ISessionValidator
{
    /// <summary>True when <paramref name="sessionId"/> is the account's current session (AD-006).</summary>
    Task<bool> IsCurrentAsync(Guid accountId, Guid sessionId, CancellationToken cancellationToken);
}

public class SessionValidator(IAccountRepository accountRepository) : ISessionValidator
{
    public async Task<bool> IsCurrentAsync(Guid accountId, Guid sessionId, CancellationToken cancellationToken)
    {
        var account = await accountRepository.GetByIdAsync(accountId, cancellationToken);
        return account is not null && account.SessionId == sessionId;
    }
}
