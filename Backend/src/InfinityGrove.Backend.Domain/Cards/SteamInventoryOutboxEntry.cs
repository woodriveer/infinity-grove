namespace InfinityGrove.Backend.Domain.Cards;

/// <summary>
/// AD-8's outbox: one row per Steam Inventory mutation that must eventually be
/// applied after the owning Postgres transaction (fusion today) has already
/// committed its side of the change. Written in the same transaction as the
/// CardInstance state transitions it corresponds to, so the two can never drift
/// apart at the moment of commit; a background worker (SteamInventoryOutboxWorker)
/// then drains Pending rows and calls the Steamworks Web API, retrying with
/// backoff on failure rather than blocking or dropping the mutation.
/// </summary>
public class SteamInventoryOutboxEntry
{
    public Guid Id { get; private set; }
    public Guid AccountId { get; private set; }
    public SteamInventoryOutboxOperation Operation { get; private set; }

    private readonly List<Guid> _cardInstanceIds = [];

    /// <summary>The CardInstance ids this entry's Steam Inventory mutation applies to.</summary>
    public IReadOnlyList<Guid> CardInstanceIds => _cardInstanceIds;

    /// <summary>Only set for <see cref="SteamInventoryOutboxOperation.GrantCardInstance"/> — the Steam item definition id the grant call mints from.</summary>
    public uint? SteamItemDefId { get; private set; }

    public SteamInventoryOutboxStatus Status { get; private set; }
    public int Attempts { get; private set; }
    public DateTimeOffset NextAttemptAtUtc { get; private set; }
    public string? LastError { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private SteamInventoryOutboxEntry()
    {
    }

    public static SteamInventoryOutboxEntry CreateForConsume(
        Guid accountId, IReadOnlyList<Guid> cardInstanceIds, DateTimeOffset nowUtc)
    {
        var entry = new SteamInventoryOutboxEntry
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Operation = SteamInventoryOutboxOperation.ConsumeCardInstances,
            Status = SteamInventoryOutboxStatus.Pending,
            Attempts = 0,
            NextAttemptAtUtc = nowUtc,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc,
        };
        entry._cardInstanceIds.AddRange(cardInstanceIds);
        return entry;
    }

    /// <summary>AD-12: written in the same transaction that finalizes a Summoning Stone purchase and mints the CardInstance it grants.</summary>
    public static SteamInventoryOutboxEntry CreateForGrant(
        Guid accountId, Guid cardInstanceId, uint steamItemDefId, DateTimeOffset nowUtc)
    {
        var entry = new SteamInventoryOutboxEntry
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Operation = SteamInventoryOutboxOperation.GrantCardInstance,
            SteamItemDefId = steamItemDefId,
            Status = SteamInventoryOutboxStatus.Pending,
            Attempts = 0,
            NextAttemptAtUtc = nowUtc,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc,
        };
        entry._cardInstanceIds.Add(cardInstanceId);
        return entry;
    }

    public void MarkApplied(DateTimeOffset nowUtc)
    {
        Status = SteamInventoryOutboxStatus.Applied;
        UpdatedAtUtc = nowUtc;
    }

    public void RecordFailedAttempt(string error, TimeSpan nextDelay, DateTimeOffset nowUtc)
    {
        Attempts++;
        LastError = error;
        NextAttemptAtUtc = nowUtc + nextDelay;
        UpdatedAtUtc = nowUtc;
    }
}
