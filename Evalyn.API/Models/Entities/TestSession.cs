namespace Evalyn.API.Models.Entities;

using Evalyn.API.Constants;

public class TestSession
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public int ExamId { get; set; }

    // IRT Results
    public double ThetaEstimate { get; set; } = 0.0;   // Final ability estimate
    public double ThetaSEM { get; set; } = 1.0;         // Standard Error of Measurement
    public double PercentileRank { get; set; } = 0.0;

    // Integrity
    public double IntegrityScore { get; set; } = 100.0; // 0-100, starts at 100
    public string IntegrityLabel { get; set; } = "High"; // High, Medium, Low
    public double? AnomalyScore { get; set; }            // 0.0-1.0 ML score, null if model unavailable

    // Summary
    public int TotalCorrect { get; set; } = 0;
    public int TotalQuestions { get; set; } = 0;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public string Status { get; set; } = TestSessionStatuses.InProgress; // InProgress, Completed, Abandoned

    // Navigation
    public ApplicationUser User { get; set; } = null!;
    public Exam Exam { get; set; } = null!;
    public ICollection<Response> Responses { get; set; } = new List<Response>();
    public ICollection<BehavioralEvent> BehavioralEvents { get; set; } = new List<BehavioralEvent>();
    public BehavioralFeatureVector? BehavioralFeatureVector { get; set; }
}
