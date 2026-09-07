using BreakInfinity;
using InfinityGrove.Backend.Domain.Events;

namespace InfinityGrove.Backend.Domain.Progress;

/// <summary>
/// The server-authoritative aggregate for gold, stage progress, and roster state
/// (AD-6's scope for this task — star tiers, gear, and crafted affixes belong to
/// the fusion/itemization tasks). One row per account. Every mutation here is the
/// replay target for a validated <see cref="PlayerEvent"/>; nothing outside this
/// class may change these fields, so the rules enforced here are exactly the rules
/// the event log's replay/reconciliation apply.
/// </summary>
public class PlayerProgress
{
    public const int ActiveSquadCapacity = 5;

    public Guid AccountId { get; private set; }

    /// <summary>AD-7: canonical gold is stored as this (mantissa, exponent) pair, not a native numeric column.</summary>
    public double GoldMantissa { get; private set; }
    public int GoldExponent { get; private set; }

    public int FurthestStageCleared { get; private set; }

    /// <summary>The highest client SequenceNumber processed so far, accepted or rejected — see AdvanceSequence.</summary>
    public long LastAppliedSequence { get; private set; }

    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private readonly List<RosterEntry> _roster = [];
    public IReadOnlyCollection<RosterEntry> Roster => _roster;

    private readonly List<Guid> _activeSquadHeroIds = [];
    public IReadOnlyList<Guid> ActiveSquadHeroIds => _activeSquadHeroIds;

    private PlayerProgress()
    {
    }

    public static PlayerProgress CreateForAccount(Guid accountId, DateTimeOffset nowUtc) =>
        new()
        {
            AccountId = accountId,
            GoldMantissa = 0,
            GoldExponent = 0,
            FurthestStageCleared = 0,
            LastAppliedSequence = 0,
            UpdatedAtUtc = nowUtc,
        };

    public BigDouble Gold => new(GoldMantissa, GoldExponent);

    private void SetGold(BigDouble value)
    {
        GoldMantissa = value.Mantissa;
        GoldExponent = value.Exponent;
    }

    public void ApplyGoldEarned(BigDouble amount, DateTimeOffset nowUtc)
    {
        if (amount.Sign() < 0)
        {
            throw new EventValidationException("Gold earned amount must not be negative.");
        }

        SetGold(Gold + amount);
        UpdatedAtUtc = nowUtc;
    }

    public void ApplyGoldSpent(BigDouble amount, DateTimeOffset nowUtc)
    {
        if (amount.Sign() < 0)
        {
            throw new EventValidationException("Gold spent amount must not be negative.");
        }

        if (Gold < amount)
        {
            throw new EventValidationException($"Insufficient gold: have {Gold}, need {amount}.");
        }

        SetGold(Gold - amount);
        UpdatedAtUtc = nowUtc;
    }

    /// <summary>
    /// FR-11/FR-13: stages must be cleared in order (no skipping ahead of the
    /// account's own furthest progress), but replaying an already-cleared stage is
    /// a valid no-op, not a rejection.
    /// </summary>
    public void ApplyStageCleared(int stageNumber, DateTimeOffset nowUtc)
    {
        if (stageNumber < 1)
        {
            throw new EventValidationException("Stage number must be positive.");
        }

        if (stageNumber > FurthestStageCleared + 1)
        {
            throw new EventValidationException(
                $"Cannot clear stage {stageNumber} before stage {FurthestStageCleared + 1}.");
        }

        if (stageNumber > FurthestStageCleared)
        {
            FurthestStageCleared = stageNumber;
        }

        UpdatedAtUtc = nowUtc;
    }

    /// <summary>FR-2/FR-17: a drop/purchase either adds a new roster hero or increments its duplicate count.</summary>
    public void ApplyHeroAcquired(Guid heroDefinitionId, DateTimeOffset nowUtc)
    {
        var entry = _roster.Find(r => r.HeroDefinitionId == heroDefinitionId);
        if (entry is null)
        {
            _roster.Add(RosterEntry.FirstCopy(AccountId, heroDefinitionId));
        }
        else
        {
            entry.AddDuplicate();
        }

        UpdatedAtUtc = nowUtc;
    }

    /// <summary>FR-3: hard cap of 5 Active Squad slots, and every slotted hero must actually be owned.</summary>
    public void ApplyActiveSquadChanged(IReadOnlyList<Guid> heroDefinitionIds, DateTimeOffset nowUtc)
    {
        if (heroDefinitionIds.Count > ActiveSquadCapacity)
        {
            throw new EventValidationException($"Active squad cannot exceed {ActiveSquadCapacity} heroes.");
        }

        if (heroDefinitionIds.Distinct().Count() != heroDefinitionIds.Count)
        {
            throw new EventValidationException("Active squad cannot contain the same hero twice.");
        }

        foreach (var heroId in heroDefinitionIds)
        {
            if (_roster.TrueForAll(r => r.HeroDefinitionId != heroId))
            {
                throw new EventValidationException($"Hero {heroId} is not owned and cannot join the active squad.");
            }
        }

        _activeSquadHeroIds.Clear();
        _activeSquadHeroIds.AddRange(heroDefinitionIds);
        UpdatedAtUtc = nowUtc;
    }

    /// <summary>
    /// Moves the replay cursor forward past a processed event, whether accepted or
    /// rejected, so a single invalid event can never permanently stall the account's
    /// sync (a later, well-formed event is still applied on the next batch).
    /// </summary>
    public void AdvanceSequence(long sequenceNumber)
    {
        if (sequenceNumber > LastAppliedSequence)
        {
            LastAppliedSequence = sequenceNumber;
        }
    }
}
