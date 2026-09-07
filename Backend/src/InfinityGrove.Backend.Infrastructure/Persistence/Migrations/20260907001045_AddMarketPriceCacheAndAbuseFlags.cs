using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InfinityGrove.Backend.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMarketPriceCacheAndAbuseFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "market_abuse_flags",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    signal_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    observed_event_count = table.Column<int>(type: "integer", nullable: false),
                    threshold_event_count = table.Column<int>(type: "integer", nullable: false),
                    window_start_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    window_end_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    detected_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_market_abuse_flags", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "market_price_snapshots",
                columns: table => new
                {
                    hero_definition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    lowest_price_display = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    median_price_display = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    volume = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    fetched_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_market_price_snapshots", x => x.hero_definition_id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_market_abuse_flags_account_id_signal_type_detected_at_utc",
                table: "market_abuse_flags",
                columns: new[] { "account_id", "signal_type", "detected_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "market_abuse_flags");

            migrationBuilder.DropTable(
                name: "market_price_snapshots");
        }
    }
}
