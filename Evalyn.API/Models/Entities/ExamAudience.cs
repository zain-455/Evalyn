namespace Evalyn.API.Models.Entities;

public class ExamAudience
{
    public int Id { get; set; }
    public int ExamId { get; set; }
    
    // For SECTION or MULTI_SECTION audience types
    public string? Section { get; set; }
    
    // For INDIVIDUAL audience type
    public string? StudentId { get; set; }

    // Navigation
    public Exam Exam { get; set; } = null!;
    public ApplicationUser? Student { get; set; }
}
