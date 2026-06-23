using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TelegramRoom.Migrations
{
    /// <inheritdoc />
    public partial class AddPcmcReminderConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PcmcReminderConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Offset = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    Template = table.Column<string>(type: "text", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PcmcReminderConfigs", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "PcmcReminderConfigs",
                columns: new[] { "Id", "Name", "Offset", "Enabled", "Template", "SortOrder", "CreatedOn" },
                values: new object[,]
                {
                    {
                        1, "Reminder 1", "-5 Days", true,
                        "Dear [ResidentName],\n\nYour [ServiceName] bill for Unit [UnitNumber] is $[BillAmount].\nDue Date: [DueDate] (In 5 Days)\n\nPlease make payment.\n\nThank you.\n[LocationName] Management",
                        1, new DateTime(2026, 6, 22, 0, 0, 0, DateTimeKind.Utc)
                    },
                    {
                        2, "Reminder 2", "Due Date", true,
                        "Dear [ResidentName],\n\nTODAY is the Due Date for Unit [UnitNumber] [ServiceName] bill: $[BillAmount].\nDue Date: [DueDate]\n\nPlease complete your transfer today to avoid penalties.\n\nThank you.",
                        2, new DateTime(2026, 6, 22, 0, 0, 0, DateTimeKind.Utc)
                    },
                    {
                        3, "Reminder 3", "+3 Days", true,
                        "OVERDUE: Dear [ResidentName],\n\nYour bill of $[BillAmount] for [ServiceName] (Unit [UnitNumber]) is now 3 days overdue.\nOriginal due date was [DueDate].\n\nPlease submit receipt today. Thank you.",
                        3, new DateTime(2026, 6, 22, 0, 0, 0, DateTimeKind.Utc)
                    },
                    {
                        4, "Final Notice", "+7 Days", false,
                        "WARNING: Dear [ResidentName],\n\nUnit [UnitNumber] is now 7 days overdue for [ServiceName] bill of $[BillAmount].\n\nIf payment is not received, we will take subsequent administrative measures.\n\nUK 313 Legal Operations",
                        4, new DateTime(2026, 6, 22, 0, 0, 0, DateTimeKind.Utc)
                    },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "PcmcReminderConfigs");
        }
    }
}
