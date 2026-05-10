namespace Evalyn.API.Models.Entities;

public class Response
{
    public int Id { get; set; }
    public int TestSessionId { get; set; }
    public int QuestionId { get; set; }
    public int? SelectedOptionId { get; set; }
    public bool IsCorrect { get; set; } = false;
    public double ThetaAtTime { get; set; } = 0.0;  // θ estimate when this question was answered
    public int TimeTakenMs { get; set; } = 0;        // Time spent on this question in milliseconds
    public int QuestionOrder { get; set; } = 0;      // Order in which question was presented
    public DateTime AnsweredAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public TestSession TestSession { get; set; } = null!;
    public Question Question { get; set; } = null!;
    public QuestionOption? SelectedOption { get; set; }
}
