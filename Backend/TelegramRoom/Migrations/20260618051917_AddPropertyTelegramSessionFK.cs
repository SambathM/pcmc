using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TelegramRoom.Migrations
{
    /// <inheritdoc />
    public partial class AddPropertyTelegramSessionFK : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AssignedTelegramAccount",
                table: "PcmcProperties");

            migrationBuilder.AddColumn<long>(
                name: "AssignedTelegramSessionId",
                table: "PcmcProperties",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PcmcProperties_AssignedTelegramSessionId",
                table: "PcmcProperties",
                column: "AssignedTelegramSessionId");

            migrationBuilder.AddForeignKey(
                name: "FK_PcmcProperties_TelegramSessions_AssignedTelegramSessionId",
                table: "PcmcProperties",
                column: "AssignedTelegramSessionId",
                principalTable: "TelegramSessions",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PcmcProperties_TelegramSessions_AssignedTelegramSessionId",
                table: "PcmcProperties");

            migrationBuilder.DropIndex(
                name: "IX_PcmcProperties_AssignedTelegramSessionId",
                table: "PcmcProperties");

            migrationBuilder.DropColumn(
                name: "AssignedTelegramSessionId",
                table: "PcmcProperties");

            migrationBuilder.AddColumn<string>(
                name: "AssignedTelegramAccount",
                table: "PcmcProperties",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }
    }
}
