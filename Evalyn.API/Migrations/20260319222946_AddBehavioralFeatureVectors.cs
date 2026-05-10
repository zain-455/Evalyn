using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Evalyn.API.Migrations
{
    /// <inheritdoc />
    public partial class AddBehavioralFeatureVectors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BehavioralFeatureVectors",
                columns: table => new
                {
                    TestSessionId = table.Column<int>(type: "int", nullable: false),
                    TabSwitchesPerMinute = table.Column<double>(type: "float", nullable: false),
                    PasteCount = table.Column<int>(type: "int", nullable: false),
                    RightClickCount = table.Column<int>(type: "int", nullable: false),
                    IdleSeconds = table.Column<double>(type: "float", nullable: false),
                    FocusLostCount = table.Column<int>(type: "int", nullable: false),
                    TimingCv = table.Column<double>(type: "float", nullable: false),
                    MouseAngleEntropy = table.Column<double>(type: "float", nullable: false),
                    ComputedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BehavioralFeatureVectors", x => x.TestSessionId);
                    table.ForeignKey(
                        name: "FK_BehavioralFeatureVectors_TestSessions_TestSessionId",
                        column: x => x.TestSessionId,
                        principalTable: "TestSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BehavioralFeatureVectors_ComputedAt",
                table: "BehavioralFeatureVectors",
                column: "ComputedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BehavioralFeatureVectors");
        }
    }
}
