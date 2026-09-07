using InfinityGrove.Backend.Domain.MarketAbuse;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InfinityGrove.Backend.Infrastructure.Persistence.Configurations;

public class MarketAbuseFlagConfiguration : IEntityTypeConfiguration<MarketAbuseFlag>
{
    public void Configure(EntityTypeBuilder<MarketAbuseFlag> builder)
    {
        builder.ToTable("market_abuse_flags");

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(f => f.AccountId)
            .HasColumnName("account_id")
            .IsRequired();

        builder.Property(f => f.SignalType)
            .HasColumnName("signal_type")
            .HasConversion<string>()
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(f => f.ObservedEventCount)
            .HasColumnName("observed_event_count")
            .IsRequired();

        builder.Property(f => f.ThresholdEventCount)
            .HasColumnName("threshold_event_count")
            .IsRequired();

        builder.Property(f => f.WindowStartUtc)
            .HasColumnName("window_start_utc")
            .IsRequired();

        builder.Property(f => f.WindowEndUtc)
            .HasColumnName("window_end_utc")
            .IsRequired();

        builder.Property(f => f.DetectedAtUtc)
            .HasColumnName("detected_at_utc")
            .IsRequired();

        // The dedup check (ExistsSinceAsync) and any future ops-review query.
        builder.HasIndex(f => new { f.AccountId, f.SignalType, f.DetectedAtUtc });
    }
}
