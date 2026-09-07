using InfinityGrove.Backend.Application.Accounts;
using InfinityGrove.Backend.Application.Auth;
using InfinityGrove.Backend.Application.Cards;
using InfinityGrove.Backend.Application.Events;
using InfinityGrove.Backend.Application.Market;
using InfinityGrove.Backend.Application.MarketAbuse;
using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Application.Purchases;
using InfinityGrove.Backend.Domain.Heroes;
using InfinityGrove.Backend.Domain.Market;
using InfinityGrove.Backend.Infrastructure.Auth;
using InfinityGrove.Backend.Infrastructure.Cards;
using InfinityGrove.Backend.Infrastructure.Heroes;
using InfinityGrove.Backend.Infrastructure.Market;
using InfinityGrove.Backend.Infrastructure.MarketAbuse;
using InfinityGrove.Backend.Infrastructure.Persistence;
using InfinityGrove.Backend.Infrastructure.Steam;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace InfinityGrove.Backend.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<InfinityGroveDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("Postgres")));

        services.Configure<SteamworksOptions>(configuration.GetSection(SteamworksOptions.SectionName));
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<SummoningStoneCatalogOptions>(configuration.GetSection(SummoningStoneCatalogOptions.SectionName));
        services.Configure<TradeableCardCatalogOptions>(configuration.GetSection(TradeableCardCatalogOptions.SectionName));
        services.Configure<MarketPriceCacheOptions>(configuration.GetSection(MarketPriceCacheOptions.SectionName));
        services.Configure<MarketAbuseDetectionOptions>(configuration.GetSection(MarketAbuseDetectionOptions.SectionName));

        services.AddSingleton(TimeProvider.System);

        services.AddScoped<IAccountRepository, AccountRepository>();
        services.AddScoped<ISessionTokenService, JwtSessionTokenService>();
        services.AddScoped<ISteamAuthenticationService, SteamAuthenticationService>();

        services.AddScoped<IPlayerProgressRepository, PlayerProgressRepository>();
        services.AddScoped<IPlayerEventRepository, PlayerEventRepository>();
        services.AddScoped<IPlayerEventIngestionService, PlayerEventIngestionService>();

        services.AddScoped<ICardInstanceRepository, CardInstanceRepository>();
        services.AddScoped<ISteamInventoryOutboxRepository, SteamInventoryOutboxRepository>();
        services.AddScoped<IFusionService, FusionService>();
        services.AddScoped<IMarketListingService, MarketListingService>();
        services.AddHostedService<SteamInventoryOutboxWorker>();

        services.AddSingleton<ISummoningStoneCatalog, ConfiguredSummoningStoneCatalog>();
        services.AddScoped<ISummoningStonePurchaseRepository, SummoningStonePurchaseRepository>();
        services.AddScoped<ISummoningStonePurchaseService, SummoningStonePurchaseService>();

        // AD-13: Market reference price caching (priceoverview polling).
        services.AddSingleton<ITradeableCardCatalog, ConfiguredTradeableCardCatalog>();
        services.AddScoped<IMarketPriceRepository, MarketPriceRepository>();
        services.AddHttpClient<IMarketPriceQuoteClient, SteamMarketPriceOverviewClient>((sp, client) =>
        {
            var marketPriceOptions = configuration.GetSection(MarketPriceCacheOptions.SectionName).Get<MarketPriceCacheOptions>()
                ?? new MarketPriceCacheOptions();
            client.BaseAddress = new Uri(marketPriceOptions.BaseUrl);
        });
        services.AddHostedService<MarketPriceCacheWorker>();

        // AD-14/NFR-8: Market-scoped anti-bot detection over the event log.
        services.AddScoped<IMarketAbuseFlagRepository, MarketAbuseFlagRepository>();
        services.AddHostedService<MarketAbuseDetectionWorker>();

        services.AddHttpClient<ISteamAuthTicketVerifier, SteamAuthTicketVerifier>((sp, client) =>
        {
            var steamOptions = configuration.GetSection(SteamworksOptions.SectionName).Get<SteamworksOptions>()
                ?? new SteamworksOptions();
            client.BaseAddress = new Uri(steamOptions.WebApiBaseUrl);
        });

        services.AddHttpClient<ISteamInventoryPublisherClient, SteamworksInventoryPublisherClient>((sp, client) =>
        {
            var steamOptions = configuration.GetSection(SteamworksOptions.SectionName).Get<SteamworksOptions>()
                ?? new SteamworksOptions();
            client.BaseAddress = new Uri(steamOptions.WebApiBaseUrl);
        });

        services.AddHttpClient<ISteamMicrotransactionClient, SteamworksMicrotransactionClient>((sp, client) =>
        {
            var steamOptions = configuration.GetSection(SteamworksOptions.SectionName).Get<SteamworksOptions>()
                ?? new SteamworksOptions();
            client.BaseAddress = new Uri(steamOptions.WebApiBaseUrl);
        });

        return services;
    }
}
