using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Domain.Cards;

namespace InfinityGrove.Backend.Application.Cards;

/// <summary>
/// AD-8's fusion transaction: validate the account owns enough Owned duplicates
/// of the hero → transition exactly that many CardInstance rows Owned ->
/// PendingOutbox → advance the hero's star tier → write the outbox record a
/// background worker later drains against the Steamworks Web API. Every write
/// here goes through the one shared DbContext behind these repositories, so the
/// single <see cref="IPlayerProgressRepository.SaveChangesAsync"/> call at the
/// end commits (or, on a concurrency conflict, rolls back) all of it together —
/// this is the "single Postgres transaction" AD-8 requires, with no separate
/// explicit BeginTransaction needed.
/// </summary>
public class FusionService(
    IPlayerProgressRepository progressRepository,
    ICardInstanceRepository cardInstanceRepository,
    ISteamInventoryOutboxRepository outboxRepository,
    TimeProvider timeProvider) : IFusionService
{
    public async Task<FusionResult> FuseAsync(Guid accountId, Guid heroDefinitionId, CancellationToken cancellationToken)
    {
        var progress = await progressRepository.GetByAccountIdAsync(accountId, cancellationToken);
        var rosterEntry = progress?.Roster.FirstOrDefault(r => r.HeroDefinitionId == heroDefinitionId);
        if (progress is null || rosterEntry is null)
        {
            return FusionResult.Rejected($"Hero {heroDefinitionId} is not owned.");
        }

        try
        {
            rosterEntry.EnsureCanFuse();
        }
        catch (FusionValidationException ex)
        {
            return FusionResult.Rejected(ex.Message);
        }

        var required = CardFusionCostCurve.DuplicatesRequiredForNextTier(rosterEntry.StarTier);
        var toConsume = await cardInstanceRepository.GetOwnedByHeroAsync(accountId, heroDefinitionId, required, cancellationToken);
        if (toConsume.Count < required)
        {
            return FusionResult.Rejected(
                $"Fusing hero {heroDefinitionId} to tier {rosterEntry.StarTier + 1} requires {required} duplicate(s); only {toConsume.Count} available.");
        }

        var nowUtc = timeProvider.GetUtcNow();

        try
        {
            foreach (var instance in toConsume)
            {
                // Owned -> PendingOutbox (AD-8b): from here the same card can no
                // longer be picked up by "prepare to list" (FR-33's reverse direction).
                instance.MarkPendingOutbox(nowUtc);
            }
        }
        catch (CardInstanceStateException ex)
        {
            // A concurrent request (e.g. a "prepare to list" call) already moved one
            // of these instances out of Owned between our read and this write.
            return FusionResult.Rejected(ex.Message);
        }

        rosterEntry.ConsumeDuplicates(toConsume.Count);
        rosterEntry.FuseUp();

        var consumedIds = toConsume.Select(c => c.Id).ToList();
        var outboxEntry = SteamInventoryOutboxEntry.CreateForConsume(accountId, consumedIds, nowUtc);
        await outboxRepository.AddAsync(outboxEntry, cancellationToken);

        try
        {
            await progressRepository.SaveChangesAsync(cancellationToken);
        }
        catch (ConcurrentModificationException)
        {
            // FR-33: another request (fusion or a "prepare to list" call) committed
            // against one of the same card instances first. Nothing here was
            // persisted — reject and let the client re-request against fresh state.
            return FusionResult.Rejected(
                "One of the duplicate cards for this fusion was modified by another request. Please retry.");
        }

        return FusionResult.Accepted(rosterEntry.StarTier, consumedIds, outboxEntry.Id);
    }
}
