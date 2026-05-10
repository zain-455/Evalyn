namespace Evalyn.API.Models.Entities;

public class ExamQuestionPoolItem
{
    public int ExamId { get; set; }
    public int QuestionId { get; set; }
    // Fixed-form (linear) delivery order within an exam. Null = legacy/unspecified.
    public int? FixedFormOrder { get; set; }
    public DateTime AttachedAt { get; set; } = DateTime.UtcNow;

    public Exam Exam { get; set; } = null!;
    public Question Question { get; set; } = null!;
}
