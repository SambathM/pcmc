using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TelegramRoom.Migrations
{
    /// <inheritdoc />
    public partial class LinkCustomerToTelegramSessionContact : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "TelegramSessionContactId",
                table: "PcmcCustomers",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PcmcCustomers_TelegramSessionContactId",
                table: "PcmcCustomers",
                column: "TelegramSessionContactId");

            migrationBuilder.AddForeignKey(
                name: "FK_PcmcCustomers_TelegramSessionContacts_TelegramSessionContac~",
                table: "PcmcCustomers",
                column: "TelegramSessionContactId",
                principalTable: "TelegramSessionContacts",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PcmcCustomers_TelegramSessionContacts_TelegramSessionContac~",
                table: "PcmcCustomers");

            migrationBuilder.DropIndex(
                name: "IX_PcmcCustomers_TelegramSessionContactId",
                table: "PcmcCustomers");

            migrationBuilder.DropColumn(
                name: "TelegramSessionContactId",
                table: "PcmcCustomers");
        }
    }
}
