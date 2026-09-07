using InfinityGrove.Backend.Domain.Market;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InfinityGrove.Backend.Infrastructure.Persistence.Configurations;

public class MarketPriceSnapshotConfiguration : IEntityTypeConfiguration<MarketPriceSnapshot>
{
    public void Configure(EntityTypeBuilder<MarketPriceSnapshot> builder)
    {
        builder.ToTable("market_price_snapshots");

        // One row per hero (AD-13's "last-known price" cache, not a history table).
        builder.HasKey(s => s.HeroDefinitionId);
        builder.Property(s => s.HeroDefinitionId)
            .HasColumnName("hero_definition_id")
            .ValueGeneratedNever();

        builder.Property(s => s.Currency)
            .HasColumnName("currency")
            .HasMaxLength(8)
            .IsRequired();

        builder.Property(s => s.LowestPriceDisplay)
            .HasColumnName("lowest_price_display")
            .HasMaxLength(32);

        builder.Property(s => s.MedianPriceDisplay)
            .HasColumnName("median_price_display")
            .HasMaxLength(32);

        builder.Property(s => s.Volume)
            .HasColumnName("volume")
            .HasMaxLength(32);

        builder.Property(s => s.FetchedAtUtc)
            .HasColumnName("fetched_at_utc")
            .IsRequired();
    }
}
