using InfinityGrove.Backend.Application.Accounts;
using InfinityGrove.Backend.Domain.Accounts;
using Microsoft.EntityFrameworkCore;

namespace InfinityGrove.Backend.Infrastructure.Persistence;

public class AccountRepository(InfinityGroveDbContext dbContext) : IAccountRepository
{
    public Task<Account?> GetBySteamIdAsync(string steamId64, CancellationToken cancellationToken) =>
        dbContext.Accounts.SingleOrDefaultAsync(a => a.SteamId64 == steamId64, cancellationToken);

    public Task<Account?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Accounts.SingleOrDefaultAsync(a => a.Id == id, cancellationToken);

    public async Task AddAsync(Account account, CancellationToken cancellationToken) =>
        await dbContext.Accounts.AddAsync(account, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
