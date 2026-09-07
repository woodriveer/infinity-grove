namespace InfinityGrove.Backend.Domain.Accounts;

/// <summary>
/// A player account, keyed by SteamID64 per AD-5 (Steam is the sole identity provider).
/// </summary>
public class Account
{
    public Guid Id { get; private set; }
    public string SteamId64 { get; private set; } = null!;
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset LastLoginAtUtc { get; private set; }

    private Account()
    {
    }

    private Account(Guid id, string steamId64, DateTimeOffset nowUtc)
    {
        Id = id;
        SteamId64 = steamId64;
        CreatedAtUtc = nowUtc;
        LastLoginAtUtc = nowUtc;
    }

    public static Account CreateForSteamId(string steamId64, DateTimeOffset nowUtc)
    {
        if (string.IsNullOrWhiteSpace(steamId64))
        {
            throw new ArgumentException("SteamID64 must not be empty.", nameof(steamId64));
        }

        return new Account(Guid.NewGuid(), steamId64, nowUtc);
    }

    public void RecordLogin(DateTimeOffset nowUtc)
    {
        LastLoginAtUtc = nowUtc;
    }
}
