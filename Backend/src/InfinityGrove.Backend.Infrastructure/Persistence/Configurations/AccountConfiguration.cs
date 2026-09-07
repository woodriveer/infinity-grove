using InfinityGrove.Backend.Domain.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InfinityGrove.Backend.Infrastructure.Persistence.Configurations;

public class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("accounts");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id)
            .HasColumnName("id");

        builder.Property(a => a.SteamId64)
            .HasColumnName("steam_id64")
            .HasMaxLength(32)
            .IsRequired();

        builder.HasIndex(a => a.SteamId64)
            .IsUnique();

        builder.Property(a => a.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(a => a.LastLoginAtUtc)
            .HasColumnName("last_login_at_utc")
            .IsRequired();
    }
}
