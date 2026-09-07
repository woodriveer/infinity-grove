using InfinityGrove.Backend.Domain.Progress;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InfinityGrove.Backend.Infrastructure.Persistence.Configurations;

public class RosterEntryConfiguration : IEntityTypeConfiguration<RosterEntry>
{
    public void Configure(EntityTypeBuilder<RosterEntry> builder)
    {
        builder.ToTable("roster_entries");

        builder.HasKey(r => new { r.AccountId, r.HeroDefinitionId });

        builder.Property(r => r.AccountId)
            .HasColumnName("account_id");

        builder.Property(r => r.HeroDefinitionId)
            .HasColumnName("hero_definition_id");

        builder.Property(r => r.OwnedCount)
            .HasColumnName("owned_count")
            .IsRequired();

        builder.Property(r => r.StarTier)
            .HasColumnName("star_tier")
            .IsRequired();
    }
}
