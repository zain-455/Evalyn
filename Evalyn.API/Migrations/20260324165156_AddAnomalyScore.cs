using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Evalyn.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAnomalyScore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "AnomalyScore",
                table: "TestSessions",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnomalyScore",
                table: "TestSessions");
        }
    }
}
