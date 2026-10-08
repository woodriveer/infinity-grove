using System.IdentityModel.Tokens.Jwt;
using InfinityGrove.Backend.Application.Accounts;
using InfinityGrove.Backend.Application.Auth;
using InfinityGrove.Backend.Domain.Accounts;
using InfinityGrove.Backend.Infrastructure.Auth;
using Microsoft.Extensions.Options;

namespace InfinityGrove.Backend.Tests.Auth;

public class SessionTokenTests
{
    private const string SteamId = "76561198000000001";

    [Fact]
    public async Task Login_returns_a_token_whose_sid_is_the_account_session()
    {
        var (service, accounts) = Build(SteamId);

        var result = await service.AuthenticateAsync("abcd", CancellationToken.None);

        Assert.True(result.Succeeded);
        var account = Assert.Single(accounts.Accounts);
        Assert.Equal(account.SessionId.ToString(), SidOf(result.SessionToken!));
    }

    [Fact]
    public async Task Second_login_gets_a_new_sid_and_the_first_token_no_longer_matches()
    {
        var (service, accounts) = Build(SteamId);

        var first = await service.AuthenticateAsync("abcd", CancellationToken.None);
        var second = await service.AuthenticateAsync("abcd", CancellationToken.None);

        var account = Assert.Single(accounts.Accounts);
        Assert.NotEqual(SidOf(first.SessionToken!), SidOf(second.SessionToken!));
        Assert.Equal(account.SessionId.ToString(), SidOf(second.SessionToken!));
        Assert.NotEqual(account.SessionId.ToString(), SidOf(first.SessionToken!));
    }

    [Fact]
    public async Task Failed_ticket_changes_no_session()
    {
        var (service, accounts) = Build(null);
        var existing = Account.CreateForSteamId(SteamId, DateTimeOffset.UtcNow.AddHours(-1));
        accounts.Accounts.Add(existing);
        var before = existing.SessionId;
        var loginBefore = existing.LastLoginAtUtc;

        var result = await service.AuthenticateAsync("abcd", CancellationToken.None);

        Assert.False(result.Succeeded);
        Assert.Equal(before, existing.SessionId);
        Assert.Equal(loginBefore, existing.LastLoginAtUtc);
    }

    [Fact]
    public async Task Empty_ticket_changes_no_session()
    {
        var (service, accounts) = Build(SteamId);
        var existing = Account.CreateForSteamId(SteamId, DateTimeOffset.UtcNow.AddHours(-1));
        accounts.Accounts.Add(existing);
        var before = existing.SessionId;

        var result = await service.AuthenticateAsync(" ", CancellationToken.None);

        Assert.False(result.Succeeded);
        Assert.Equal(before, existing.SessionId);
    }

    private static string SidOf(SessionToken token) =>
        new JwtSecurityTokenHandler().ReadJwtToken(token.Value).Claims
            .Single(c => c.Type == JwtSessionTokenService.SessionIdClaimType).Value;

    private static (SteamAuthenticationService Service, FakeAccounts Accounts) Build(string? verifiedSteamId)
    {
        var accounts = new FakeAccounts();
        var options = Options.Create(new JwtOptions { SigningKey = new string('k', 48) });
        var service = new SteamAuthenticationService(
            new FakeVerifier(verifiedSteamId),
            accounts,
            new JwtSessionTokenService(options, TimeProvider.System),
            TimeProvider.System);
        return (service, accounts);
    }

    private sealed class FakeVerifier(string? steamId) : ISteamAuthTicketVerifier
    {
        public Task<SteamTicketVerificationResult> VerifyAsync(string ticketHex, CancellationToken cancellationToken) =>
            Task.FromResult(steamId is null
                ? SteamTicketVerificationResult.Failure("invalid")
                : SteamTicketVerificationResult.Success(steamId));
    }

    private sealed class FakeAccounts : IAccountRepository
    {
        public List<Account> Accounts { get; } = new();

        public Task<Account?> GetBySteamIdAsync(string steamId64, CancellationToken cancellationToken) =>
            Task.FromResult(Accounts.FirstOrDefault(a => a.SteamId64 == steamId64));

        public Task<Account?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(Accounts.FirstOrDefault(a => a.Id == id));

        public Task AddAsync(Account account, CancellationToken cancellationToken)
        {
            Accounts.Add(account);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
