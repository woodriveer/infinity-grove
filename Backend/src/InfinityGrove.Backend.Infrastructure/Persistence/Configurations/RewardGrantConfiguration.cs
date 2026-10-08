using InfinityGrove.Backend.Domain.Rewards;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InfinityGrove.Backend.Infrastructure.Persistence.Configurations;

public class RewardGrantConfiguration : IEntityTypeConfiguration<RewardGrant>
{
    public void Configure(EntityTypeBuilder<RewardGrant> builder)
    {
        builder.ToTable("reward_grants");

        builder.HasKey(g => g.Id);
        builder.Property(g => g.Id).HasColumnName("id").ValueGeneratedNever();

        builder.Property(g => g.AccountId).HasColumnName("account_id").IsRequired();
        builder.Property(g => g.SourceClientEventId).HasColumnName("source_client_event_id").IsRequired();

        builder.Property(g => g.Kind)
            .HasColumnName("kind")
            .HasConversion<string>()
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(g => g.HeroDefinitionId).HasColumnName("hero_definition_id");
        builder.Property(g => g.IsNewHero).HasColumnName("is_new_hero");
        builder.Property(g => g.ItemId).HasColumnName("item_id").HasMaxLength(128);
        builder.Property(g => g.AffixRollsJson).HasColumnName("affix_rolls_json").HasColumnType("jsonb");
        builder.Property(g => g.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();

        builder.HasIndex(g => new { g.AccountId, g.SourceClientEventId });
    }
}
