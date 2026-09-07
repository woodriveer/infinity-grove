using InfinityGrove.Backend.Domain.Purchases;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InfinityGrove.Backend.Infrastructure.Persistence.Configurations;

public class SummoningStonePurchaseConfiguration : IEntityTypeConfiguration<SummoningStonePurchase>
{
    public void Configure(EntityTypeBuilder<SummoningStonePurchase> builder)
    {
        builder.ToTable("summoning_stone_purchases");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(p => p.AccountId)
            .HasColumnName("account_id")
            .IsRequired();

        builder.Property(p => p.HeroDefinitionId)
            .HasColumnName("hero_definition_id")
            .IsRequired();

        builder.Property(p => p.SteamOrderId)
            .HasColumnName("steam_order_id")
            .IsRequired();

        builder.Property(p => p.SteamTransactionId)
            .HasColumnName("steam_transaction_id")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(p => p.PriceAmountMinorUnits)
            .HasColumnName("price_amount_minor_units")
            .IsRequired();

        builder.Property(p => p.Currency)
            .HasColumnName("currency")
            .HasMaxLength(8)
            .IsRequired();

        builder.Property(p => p.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(p => p.GrantedCardInstanceId)
            .HasColumnName("granted_card_instance_id");

        builder.Property(p => p.OutboxEntryId)
            .HasColumnName("outbox_entry_id");

        builder.Property(p => p.FailureReason)
            .HasColumnName("failure_reason")
            .HasMaxLength(2048);

        builder.Property(p => p.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(p => p.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        // The Steamworks order id is our own correlation key back from Steam's
        // authorization callback (AD-12) — must be globally unique.
        builder.HasIndex(p => p.SteamOrderId).IsUnique();

        builder.HasIndex(p => p.AccountId);
    }
}
