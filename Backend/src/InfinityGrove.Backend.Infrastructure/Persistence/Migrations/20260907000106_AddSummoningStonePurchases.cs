using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InfinityGrove.Backend.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSummoningStonePurchases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "steam_item_def_id",
                table: "steam_inventory_outbox",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "summoning_stone_purchases",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    hero_definition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    steam_order_id = table.Column<long>(type: "bigint", nullable: false),
                    steam_transaction_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    price_amount_minor_units = table.Column<long>(type: "bigint", nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    granted_card_instance_id = table.Column<Guid>(type: "uuid", nullable: true),
                    outbox_entry_id = table.Column<Guid>(type: "uuid", nullable: true),
                    failure_reason = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_summoning_stone_purchases", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_summoning_stone_purchases_account_id",
                table: "summoning_stone_purchases",
                column: "account_id");

            migrationBuilder.CreateIndex(
                name: "IX_summoning_stone_purchases_steam_order_id",
                table: "summoning_stone_purchases",
                column: "steam_order_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "summoning_stone_purchases");

            migrationBuilder.DropColumn(
                name: "steam_item_def_id",
                table: "steam_inventory_outbox");
        }
    }
}
