using InfinityGrove.Backend.Domain.Heroes;
using Microsoft.Extensions.Options;

namespace InfinityGrove.Backend.Infrastructure.Heroes;

public class ConfiguredSummoningStoneCatalog(IOptions<SummoningStoneCatalogOptions> options) : ISummoningStoneCatalog
{
    public SummoningStoneCatalogEntry? GetEntry(Guid heroDefinitionId)
    {
        if (!options.Value.Heroes.TryGetValue(heroDefinitionId, out var entry))
        {
            return null;
        }

        return new SummoningStoneCatalogEntry(
            entry.RequiredStage, entry.PriceAmountMinorUnits, entry.Currency, entry.SteamItemDefId);
    }
}
