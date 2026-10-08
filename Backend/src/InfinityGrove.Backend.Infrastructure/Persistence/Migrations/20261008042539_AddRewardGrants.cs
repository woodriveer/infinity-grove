using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InfinityGrove.Backend.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRewardGrants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "reward_grants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_client_event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    hero_definition_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_new_hero = table.Column<bool>(type: "boolean", nullable: true),
                    item_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    affix_rolls_json = table.Column<string>(type: "jsonb", nullable: true),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reward_grants", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_reward_grants_account_id_source_client_event_id",
                table: "reward_grants",
                columns: new[] { "account_id", "source_client_event_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reward_grants");
        }
    }
}
