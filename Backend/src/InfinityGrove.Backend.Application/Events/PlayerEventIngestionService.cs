using System.Text.Json;
using BreakInfinity;
using InfinityGrove.Backend.Application.Cards;
using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Application.Rewards;
using InfinityGrove.Backend.Domain.Cards;
using InfinityGrove.Backend.Domain.Drops;
using InfinityGrove.Backend.Domain.Events;
using InfinityGrove.Backend.Domain.Progress;
using InfinityGrove.Backend.Domain.Rewards;

namespace InfinityGrove.Backend.Application.Events;

/// <summary>
/// Implements AD-6's "backend replays and validates each event against game rules
/// and returns the canonical state" for gold, stage progress, and roster state.
/// One call = one Postgres transaction: the account's <see cref="PlayerProgress"/>
/// row, every event's append-only log row, and (per AD-8b) any newly-minted
/// <see cref="CardInstance"/> rows are only persisted once, via the single
/// <see cref="IPlayerProgressRepository.SaveChangesAsync"/> at the end, so a
/// batch's replay and its audit trail commit atomically together.
/// </summary>
public class PlayerEventIngestionService(
    IPlayerProgressRepository progressRepository,
    IPlayerEventRepository eventRepository,
    ICardInstanceRepository cardInstanceRepository,
    TimeProvider timeProvider,
    ProgressOptions progressOptions,
    IRewardGrantRepository rewardGrantRepository,
    DropCatalog dropCatalog,
    IDropRandom dropRandom) : IPlayerEventIngestionService
{
    public async Task<IngestBatchResult> IngestAsync(Guid accountId, IReadOnlyList<IngestEventCommand> events, CancellationToken cancellationToken)
    {
        var progress = await progressRepository.GetByAccountIdAsync(accountId, cancellationToken);
        var nowUtc = timeProvider.GetUtcNow();
        if (progress is null)
        {
            progress = PlayerProgress.CreateForAccount(accountId, nowUtc);
            await progressRepository.AddAsync(progress, cancellationToken);
        }

        var results = new List<EventIngestionResult>(events.Count);
        var toPersist = new List<PlayerEvent>(events.Count);
        var newGrants = new List<RewardGrant>();

        // Sequence order matters: later events may depend on state a prior event in
        // the same batch established (e.g. HeroAcquired before ActiveSquadChanged).
        foreach (var incoming in events.OrderBy(e => e.SequenceNumber))
        {
            var existing = await eventRepository.FindByClientEventIdAsync(accountId, incoming.ClientEventId, cancellationToken);
            if (existing is not null)
            {
                // Same batch resent after a dropped response (AD-6's "syncs opportunistically"):
                // already durably recorded — report the real prior verdict without reapplying it.
                // Rewards are not rolled again: the stored grants of that event come back instead.
                var stored = await rewardGrantRepository.ListBySourceEventAsync(accountId, incoming.ClientEventId, cancellationToken);
                results.Add(new EventIngestionResult(
                    incoming.ClientEventId, existing.Status, existing.RejectionReason, [.. stored.Select(RewardGrantDto.From)]));
                continue;
            }

            if (incoming.SequenceNumber <= progress.LastAppliedSequence)
            {
                // An unknown ClientEventId behind the cursor (numbered before another session
                // moved the account on): rejected without persisting, so the client renumbers
                // above the cursor and resends the same id (AD-006).
                results.Add(new EventIngestionResult(incoming.ClientEventId, PlayerEventStatus.Rejected, EventRejections.StaleSequence));
                continue;
            }

            var payloadJson = incoming.Payload.GetRawText();
            try
            {
                var granted = new List<RewardGrant>();
                await ApplyEventAsync(progress, incoming, nowUtc, granted, cancellationToken);
                progress.AdvanceSequence(incoming.SequenceNumber);
                newGrants.AddRange(granted);
                toPersist.Add(PlayerEvent.Accepted(
                    accountId, incoming.ClientEventId, incoming.SequenceNumber, incoming.Type, payloadJson, incoming.OccurredAtUtc, nowUtc));
                results.Add(new EventIngestionResult(
                    incoming.ClientEventId, PlayerEventStatus.Accepted, null, [.. granted.Select(RewardGrantDto.From)]));
            }
            catch (EventValidationException ex)
            {
                // Rejecting this event still advances the cursor past it (see AdvanceSequence's
                // doc comment) so one bad event from a stale/tampered client can't wedge the account.
                progress.AdvanceSequence(incoming.SequenceNumber);
                toPersist.Add(PlayerEvent.Rejected(
                    accountId, incoming.ClientEventId, incoming.SequenceNumber, incoming.Type, payloadJson, incoming.OccurredAtUtc, nowUtc, ex.Message));
                results.Add(new EventIngestionResult(incoming.ClientEventId, PlayerEventStatus.Rejected, ex.Message));
            }
        }

        await eventRepository.AddRangeAsync(toPersist, cancellationToken);
        await rewardGrantRepository.AddRangeAsync(newGrants, cancellationToken);
        await progressRepository.SaveChangesAsync(cancellationToken);

        return new IngestBatchResult(results, ToSnapshot(progress));
    }

    public async Task<PlayerProgressSnapshot> GetStateAsync(Guid accountId, CancellationToken cancellationToken)
    {
        var progress = await progressRepository.GetByAccountIdAsync(accountId, cancellationToken);
        return progress is null ? PlayerProgressSnapshot.Empty() : ToSnapshot(progress);
    }

    private async Task ApplyEventAsync(PlayerProgress progress, IngestEventCommand incoming, DateTimeOffset nowUtc, List<RewardGrant> granted, CancellationToken cancellationToken)
    {
        switch (incoming.Type)
        {
            case PlayerEventType.GoldEarned:
            {
                var payload = Deserialize<GoldEarnedPayload>(incoming.Payload, "GoldEarned");
                progress.ApplyGoldEarned(new BigDouble(payload.GoldMantissa, payload.GoldExponent), nowUtc);
                break;
            }
            case PlayerEventType.GoldSpent:
            {
                var payload = Deserialize<GoldSpentPayload>(incoming.Payload, "GoldSpent");
                progress.ApplyGoldSpent(new BigDouble(payload.GoldMantissa, payload.GoldExponent), nowUtc);
                break;
            }
            case PlayerEventType.StageCleared:
            {
                var payload = Deserialize<StageClearedPayload>(incoming.Payload, "StageCleared");
                progress.ApplyStageCleared(payload.StageNumber, progressOptions.BossEvery, nowUtc);
                break;
            }
            case PlayerEventType.BossDefeated:
            {
                var payload = Deserialize<BossDefeatedPayload>(incoming.Payload, "BossDefeated");
                var firstDefeat = payload.StageNumber > progress.HighestBossDefeated;
                progress.ApplyBossDefeated(payload.StageNumber, progressOptions.BossEvery, nowUtc);

                // DROP-01: hero (always on the first defeat, 1% on repeats) and item (boss chance) roll independently.
                if (dropRandom.NextDouble() < DropRules.HeroDropChance(firstDefeat))
                {
                    var heroId = DropRules.RollHero(dropCatalog, payload.StageNumber, dropRandom);
                    var isNew = progress.Roster.All(r => r.HeroDefinitionId != heroId);
                    progress.ApplyHeroAcquired(heroId, nowUtc);
                    await cardInstanceRepository.AddAsync(CardInstance.Mint(progress.AccountId, heroId, nowUtc), cancellationToken);
                    granted.Add(RewardGrant.ForHero(progress.AccountId, incoming.ClientEventId, heroId, isNew, nowUtc));
                }

                if (dropRandom.NextDouble() < dropCatalog.BossDropChance)
                {
                    var item = DropRules.RollItem(dropCatalog, payload.StageNumber, dropRandom);
                    granted.Add(RewardGrant.ForItem(
                        progress.AccountId, incoming.ClientEventId, item.ItemId, SerializeRolls(item.AffixRolls), nowUtc));
                }

                break;
            }
            case PlayerEventType.MonsterKillsBatch:
            {
                var payload = Deserialize<MonsterKillsBatchPayload>(incoming.Payload, "MonsterKillsBatch");
                progress.ApplyMonsterKillsBatch(
                    payload.StageNumber, payload.Count, progressOptions.BossEvery, progressOptions.MaxKillsPerEvent,
                    progressOptions.MinKillIntervalMs, progressOptions.KillBucketCap, nowUtc);

                // DROP-03: the number of drops is decided here, never by the client.
                var drops = DropRules.CountNormalDrops(payload.Count, dropCatalog.NormalDropChance, dropRandom);
                for (var i = 0; i < drops; i++)
                {
                    var item = DropRules.RollItem(dropCatalog, payload.StageNumber, dropRandom);
                    granted.Add(RewardGrant.ForItem(
                        progress.AccountId, incoming.ClientEventId, item.ItemId, SerializeRolls(item.AffixRolls), nowUtc));
                }

                break;
            }
            case PlayerEventType.HeroAcquired:
            {
                var payload = Deserialize<HeroAcquiredPayload>(incoming.Payload, "HeroAcquired");
                progress.ApplyHeroAcquired(payload.HeroDefinitionId, nowUtc);

                // AD-8b: every acquired copy is a real Steam Inventory item instance,
                // minted Owned/marketable=false — the substrate fusion and Market
                // listing (AD-8/AD-8b) operate on. Committed atomically with the
                // rest of this batch via the same SaveChangesAsync below.
                var cardInstance = CardInstance.Mint(progress.AccountId, payload.HeroDefinitionId, nowUtc);
                await cardInstanceRepository.AddAsync(cardInstance, cancellationToken);
                break;
            }
            case PlayerEventType.ActiveSquadChanged:
            {
                var payload = Deserialize<ActiveSquadChangedPayload>(incoming.Payload, "ActiveSquadChanged");
                progress.ApplyActiveSquadChanged(
                    payload.HeroDefinitionIds ?? throw new EventValidationException("Malformed ActiveSquadChanged payload: heroDefinitionIds is required."),
                    nowUtc);
                break;
            }
            default:
                throw new EventValidationException($"Unknown event type: {incoming.Type}");
        }
    }

    private static string SerializeRolls(IReadOnlyList<RolledAffix> rolls) =>
        JsonSerializer.Serialize(rolls.Select(r => new { affix = r.Affix, value = r.Value }));

    private static readonly JsonSerializerOptions PayloadSerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static T Deserialize<T>(JsonElement payload, string eventTypeName)
    {
        try
        {
            return payload.Deserialize<T>(PayloadSerializerOptions)
                ?? throw new EventValidationException($"Malformed {eventTypeName} payload.");
        }
        catch (JsonException)
        {
            throw new EventValidationException($"Malformed {eventTypeName} payload.");
        }
    }

    private static PlayerProgressSnapshot ToSnapshot(PlayerProgress progress) => new(
        progress.GoldMantissa,
        progress.GoldExponent,
        progress.FurthestStageCleared,
        progress.LastAppliedSequence,
        [.. progress.Roster.Select(r => new RosterEntrySnapshot(r.HeroDefinitionId, r.OwnedCount, r.StarTier))],
        [.. progress.ActiveSquadHeroIds]);
}
