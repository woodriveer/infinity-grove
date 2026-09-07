using InfinityGrove.Backend.Domain.Progress;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InfinityGrove.Backend.Infrastructure.Persistence.Configurations;

public class PlayerProgressConfiguration : IEntityTypeConfiguration<PlayerProgress>
{
    public void Configure(EntityTypeBuilder<PlayerProgress> builder)
    {
        builder.ToTable("player_progress");

        builder.HasKey(p => p.AccountId);
        builder.Property(p => p.AccountId)
            .HasColumnName("account_id")
            .ValueGeneratedNever();

        // AD-7: canonical gold as a (mantissa, exponent) pair, not a native numeric column.
        builder.Property(p => p.GoldMantissa)
            .HasColumnName("gold_mantissa")
            .IsRequired();

        builder.Property(p => p.GoldExponent)
            .HasColumnName("gold_exponent")
            .IsRequired();

        builder.Property(p => p.FurthestStageCleared)
            .HasColumnName("furthest_stage_cleared")
            .IsRequired();

        builder.Property(p => p.LastAppliedSequence)
            .HasColumnName("last_applied_sequence")
            .IsRequired();

        builder.Property(p => p.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        // FR-3: the active squad is a small (<=5), ordered id list — a Postgres uuid[]
        // column via Npgsql's array support is a better fit than a child table here.
        // Mapped straight to the backing field (not the public IReadOnlyList property)
        // because EF's primitive-collection mapping requires a mutable CLR list type.
        builder.Property<List<Guid>>("_activeSquadHeroIds")
            .HasColumnName("active_squad_hero_ids")
            .IsRequired();

        builder.HasMany(p => p.Roster)
            .WithOne()
            .HasForeignKey(r => r.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(p => p.Roster)
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
