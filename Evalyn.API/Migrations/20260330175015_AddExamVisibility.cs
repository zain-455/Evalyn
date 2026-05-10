using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Evalyn.API.Migrations
{
    /// <inheritdoc />
    public partial class AddExamVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AudienceType",
                table: "Exams",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Section",
                table: "AspNetUsers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "ExamAudiences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ExamId = table.Column<int>(type: "int", nullable: false),
                    Section = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    StudentId = table.Column<string>(type: "nvarchar(450)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExamAudiences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExamAudiences_AspNetUsers_StudentId",
                        column: x => x.StudentId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ExamAudiences_Exams_ExamId",
                        column: x => x.ExamId,
                        principalTable: "Exams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_Section",
                table: "AspNetUsers",
                column: "Section");

            migrationBuilder.CreateIndex(
                name: "IX_ExamAudiences_ExamId",
                table: "ExamAudiences",
                column: "ExamId");

            migrationBuilder.CreateIndex(
                name: "IX_ExamAudiences_Section",
                table: "ExamAudiences",
                column: "Section");

            migrationBuilder.CreateIndex(
                name: "IX_ExamAudiences_StudentId",
                table: "ExamAudiences",
                column: "StudentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExamAudiences");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_Section",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "AudienceType",
                table: "Exams");

            migrationBuilder.DropColumn(
                name: "Section",
                table: "AspNetUsers");
        }
    }
}
