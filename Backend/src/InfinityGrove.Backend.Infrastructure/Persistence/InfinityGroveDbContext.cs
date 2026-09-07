using InfinityGrove.Backend.Domain.Accounts;
using InfinityGrove.Backend.Domain.Cards;
using InfinityGrove.Backend.Domain.Events;
using InfinityGrove.Backend.Domain.Market;
using InfinityGrove.Backend.Domain.MarketAbuse;
using InfinityGrove.Backend.Domain.Progress;
using InfinityGrove.Backend.Domain.Purchases;
using Microsoft.EntityFrameworkCore;

namespace InfinityGrove.Backend.Infrastructure.Persistence;

public class InfinityGroveDbContext(DbContextOptions<InfinityGroveDbContext> options) : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<PlayerProgress> PlayerProgresses => Set<PlayerProgress>();
    public DbSet<PlayerEvent> PlayerEvents => Set<PlayerEvent>();
    public DbSet<CardInstance> CardInstances => Set<CardInstance>();
    public DbSet<SteamInventoryOutboxEntry> SteamInventoryOutboxEntries => Set<SteamInventoryOutboxEntry>();
    public DbSet<SummoningStonePurchase> SummoningStonePurchases => Set<SummoningStonePurchase>();
    public DbSet<MarketPriceSnapshot> MarketPriceSnapshots => Set<MarketPriceSnapshot>();
    public DbSet<MarketAbuseFlag> MarketAbuseFlags => Set<MarketAbuseFlag>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(InfinityGroveDbContext).Assembly);
    }
}
