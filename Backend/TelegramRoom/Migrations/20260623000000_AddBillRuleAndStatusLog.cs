using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TelegramRoom.Migrations
{
    /// <inheritdoc />
    public partial class AddBillRuleAndStatusLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── PcmcBillRules — global threshold configuration ────────────────────
            migrationBuilder.CreateTable(
                name: "PcmcBillRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PreparingDays = table.Column<int>(type: "integer", nullable: false, defaultValue: 5),
                    OverdueDays   = table.Column<int>(type: "integer", nullable: false, defaultValue: 7),
                    UpdatedOn     = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PcmcBillRules", x => x.Id);
                });

            // Seed the default global rule.
            migrationBuilder.InsertData(
                table: "PcmcBillRules",
                columns: new[] { "Id", "PreparingDays", "OverdueDays", "UpdatedOn" },
                values: new object[] { 1, 5, 7, new DateTime(2026, 6, 23, 0, 0, 0, DateTimeKind.Utc) });

            // ── PcmcBillStatusLogs — one-to-many with PcmcBills ──────────────────
            migrationBuilder.CreateTable(
                name: "PcmcBillStatusLogs",
                columns: table => new
                {
                    Id            = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BillId        = table.Column<int>(type: "integer", nullable: false),
                    StatusName    = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OperationDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Outcome       = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Success"),
                    Reason        = table.Column<string>(type: "text", nullable: true),
                    CreatedOn     = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
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

            migrationBuilder.CreateIndex(
                name: "IX_PcmcBillStatusLogs_BillId",
                table: "PcmcBillStatusLogs",
                column: "BillId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "PcmcBillStatusLogs");
            migrationBuilder.DropTable(name: "PcmcBillRules");
        }
    }
}
