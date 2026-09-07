using System.Text.Json;
using BreakInfinity;
using InfinityGrove.Backend.Application.Cards;
using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Domain.Cards;
using InfinityGrove.Backend.Domain.Events;
using InfinityGrove.Backend.Domain.Progress;

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
    TimeProvider timeProvider) : IPlayerEventIngestionService
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

        // Sequence order matters: later events may depend on state a prior event in
        // the same batch established (e.g. HeroAcquired before ActiveSquadChanged).
        foreach (var incoming in events.OrderBy(e => e.SequenceNumber))
        {
            var existing = await eventRepository.FindByClientEventIdAsync(accountId, incoming.ClientEventId, cancellationToken);
            if (existing is not null)
            {
                // Same batch resent after a dropped response (AD-6's "syncs opportunistically"):
                // already durably recorded — report the real prior verdict without reapplying it.
                results.Add(new EventIngestionResult(incoming.ClientEventId, existing.Status, existing.RejectionReason));
                continue;
            }

            if (incoming.SequenceNumber <= progress.LastAppliedSequence)
            {
                // A different ClientEventId than any on record, but a sequence number the
                // account has already moved past (e.g. the client's local log was rebuilt) —
                // treated as a stale no-op rather than replayed against no-longer-current state.
                results.Add(new EventIngestionResult(incoming.ClientEventId, PlayerEventStatus.Accepted, null));
                continue;
            }

            var payloadJson = incoming.Payload.GetRawText();
            try
            {
                await ApplyEventAsync(progress, incoming, nowUtc, cancellationToken);
                progress.AdvanceSequence(incoming.SequenceNumber);
                toPersist.Add(PlayerEvent.Accepted(
                    accountId, incoming.ClientEventId, incoming.SequenceNumber, incoming.Type, payloadJson, incoming.OccurredAtUtc, nowUtc));
                results.Add(new EventIngestionResult(incoming.ClientEventId, PlayerEventStatus.Accepted, null));
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
        await progressRepository.SaveChangesAsync(cancellationToken);

        return new IngestBatchResult(results, ToSnapshot(progress));
    }

    public async Task<PlayerProgressSnapshot> GetStateAsync(Guid accountId, CancellationToken cancellationToken)
    {
        var progress = await progressRepository.GetByAccountIdAsync(accountId, cancellationToken);
        return progress is null ? PlayerProgressSnapshot.Empty() : ToSnapshot(progress);
    }

    private async Task ApplyEventAsync(PlayerProgress progress, IngestEventCommand incoming, DateTimeOffset nowUtc, CancellationToken cancellationToken)
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
                progress.ApplyStageCleared(payload.StageNumber, nowUtc);
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
