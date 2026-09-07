using InfinityGrove.Backend.Domain.Market;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace InfinityGrove.Backend.Infrastructure.Market;

public class ConfiguredTradeableCardCatalog(
    IOptions<TradeableCardCatalogOptions> options,
    ILogger<ConfiguredTradeableCardCatalog> logger) : ITradeableCardCatalog
{
    public IReadOnlyList<TradeableCardCatalogEntry> GetAllEntries()
    {
        var entries = new List<TradeableCardCatalogEntry>();

        foreach (var (key, marketHashName) in options.Value.Heroes)
        {
            if (!Guid.TryParse(key, out var heroDefinitionId))
            {
                logger.LogError("TradeableCards config has an invalid hero id '{Key}'; skipping this entry.", key);
                continue;
            }

            entries.Add(new TradeableCardCatalogEntry(heroDefinitionId, marketHashName));
        }

        return entries;
    }
}
