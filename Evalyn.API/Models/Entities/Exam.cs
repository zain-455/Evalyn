namespace Evalyn.API.Models.Entities;

using Evalyn.API.Constants;

public class Exam
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CreatedById { get; set; } = string.Empty;
    public int DurationMinutes { get; set; } = 60;
    public bool IsAdaptive { get; set; } = true;
    public int MaxQuestions { get; set; } = 30; // Max questions in adaptive mode
    public string Status { get; set; } = ExamStatuses.Draft; // Draft, Published, Archived
    public string AudienceType { get; set; } = "SECTION"; // SECTION, MULTI_SECTION, INDIVIDUAL
    public DateTime? StartsAtUtc { get; set; }
    public DateTime? EndsAtUtc { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ApplicationUser CreatedBy { get; set; } = null!;
    public ICollection<Question> Questions { get; set; } = new List<Question>();
    public ICollection<ExamQuestionPoolItem> QuestionPoolItems { get; set; } = new List<ExamQuestionPoolItem>();
    public ExamPoolSettings? PoolSettings { get; set; }
    public ICollection<ExamAudience> Audiences { get; set; } = new List<ExamAudience>();
    public ICollection<TestSession> TestSessions { get; set; } = new List<TestSession>();
}
