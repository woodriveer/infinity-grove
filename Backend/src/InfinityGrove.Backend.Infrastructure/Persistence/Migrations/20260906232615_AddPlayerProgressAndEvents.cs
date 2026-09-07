using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InfinityGrove.Backend.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPlayerProgressAndEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "player_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence_number = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    payload_json = table.Column<string>(type: "jsonb", nullable: false),
                    occurred_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    received_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    rejection_reason = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_player_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "player_progress",
                columns: table => new
                {
                    account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    gold_mantissa = table.Column<double>(type: "double precision", nullable: false),
                    gold_exponent = table.Column<int>(type: "integer", nullable: false),
                    furthest_stage_cleared = table.Column<int>(type: "integer", nullable: false),
                    last_applied_sequence = table.Column<long>(type: "bigint", nullable: false),
                    updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    active_squad_hero_ids = table.Column<List<Guid>>(type: "uuid[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_player_progress", x => x.account_id);
                });

            migrationBuilder.CreateTable(
                name: "roster_entries",
                columns: table => new
                {
                    account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    hero_definition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owned_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roster_entries", x => new { x.account_id, x.hero_definition_id });
                    table.ForeignKey(
                        name: "FK_roster_entries_player_progress_account_id",
                        column: x => x.account_id,
                        principalTable: "player_progress",
                        principalColumn: "account_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_player_events_account_id_client_event_id",
                table: "player_events",
                columns: new[] { "account_id", "client_event_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_player_events_account_id_sequence_number",
                table: "player_events",
                columns: new[] { "account_id", "sequence_number" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "player_events");

            migrationBuilder.DropTable(
                name: "roster_entries");

            migrationBuilder.DropTable(
                name: "player_progress");
        }
    }
}
