using InfinityGrove.Backend.Domain.Accounts;

namespace InfinityGrove.Backend.Tests.Accounts;

/// <summary>SESSION-01: each login starts a new session id (AD-006).</summary>
public class AccountSessionTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 8, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void NewAccountHasNonEmptySessionId()
    {
        var account = Account.CreateForSteamId("76561198000000001", Created);

        Assert.NotEqual(Guid.Empty, account.SessionId);
    }

    [Fact]
    public void StartSessionChangesSessionIdAndLoginTime()
    {
        var account = Account.CreateForSteamId("76561198000000001", Created);
        var first = account.SessionId;
        var later = Created.AddHours(1);

        account.StartSession(later);

        Assert.NotEqual(first, account.SessionId);
        Assert.NotEqual(Guid.Empty, account.SessionId);
        Assert.Equal(later, account.LastLoginAtUtc);
    }

    [Fact]
    public void TwoStartSessionCallsGiveTwoIds()
    {
        var account = Account.CreateForSteamId("76561198000000001", Created);

        account.StartSession(Created.AddMinutes(1));
        var second = account.SessionId;
        account.StartSession(Created.AddMinutes(2));

        Assert.NotEqual(second, account.SessionId);
    }
}
