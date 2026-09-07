using InfinityGrove.Backend.Domain.Cards;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InfinityGrove.Backend.Infrastructure.Persistence.Configurations;

public class CardInstanceConfiguration : IEntityTypeConfiguration<CardInstance>
{
    public void Configure(EntityTypeBuilder<CardInstance> builder)
    {
        builder.ToTable("card_instances");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(c => c.AccountId)
            .HasColumnName("account_id")
            .IsRequired();

        builder.Property(c => c.HeroDefinitionId)
            .HasColumnName("hero_definition_id")
            .IsRequired();

        builder.Property(c => c.State)
            .HasColumnName("state")
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(c => c.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(c => c.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        // FR-33: Postgres's native row-version (the system xmin column) as the
        // optimistic concurrency token, so two requests racing to transition the
        // same instance (e.g. a fusion and a "prepare to list" call) can never
        // both win — one commits, the other gets DbUpdateConcurrencyException.
        builder.Property<uint>("xmin").IsRowVersion();

        // Fusion's "N oldest Owned duplicates of this hero" query (AD-8), and any
        // future per-hero owned/fusable-count UI.
        builder.HasIndex(c => new { c.AccountId, c.HeroDefinitionId, c.State });
    }
}
