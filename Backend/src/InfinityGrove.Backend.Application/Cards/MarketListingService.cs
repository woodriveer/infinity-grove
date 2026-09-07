using InfinityGrove.Backend.Application.Accounts;
using InfinityGrove.Backend.Domain.Cards;
using Microsoft.Extensions.Logging;

namespace InfinityGrove.Backend.Application.Cards;

/// <summary>
/// AD-8b: the client asks to list a specific card; this synchronously checks
/// the card's current Postgres state is Owned (not Consumed, not PendingOutbox,
/// not already Listed), and only if clear, calls the Steamworks Web API to flip
/// that one item instance to marketable=true and transitions its Postgres state
/// to Listed — before returning success. This is the enforcement point for
/// FR-33's other direction: fusion already rejects a card that is Listed
/// (CardInstance.MarkPendingOutbox requires Owned); this rejects listing a card
/// already committed to fusion (PendingOutbox) or already Listed/Consumed.
/// </summary>
public class MarketListingService(
    ICardInstanceRepository cardInstanceRepository,
    IAccountRepository accountRepository,
    ISteamInventoryPublisherClient steamInventoryClient,
    TimeProvider timeProvider,
    ILogger<MarketListingService> logger) : IMarketListingService
{
    public async Task<PrepareToListResult> PrepareToListAsync(Guid accountId, Guid cardInstanceId, CancellationToken cancellationToken)
    {
        var cardInstance = await cardInstanceRepository.GetByIdAsync(cardInstanceId, cancellationToken);
        if (cardInstance is null || cardInstance.AccountId != accountId)
        {
            return PrepareToListResult.Rejected("Card instance not found.");
        }

        if (cardInstance.State != CardInstanceState.Owned)
        {
            return PrepareToListResult.Rejected(
                $"Card instance {cardInstanceId} cannot be listed: current state is {cardInstance.State}, not Owned.");
        }

        var account = await accountRepository.GetByIdAsync(accountId, cancellationToken);
        if (account is null)
        {
            return PrepareToListResult.Rejected("Account not found.");
        }

        var steamResult = await steamInventoryClient.SetItemMarketableAsync(
            account.SteamId64, cardInstance.Id.ToString(), cancellationToken);

        if (!steamResult.Success)
        {
            logger.LogError(
                "Steam Inventory marketable flip failed for card instance {CardInstanceId}: {Error}",
                cardInstanceId, steamResult.ErrorMessage);
            return PrepareToListResult.Rejected(
                "Could not authorize this card for listing on the Steam Community Market right now.");
        }

        try
        {
            cardInstance.MarkListed(timeProvider.GetUtcNow());
            await cardInstanceRepository.SaveChangesAsync(cancellationToken);
        }
        catch (CardInstanceStateException ex)
        {
            // A concurrent request (most likely a fusion) already moved this
            // instance out of Owned between our check above and this write. Steam
            // now has this item marked marketable even though we won't record it
            // as Listed — a known residual gap this task does not close (see
            // AD-8b's own reconciliation-job trade-off note); flagged loudly so
            // it is never silently swallowed.
            logger.LogError(ex,
                "Card instance {CardInstanceId} changed state concurrently with a successful Steam marketable flip.",
                cardInstanceId);
            return PrepareToListResult.Rejected(ex.Message);
        }
        catch (ConcurrentModificationException ex)
        {
            logger.LogError(ex,
                "Card instance {CardInstanceId} was modified concurrently with a successful Steam marketable flip.",
                cardInstanceId);
            return PrepareToListResult.Rejected(
                "This card was modified by another request. Please retry.");
        }

        return PrepareToListResult.Ok;
    }
}
