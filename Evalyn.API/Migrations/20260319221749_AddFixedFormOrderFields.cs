using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Evalyn.API.Migrations
{
    /// <inheritdoc />
    public partial class AddFixedFormOrderFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FixedFormOrder",
                table: "Questions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FixedFormOrder",
                table: "ExamQuestionPoolItems",
                type: "int",
                nullable: true);

            // Backfill legacy data with a deterministic fixed-form sequence.
            // - Exam-specific questions: order by Question.Id within each ExamId
            // - Attached bank questions: order by AttachedAt, then QuestionId within each ExamId
            migrationBuilder.Sql(@"
WITH Q AS (
    SELECT Id, ExamId,
           ROW_NUMBER() OVER (PARTITION BY ExamId ORDER BY Id) AS rn
    FROM Questions
    WHERE ExamId IS NOT NULL AND FixedFormOrder IS NULL
)
UPDATE Questions
SET FixedFormOrder = Q.rn
FROM Questions INNER JOIN Q ON Questions.Id = Q.Id;
");

            migrationBuilder.Sql(@"
WITH I AS (
    SELECT ExamId, QuestionId,
           ROW_NUMBER() OVER (PARTITION BY ExamId ORDER BY AttachedAt, QuestionId) AS rn
    FROM ExamQuestionPoolItems
    WHERE FixedFormOrder IS NULL
)
UPDATE ExamQuestionPoolItems
SET FixedFormOrder = I.rn
FROM ExamQuestionPoolItems INNER JOIN I
    ON ExamQuestionPoolItems.ExamId = I.ExamId
   AND ExamQuestionPoolItems.QuestionId = I.QuestionId;
");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_ExamId_FixedFormOrder",
                table: "Questions",
                columns: new[] { "ExamId", "FixedFormOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ExamQuestionPoolItems_ExamId_FixedFormOrder",
                table: "ExamQuestionPoolItems",
                columns: new[] { "ExamId", "FixedFormOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Questions_ExamId_FixedFormOrder",
                table: "Questions");

            migrationBuilder.DropIndex(
                name: "IX_ExamQuestionPoolItems_ExamId_FixedFormOrder",
                table: "ExamQuestionPoolItems");

            migrationBuilder.DropColumn(
                name: "FixedFormOrder",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "FixedFormOrder",
                table: "ExamQuestionPoolItems");
        }
    }
}
