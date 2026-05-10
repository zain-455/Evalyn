namespace Evalyn.API.Models.Entities;

public class QuestionOption
{
    public int Id { get; set; }
    public int QuestionId { get; set; }
    public string OptionText { get; set; } = string.Empty;
    public bool IsCorrect { get; set; } = false;
    public int SelectionCount { get; set; } = 0; // For distractor analysis

    // Navigation
    public Question Question { get; set; } = null!;
}
