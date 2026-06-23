using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TelegramRoom.Migrations
{
    /// <inheritdoc />
    public partial class UtilityConfigsAndStatusLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "SortOrder",
                table: "PcmcReminderConfigs",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<bool>(
                name: "Enabled",
                table: "PcmcReminderConfigs",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedOn",
                table: "PcmcReminderConfigs",
                type: "timestamp without time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.CreateTable(
                name: "PcmcBillStatusLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BillId = table.Column<int>(type: "integer", nullable: false),
                    StatusName = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OperationDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Outcome = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PcmcBillStatusLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PcmcBillStatusLogs_PcmcBills_BillId",
                        column: x => x.BillId,
                        principalTable: "PcmcBills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PcmcUtilityConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Value = table.Column<string>(type: "text", nullable: false),
                    UpdatedOn = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PcmcUtilityConfigs", x => x.Id);
                });

            migrationBuilder.UpdateData(
                table: "PcmcReminderConfigs",
                keyColumn: "Id",
                keyValue: 4,
                column: "Enabled",
                value: false);

            migrationBuilder.InsertData(
                table: "PcmcUtilityConfigs",
                columns: new[] { "Id", "Name", "UpdatedOn", "Value" },
                values: new object[] { 1, "bill_rule", new DateTime(2026, 6, 23, 0, 0, 0, 0, DateTimeKind.Utc), "{\"preparingDays\":5,\"overdueDays\":7}" });

            migrationBuilder.CreateIndex(
                name: "IX_PcmcBillStatusLogs_BillId",
                table: "PcmcBillStatusLogs",
                column: "BillId");

            migrationBuilder.CreateIndex(
                name: "IX_PcmcUtilityConfigs_Name",
                table: "PcmcUtilityConfigs",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PcmcBillStatusLogs");

            migrationBuilder.DropTable(
                name: "PcmcUtilityConfigs");

            migrationBuilder.AlterColumn<int>(
                name: "SortOrder",
                table: "PcmcReminderConfigs",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<bool>(
                name: "Enabled",
                table: "PcmcReminderConfigs",
                type: "boolean",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "boolean");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedOn",
                table: "PcmcReminderConfigs",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp without time zone");

            migrationBuilder.UpdateData(
                table: "PcmcReminderConfigs",
                keyColumn: "Id",
                keyValue: 4,
                column: "Enabled",
                value: true);
        }
    }
}
