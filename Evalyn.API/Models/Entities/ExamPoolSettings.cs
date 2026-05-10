namespace Evalyn.API.Models.Entities;

public class ExamPoolSettings
{
    public int ExamId { get; set; }

    public bool AllowAIGenerated { get; set; } = true;
    public bool RequireCalibrated { get; set; } = false;

    // IRT difficulty range constraint
    public double MinDifficulty { get; set; } = -4.0;
    public double MaxDifficulty { get; set; } = 4.0;

    public Exam Exam { get; set; } = null!;
    public ICollection<ExamPoolAllowedTag> AllowedTags { get; set; } = new List<ExamPoolAllowedTag>();
}
