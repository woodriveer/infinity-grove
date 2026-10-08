using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InfinityGrove.Backend.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountSessionId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "session_id",
                table: "accounts",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            // Existing accounts get their own id (gen_random_uuid is built in since PostgreSQL 13).
            migrationBuilder.Sql("UPDATE accounts SET session_id = gen_random_uuid();");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "session_id",
                table: "accounts");
        }
    }
}
