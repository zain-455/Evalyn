using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Evalyn.API.Migrations
{
    /// <inheritdoc />
    public partial class AddExamScheduleWindow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EndsAtUtc",
                table: "Exams",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartsAtUtc",
                table: "Exams",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndsAtUtc",
                table: "Exams");

            migrationBuilder.DropColumn(
                name: "StartsAtUtc",
                table: "Exams");
        }
    }
}
