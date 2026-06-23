using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TelegramRoom.Migrations
{
    /// <inheritdoc />
    public partial class BillDropDenormalizedFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Add the new service FK column.
            migrationBuilder.AddColumn<int>(
                name: "ServiceId",
                table: "PcmcBills",
                type: "integer",
                nullable: true);

            // 2. Backfill the relations from the denormalized text columns BEFORE
            //    dropping them. CustomerId/UnitId already exist; only fill gaps.
            migrationBuilder.Sql(@"
                UPDATE ""PcmcBills"" b
                SET ""CustomerId"" = c.""Id""
                FROM ""PcmcCustomers"" c
                WHERE b.""CustomerId"" IS NULL
                  AND lower(c.""Code"") = lower(b.""ResidentCode"");");

            migrationBuilder.Sql(@"
                UPDATE ""PcmcBills"" b
                SET ""ServiceId"" = s.""Id""
                FROM ""PcmcServices"" s
                WHERE b.""Service"" IS NOT NULL
                  AND lower(s.""Name"") = lower(b.""Service"");");

            migrationBuilder.Sql(@"
                UPDATE ""PcmcBills"" b
                SET ""UnitId"" = u.""Id""
                FROM ""PcmcUnits"" u
                WHERE b.""UnitId"" IS NULL
                  AND b.""Unit"" IS NOT NULL
                  AND lower(u.""Code"") = lower(b.""Unit"");");

            // 3. Drop the now-redundant denormalized columns.
            migrationBuilder.DropColumn(name: "ResidentCode", table: "PcmcBills");
            migrationBuilder.DropColumn(name: "ResidentName", table: "PcmcBills");
            migrationBuilder.DropColumn(name: "Service", table: "PcmcBills");
            migrationBuilder.DropColumn(name: "Unit", table: "PcmcBills");

            // 4. Index + FK for the new service relation.
            migrationBuilder.CreateIndex(
                name: "IX_PcmcBills_ServiceId",
                table: "PcmcBills",
                column: "ServiceId");

            migrationBuilder.AddForeignKey(
                name: "FK_PcmcBills_PcmcServices_ServiceId",
                table: "PcmcBills",
                column: "ServiceId",
                principalTable: "PcmcServices",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // 1. Re-add the denormalized text columns.
            migrationBuilder.AddColumn<string>(
                name: "ResidentCode",
                table: "PcmcBills",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ResidentName",
                table: "PcmcBills",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Service",
                table: "PcmcBills",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Unit",
                table: "PcmcBills",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            // 2. Restore the denormalized text from the relations (ServiceId still present).
            migrationBuilder.Sql(@"
                UPDATE ""PcmcBills"" b
                SET ""ResidentCode"" = COALESCE(c.""Code"", ''),
                    ""ResidentName"" = COALESCE(c.""Name"", '')
                FROM ""PcmcCustomers"" c
                WHERE b.""CustomerId"" = c.""Id"";");

            migrationBuilder.Sql(@"
                UPDATE ""PcmcBills"" b
                SET ""Service"" = s.""Name""
                FROM ""PcmcServices"" s
                WHERE b.""ServiceId"" = s.""Id"";");

            migrationBuilder.Sql(@"
                UPDATE ""PcmcBills"" b
                SET ""Unit"" = u.""Code""
                FROM ""PcmcUnits"" u
                WHERE b.""UnitId"" = u.""Id"";");

            // 3. Drop the service FK relation.
            migrationBuilder.DropForeignKey(
                name: "FK_PcmcBills_PcmcServices_ServiceId",
                table: "PcmcBills");

            migrationBuilder.DropIndex(
                name: "IX_PcmcBills_ServiceId",
                table: "PcmcBills");

            migrationBuilder.DropColumn(
                name: "ServiceId",
                table: "PcmcBills");
        }
    }
}
