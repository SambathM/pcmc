using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TelegramRoom.Migrations
{
    /// <inheritdoc />
    public partial class BillUnitFkDropLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PcmcBills_PcmcProperties_LocationId",
                table: "PcmcBills");

            migrationBuilder.DropIndex(
                name: "IX_PcmcBills_LocationId",
                table: "PcmcBills");

            migrationBuilder.DropColumn(
                name: "LocationId",
                table: "PcmcBills");

            migrationBuilder.AddColumn<int>(
                name: "UnitId",
                table: "PcmcBills",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PcmcBills_UnitId",
                table: "PcmcBills",
                column: "UnitId");

            migrationBuilder.AddForeignKey(
                name: "FK_PcmcBills_PcmcUnits_UnitId",
                table: "PcmcBills",
                column: "UnitId",
                principalTable: "PcmcUnits",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PcmcBills_PcmcUnits_UnitId",
                table: "PcmcBills");

            migrationBuilder.DropIndex(
                name: "IX_PcmcBills_UnitId",
                table: "PcmcBills");

            migrationBuilder.DropColumn(
                name: "UnitId",
                table: "PcmcBills");

            migrationBuilder.AddColumn<int>(
                name: "LocationId",
                table: "PcmcBills",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_PcmcBills_LocationId",
                table: "PcmcBills",
                column: "LocationId");

            migrationBuilder.AddForeignKey(
                name: "FK_PcmcBills_PcmcProperties_LocationId",
                table: "PcmcBills",
                column: "LocationId",
                principalTable: "PcmcProperties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
