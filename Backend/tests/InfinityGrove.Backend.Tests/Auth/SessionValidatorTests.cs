using InfinityGrove.Backend.Application.Accounts;
using InfinityGrove.Backend.Application.Auth;
using InfinityGrove.Backend.Domain.Accounts;

namespace InfinityGrove.Backend.Tests.Auth;

public class SessionValidatorTests
{
    [Fact]
    public async Task Accepts_the_current_session()
    {
        var (validator, account) = Build();

        Assert.True(await validator.IsCurrentAsync(account.Id, account.SessionId, CancellationToken.None));
    }

    [Fact]
    public async Task Rejects_a_replaced_session()
    {
        var (validator, account) = Build();
        var old = account.SessionId;
        account.StartSession(DateTimeOffset.UtcNow);

        Assert.False(await validator.IsCurrentAsync(account.Id, old, CancellationToken.None));
        Assert.True(await validator.IsCurrentAsync(account.Id, account.SessionId, CancellationToken.None));
    }

    [Fact]
    public async Task Rejects_an_unknown_account()
    {
        var (validator, account) = Build();

        Assert.False(await validator.IsCurrentAsync(Guid.NewGuid(), account.SessionId, CancellationToken.None));
    }

    private static (SessionValidator Validator, Account Account) Build()
    {
        var account = Account.CreateForSteamId("76561198000000001", DateTimeOffset.UtcNow);
        return (new SessionValidator(new Accounts(account)), account);
    }

    private sealed class Accounts(Account account) : IAccountRepository
    {
        public Task<Account?> GetBySteamIdAsync(string steamId64, CancellationToken cancellationToken) =>
            Task.FromResult<Account?>(account.SteamId64 == steamId64 ? account : null);

        public Task<Account?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult<Account?>(account.Id == id ? account : null);

        public Task AddAsync(Account a, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
