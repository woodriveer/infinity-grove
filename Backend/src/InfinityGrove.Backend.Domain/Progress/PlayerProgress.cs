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

    /// <summary>AD-002 default: a timed boss every 5th stage (ingestion makes it configurable).</summary>
    public const int DefaultBossEvery = 5;

    public Guid AccountId { get; private set; }

    /// <summary>AD-7: canonical gold is stored as this (mantissa, exponent) pair, not a native numeric column.</summary>
    public double GoldMantissa { get; private set; }
    public int GoldExponent { get; private set; }

    public int FurthestStageCleared { get; private set; }

    /// <summary>AD-002: the highest boss stage whose timed boss the account has defeated (0 = none).</summary>
    public int HighestBossDefeated { get; private set; }

    /// <summary>DROP-04: kills still allowed by the token bucket as of <see cref="KillAllowanceAtUtc"/>; null until the first batch.</summary>
    public long? KillAllowance { get; private set; }
    public DateTimeOffset? KillAllowanceAtUtc { get; private set; }

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
    /// a valid no-op, not a rejection. AD-002: a boss stage (every
    /// <paramref name="bossEvery"/>-th) is cleared only after its BossDefeated.
    /// </summary>
    public void ApplyStageCleared(int stageNumber, int bossEvery, DateTimeOffset nowUtc)
    {
        EnsureStageReachable(stageNumber);

        if (IsBossStage(stageNumber, bossEvery) && stageNumber > HighestBossDefeated)
        {
            throw new EventValidationException(
                $"Cannot clear boss stage {stageNumber} before defeating its boss.");
        }

        if (stageNumber > FurthestStageCleared)
        {
            FurthestStageCleared = stageNumber;
        }

        UpdatedAtUtc = nowUtc;
    }

    /// <summary>
    /// AD-002: the timed boss of a boss stage follows the same order rule as
    /// StageCleared (at most one stage past furthest progress; replay is a no-op)
    /// and is only valid on a boss stage.
    /// </summary>
    public void ApplyBossDefeated(int stageNumber, int bossEvery, DateTimeOffset nowUtc)
    {
        EnsureStageReachable(stageNumber);

        if (!IsBossStage(stageNumber, bossEvery))
        {
            throw new EventValidationException($"Stage {stageNumber} is not a boss stage.");
        }

        if (stageNumber > HighestBossDefeated)
        {
            HighestBossDefeated = stageNumber;
        }

        UpdatedAtUtc = nowUtc;
    }

    public static bool IsBossStage(int stageNumber, int bossEvery) => stageNumber % bossEvery == 0;

    private void EnsureStageReachable(int stageNumber)
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
    /// DROP-04: token bucket on server time. The first call starts with a full bucket
    /// (<paramref name="cap"/>); it refills one kill per <paramref name="intervalMs"/>.
    /// A claim above the allowance is refused and leaves the bucket untouched; a clock
    /// that went backwards grants nothing.
    /// </summary>
    public bool TryConsumeKills(int count, DateTimeOffset nowUtc, int intervalMs, int cap)
    {
        var allowance = KillAllowance ?? cap;
        var at = KillAllowanceAtUtc ?? nowUtc;

        if (nowUtc > at)
        {
            var refill = (long)(nowUtc - at).TotalMilliseconds / intervalMs;
            allowance = Math.Min(cap, allowance + refill);
            at = allowance >= cap ? nowUtc : at.AddMilliseconds(refill * intervalMs);
        }

        if (count > allowance)
        {
            return false;
        }

        KillAllowance = allowance - count;
        KillAllowanceAtUtc = at;
        UpdatedAtUtc = nowUtc;
        return true;
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
