using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InfinityGrove.Backend.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHighestBossDefeated : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "highest_boss_defeated",
                table: "player_progress",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "highest_boss_defeated",
                table: "player_progress");
        }
    }
}
