using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TelegramRoom.Migrations
{
    /// <inheritdoc />
    public partial class CustomerLocationBridge : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Create the bridge table first.
            migrationBuilder.CreateTable(
                name: "PcmcCustomerLocations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CustomerId = table.Column<int>(type: "integer", nullable: false),
                    LocationId = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PcmcCustomerLocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PcmcCustomerLocations_PcmcCustomers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "PcmcCustomers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PcmcCustomerLocations_PcmcProperties_LocationId",
                        column: x => x.LocationId,
                        principalTable: "PcmcProperties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PcmcCustomerLocations_CustomerId",
                table: "PcmcCustomerLocations",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_PcmcCustomerLocations_LocationId",
                table: "PcmcCustomerLocations",
                column: "LocationId");

            // 2) Migrate existing one-to-one links into the bridge.
            migrationBuilder.Sql(@"
                INSERT INTO ""PcmcCustomerLocations"" (""CustomerId"", ""LocationId"", ""IsActive"", ""CreatedOn"")
                SELECT ""Id"", ""LocationId"", TRUE, (now() AT TIME ZONE 'UTC')
                FROM ""PcmcCustomers""
                WHERE ""LocationId"" IS NOT NULL;");

            // 3) Drop the now-redundant column.
            migrationBuilder.DropForeignKey(
                name: "FK_PcmcCustomers_PcmcProperties_LocationId",
                table: "PcmcCustomers");

            migrationBuilder.DropIndex(
                name: "IX_PcmcCustomers_LocationId",
                table: "PcmcCustomers");

            migrationBuilder.DropColumn(
                name: "LocationId",
                table: "PcmcCustomers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PcmcCustomerLocations");

            migrationBuilder.AddColumn<int>(
                name: "LocationId",
                table: "PcmcCustomers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_PcmcCustomers_LocationId",
                table: "PcmcCustomers",
                column: "LocationId");

            migrationBuilder.AddForeignKey(
                name: "FK_PcmcCustomers_PcmcProperties_LocationId",
                table: "PcmcCustomers",
                column: "LocationId",
                principalTable: "PcmcProperties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
