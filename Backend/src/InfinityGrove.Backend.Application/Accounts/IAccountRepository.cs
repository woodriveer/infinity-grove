using InfinityGrove.Backend.Domain.Accounts;

namespace InfinityGrove.Backend.Application.Accounts;

public interface IAccountRepository
{
    Task<Account?> GetBySteamIdAsync(string steamId64, CancellationToken cancellationToken);

    Task<Account?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task AddAsync(Account account, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
