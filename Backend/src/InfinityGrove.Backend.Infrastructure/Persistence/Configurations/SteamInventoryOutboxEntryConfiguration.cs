using InfinityGrove.Backend.Domain.Cards;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InfinityGrove.Backend.Infrastructure.Persistence.Configurations;

public class SteamInventoryOutboxEntryConfiguration : IEntityTypeConfiguration<SteamInventoryOutboxEntry>
{
    public void Configure(EntityTypeBuilder<SteamInventoryOutboxEntry> builder)
    {
        builder.ToTable("steam_inventory_outbox");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.AccountId)
            .HasColumnName("account_id")
            .IsRequired();

        builder.Property(e => e.Operation)
            .HasColumnName("operation")
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        // Same pattern as PlayerProgress's "_activeSquadHeroIds": a small ordered
        // id list mapped straight to the backing field as a Postgres uuid[].
        builder.Property<List<Guid>>("_cardInstanceIds")
            .HasColumnName("card_instance_ids")
            .IsRequired();

        // Only populated for GrantCardInstance entries (AD-12).
        builder.Property(e => e.SteamItemDefId)
            .HasColumnName("steam_item_def_id");

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(e => e.Attempts)
            .HasColumnName("attempts")
            .IsRequired();

        builder.Property(e => e.NextAttemptAtUtc)
            .HasColumnName("next_attempt_at_utc")
            .IsRequired();

        builder.Property(e => e.LastError)
            .HasColumnName("last_error")
            .HasMaxLength(2048);

        builder.Property(e => e.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(e => e.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        // The outbox worker's polling query (AD-8).
        builder.HasIndex(e => new { e.Status, e.NextAttemptAtUtc });
    }
}
