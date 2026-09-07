using InfinityGrove.Backend.Application.Accounts;
using InfinityGrove.Backend.Application.Cards;
using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Domain.Cards;
using InfinityGrove.Backend.Domain.Heroes;
using InfinityGrove.Backend.Domain.Progress;
using InfinityGrove.Backend.Domain.Purchases;
using Microsoft.Extensions.Logging;

namespace InfinityGrove.Backend.Application.Purchases;

/// <summary>
/// AD-12's Summoning Stone purchase flow. <see cref="InitiateAsync"/> rejects
/// before any Steamworks call is made if the hero's FR-49 Hero Block is not yet
/// unlocked for the account's own furthest cleared stage, then calls InitTxn.
/// <see cref="AuthorizeAndFinalizeAsync"/> is invoked once Steam's own
/// authorization callback has been validated by the caller (the controller):
/// it calls FinalizeTxn and, only once that succeeds, mints the card and writes
/// its outbox grant entry — the same outbox-backed Steam Inventory mutation
/// path fusion already uses (AD-8) — in the same transaction that marks the
/// purchase Granted.
/// </summary>
public class SummoningStonePurchaseService(
    IPlayerProgressRepository progressRepository,
    ISummoningStonePurchaseRepository purchaseRepository,
    ICardInstanceRepository cardInstanceRepository,
    ISteamInventoryOutboxRepository outboxRepository,
    IAccountRepository accountRepository,
    ISummoningStoneCatalog catalog,
    ISteamMicrotransactionClient steamMicrotransactionClient,
    TimeProvider timeProvider,
    ILogger<SummoningStonePurchaseService> logger) : ISummoningStonePurchaseService
{
    public async Task<InitiatePurchaseResult> InitiateAsync(Guid accountId, Guid heroDefinitionId, CancellationToken cancellationToken)
    {
        var entry = catalog.GetEntry(heroDefinitionId);
        if (entry is null)
        {
            return InitiatePurchaseResult.Rejected($"Hero {heroDefinitionId} is not a valid Summoning Stone target.");
        }

        var progress = await progressRepository.GetByAccountIdAsync(accountId, cancellationToken);
        var furthestStageCleared = progress?.FurthestStageCleared ?? 0;

        // FR-49/AD-12: reject before any Steamworks call — and therefore before any
        // charge — if the hero's Hero Block isn't unlocked at the account's own progress.
        if (!entry.IsUnlockedAtStage(furthestStageCleared))
        {
            return InitiatePurchaseResult.Rejected(
                $"Hero {heroDefinitionId} requires furthest stage {entry.RequiredStage}; account is at {furthestStageCleared}.");
        }

        var account = await accountRepository.GetByIdAsync(accountId, cancellationToken);
        if (account is null)
        {
            return InitiatePurchaseResult.Rejected("Account not found.");
        }

        var steamOrderId = GenerateOrderId();
        var initResult = await steamMicrotransactionClient.InitTxnAsync(
            new SteamInitTxnRequest(
                account.SteamId64,
                steamOrderId,
                heroDefinitionId,
                entry.SteamItemDefId,
                entry.PriceAmountMinorUnits,
                entry.Currency,
                $"Summoning Stone: {heroDefinitionId}"),
            cancellationToken);

        if (!initResult.Success || initResult.TransactionId is null)
        {
            logger.LogError(
                "Steamworks InitTxn failed for account {AccountId}, hero {HeroDefinitionId}: {Error}",
                accountId, heroDefinitionId, initResult.ErrorMessage);
            return InitiatePurchaseResult.Rejected("Could not start the purchase with Steam right now.");
        }

        var nowUtc = timeProvider.GetUtcNow();
        var purchase = SummoningStonePurchase.Initiate(
            accountId, heroDefinitionId, steamOrderId, initResult.TransactionId,
            entry.PriceAmountMinorUnits, entry.Currency, nowUtc);

        await purchaseRepository.AddAsync(purchase, cancellationToken);
        await purchaseRepository.SaveChangesAsync(cancellationToken);

        return InitiatePurchaseResult.Accepted(steamOrderId, initResult.TransactionId, entry.PriceAmountMinorUnits, entry.Currency);
    }

    public async Task<FinalizePurchaseResult> AuthorizeAndFinalizeAsync(long steamOrderId, string steamId64, CancellationToken cancellationToken)
    {
        var purchase = await purchaseRepository.GetBySteamOrderIdAsync(steamOrderId, cancellationToken);
        if (purchase is null)
        {
            return FinalizePurchaseResult.Rejected($"No purchase found for Steam order {steamOrderId}.");
        }

        if (purchase.Status != SummoningStonePurchaseStatus.Initiated)
        {
            // Steam's callback can arrive more than once; only the first call actually
            // finalizes and grants — later calls report the same terminal result.
            return purchase.Status == SummoningStonePurchaseStatus.Granted
                ? FinalizePurchaseResult.Accepted(purchase.GrantedCardInstanceId!.Value, purchase.OutboxEntryId!.Value)
                : FinalizePurchaseResult.Rejected(purchase.FailureReason ?? $"Purchase is {purchase.Status}.");
        }

        var account = await accountRepository.GetByIdAsync(purchase.AccountId, cancellationToken);
        var nowUtc = timeProvider.GetUtcNow();
        if (account is null || account.SteamId64 != steamId64)
        {
            purchase.MarkFailed("Steam authorization callback's SteamID did not match the purchasing account.", nowUtc);
            await purchaseRepository.SaveChangesAsync(cancellationToken);
            return FinalizePurchaseResult.Rejected("Account mismatch.");
        }

        var finalizeResult = await steamMicrotransactionClient.FinalizeTxnAsync(steamOrderId, cancellationToken);
        if (!finalizeResult.Success)
        {
            logger.LogError("Steamworks FinalizeTxn failed for order {SteamOrderId}: {Error}", steamOrderId, finalizeResult.ErrorMessage);
            purchase.MarkFailed(finalizeResult.ErrorMessage ?? "Steam could not finalize the charge.", nowUtc);
            await purchaseRepository.SaveChangesAsync(cancellationToken);
            return FinalizePurchaseResult.Rejected("Could not finalize the charge with Steam.");
        }

        purchase.MarkFinalized(nowUtc);

        // AD-12: grant the chosen card through the same outbox-backed Steam
        // Inventory mutation path fusion already uses (AD-8) — mint it Owned in
        // Postgres now, then queue the real Steam Inventory item creation for the
        // background worker to drain.
        var cardInstance = CardInstance.Mint(purchase.AccountId, purchase.HeroDefinitionId, nowUtc);
        await cardInstanceRepository.AddAsync(cardInstance, cancellationToken);

        var catalogEntry = catalog.GetEntry(purchase.HeroDefinitionId);
        var outboxEntry = SteamInventoryOutboxEntry.CreateForGrant(
            purchase.AccountId, cardInstance.Id, catalogEntry?.SteamItemDefId ?? 0, nowUtc);
        await outboxRepository.AddAsync(outboxEntry, cancellationToken);

        purchase.MarkGranted(cardInstance.Id, outboxEntry.Id, nowUtc);

        var progress = await progressRepository.GetByAccountIdAsync(purchase.AccountId, cancellationToken);
        if (progress is null)
        {
            progress = PlayerProgress.CreateForAccount(purchase.AccountId, nowUtc);
            await progressRepository.AddAsync(progress, cancellationToken);
        }

        progress.ApplyHeroAcquired(purchase.HeroDefinitionId, nowUtc);

        // All of the above shares the one scoped DbContext behind these
        // repositories (same pattern FusionService relies on), so this single
        // call commits the purchase, the roster/duplicate bookkeeping, the
        // minted card, and the outbox entry together.
        await purchaseRepository.SaveChangesAsync(cancellationToken);

        return FinalizePurchaseResult.Accepted(cardInstance.Id, outboxEntry.Id);
    }

    private long GenerateOrderId()
    {
        // Steamworks requires a caller-generated 64-bit order id, unique per app.
        // A random positive long has a collision probability low enough not to
        // warrant a generate-and-retry loop at this task's scope; the
        // SteamOrderId column's unique index (see SummoningStonePurchaseConfiguration)
        // still guards against it rather than silently overwriting a colliding row.
        return Random.Shared.NextInt64(1, long.MaxValue);
    }
}
