using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Evalyn.API.Migrations
{
    /// <inheritdoc />
    public partial class AddExamPoolConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExamPoolSettings",
                columns: table => new
                {
                    ExamId = table.Column<int>(type: "int", nullable: false),
                    AllowAIGenerated = table.Column<bool>(type: "bit", nullable: false),
                    RequireCalibrated = table.Column<bool>(type: "bit", nullable: false),
                    MinDifficulty = table.Column<double>(type: "float", nullable: false),
                    MaxDifficulty = table.Column<double>(type: "float", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExamPoolSettings", x => x.ExamId);
                    table.ForeignKey(
                        name: "FK_ExamPoolSettings_Exams_ExamId",
                        column: x => x.ExamId,
                        principalTable: "Exams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ExamQuestionPoolItems",
                columns: table => new
                {
                    ExamId = table.Column<int>(type: "int", nullable: false),
                    QuestionId = table.Column<int>(type: "int", nullable: false),
                    AttachedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExamQuestionPoolItems", x => new { x.ExamId, x.QuestionId });
                    table.ForeignKey(
                        name: "FK_ExamQuestionPoolItems_Exams_ExamId",
                        column: x => x.ExamId,
                        principalTable: "Exams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExamQuestionPoolItems_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "Questions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExamPoolAllowedTags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ExamId = table.Column<int>(type: "int", nullable: false),
                    DomainName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SubDomain = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExamPoolAllowedTags", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExamPoolAllowedTags_ExamPoolSettings_ExamId",
                        column: x => x.ExamId,
                        principalTable: "ExamPoolSettings",
                        principalColumn: "ExamId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExamPoolAllowedTags_ExamId_DomainName_SubDomain",
                table: "ExamPoolAllowedTags",
                columns: new[] { "ExamId", "DomainName", "SubDomain" });

            migrationBuilder.CreateIndex(
                name: "IX_ExamQuestionPoolItems_ExamId",
                table: "ExamQuestionPoolItems",
                column: "ExamId");

            migrationBuilder.CreateIndex(
                name: "IX_ExamQuestionPoolItems_QuestionId",
                table: "ExamQuestionPoolItems",
                column: "QuestionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExamPoolAllowedTags");

            migrationBuilder.DropTable(
                name: "ExamQuestionPoolItems");

            migrationBuilder.DropTable(
                name: "ExamPoolSettings");
        }
    }
}
