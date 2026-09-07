using InfinityGrove.Backend.Application.Market;
using InfinityGrove.Backend.Domain.Market;
using InfinityGrove.Backend.Infrastructure.Steam;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace InfinityGrove.Backend.Infrastructure.Market;

/// <summary>
/// AD-13: on a fixed backend-owned schedule, polls the unofficial
/// `priceoverview` endpoint once per catalog entry and caches the last
/// successful result in Postgres, so the client only ever reads a periodic
/// snapshot (FR-29) — it never calls Valve directly. Per this AD's own
/// impact note, a failed fetch (including Valve blocking/changing the
/// endpoint at scale) is logged and skipped, never surfaced as a hard error
/// that would affect the Summoning Stone purchase flow (AD-12), which does
/// not depend on this data.
/// </summary>
public class MarketPriceCacheWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<MarketPriceCacheOptions> options,
    IOptions<SteamworksOptions> steamOptions,
    TimeProvider timeProvider,
    ILogger<MarketPriceCacheWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var pollInterval = TimeSpan.FromMinutes(Math.Max(1, options.Value.PollIntervalMinutes));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PollOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Unhandled error while polling Market reference prices.");
            }

            try
            {
                await Task.Delay(pollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
            }
        }
    }

    private async Task PollOnceAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var catalog = scope.ServiceProvider.GetRequiredService<ITradeableCardCatalog>();
        var quoteClient = scope.ServiceProvider.GetRequiredService<IMarketPriceQuoteClient>();
        var repository = scope.ServiceProvider.GetRequiredService<IMarketPriceRepository>();

        var appId = steamOptions.Value.AppId;
        var currencyId = options.Value.CurrencyId;
        var currencyLabel = currencyId.ToString();
        var requestDelay = TimeSpan.FromMilliseconds(Math.Max(0, options.Value.RequestDelayMilliseconds));

        var entries = catalog.GetAllEntries();
        foreach (var entry in entries)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var result = await quoteClient.GetPriceOverviewAsync(appId, entry.MarketHashName, currencyId, cancellationToken);
            if (!result.Success)
            {
                logger.LogWarning(
                    "Market price fetch failed for hero {HeroDefinitionId} ({MarketHashName}): {Error}",
                    entry.HeroDefinitionId, entry.MarketHashName, result.ErrorMessage);
            }
            else
            {
                await UpsertSnapshotAsync(repository, entry.HeroDefinitionId, currencyLabel, result, cancellationToken);
            }

            if (!ReferenceEquals(entry, entries[^1]))
            {
                try
                {
                    await Task.Delay(requestDelay, cancellationToken);
                }
                catch (OperationCanceledException)
                {
                }
            }
        }
    }

    private async Task UpsertSnapshotAsync(
        IMarketPriceRepository repository,
        Guid heroDefinitionId,
        string currency,
        MarketPriceQuoteResult result,
        CancellationToken cancellationToken)
    {
        var nowUtc = timeProvider.GetUtcNow();
        var existing = await repository.GetByHeroAsync(heroDefinitionId, cancellationToken);

        if (existing is null)
        {
            await repository.AddAsync(
                MarketPriceSnapshot.Create(heroDefinitionId, currency, result.LowestPrice, result.MedianPrice, result.Volume, nowUtc),
                cancellationToken);
        }
        else
        {
            existing.Refresh(currency, result.LowestPrice, result.MedianPrice, result.Volume, nowUtc);
        }

        await repository.SaveChangesAsync(cancellationToken);
    }
}
