using InfinityGrove.Backend.Domain.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InfinityGrove.Backend.Infrastructure.Persistence.Configurations;

public class PlayerEventConfiguration : IEntityTypeConfiguration<PlayerEvent>
{
    public void Configure(EntityTypeBuilder<PlayerEvent> builder)
    {
        builder.ToTable("player_events");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("id");

        builder.Property(e => e.AccountId)
            .HasColumnName("account_id")
            .IsRequired();

        builder.Property(e => e.ClientEventId)
            .HasColumnName("client_event_id")
            .IsRequired();

        builder.Property(e => e.SequenceNumber)
            .HasColumnName("sequence_number")
            .IsRequired();

        builder.Property(e => e.Type)
            .HasColumnName("type")
            .HasConversion<string>()
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(e => e.PayloadJson)
            .HasColumnName("payload_json")
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(e => e.OccurredAtUtc)
            .HasColumnName("occurred_at_utc")
            .IsRequired();

        builder.Property(e => e.ReceivedAtUtc)
            .HasColumnName("received_at_utc")
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(e => e.RejectionReason)
            .HasColumnName("rejection_reason")
            .HasMaxLength(1024);

        // Idempotency (AD-6): the same client event, resent after a dropped response,
        // must never be replayed twice.
        builder.HasIndex(e => new { e.AccountId, e.ClientEventId })
            .IsUnique();

        // Replay/audit ordering per account.
        builder.HasIndex(e => new { e.AccountId, e.SequenceNumber });
    }
}
