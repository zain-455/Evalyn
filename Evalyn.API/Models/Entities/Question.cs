namespace Evalyn.API.Models.Entities;

public class Question
{
    public int Id { get; set; }
    public int? ExamId { get; set; }
    // Fixed-form (linear) delivery order within an exam. Null = legacy/unspecified.
    public int? FixedFormOrder { get; set; }
    // Ownership: used for global question bank items (ExamId == null). Null means legacy/system global.
    public string? CreatedById { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string QuestionType { get; set; } = "MCQ"; // MCQ, TrueFalse

    // Source tracking
    public bool IsAIGenerated { get; set; } = false;

    // IRT Parameters
    public double IRT_Difficulty { get; set; } = 0.0;       // b parameter (-4 to +4)
    public double IRT_Discrimination { get; set; } = 1.0;   // a parameter (0.2 to 3.0), default 1.0 for 1PL
    public double IRT_Guessing { get; set; } = 0.0;         // c parameter (for 3PL, unused in 1PL/2PL)
    public string DifficultyLabel { get; set; } = "Medium";  // Easy, Medium, Hard (human-readable)

    // Calibration tracking
    public int TimesAdministered { get; set; } = 0;
    public int TimesCorrect { get; set; } = 0;
    public bool IsCalibrated { get; set; } = false; // true once calibrated from real data

    // Navigation
    public Exam? Exam { get; set; }
    public ICollection<QuestionOption> Options { get; set; } = new List<QuestionOption>();
    public ICollection<QuestionDomainTag> DomainTags { get; set; } = new List<QuestionDomainTag>();
    public ICollection<Response> Responses { get; set; } = new List<Response>();
}
