namespace Evalyn.API.Models.Entities;

public class QuestionDomainTag
{
    public int Id { get; set; }
    public int QuestionId { get; set; }
    public string DomainName { get; set; } = string.Empty;    // e.g., "Data Structures"
    public string SubDomain { get; set; } = string.Empty;     // e.g., "Binary Trees"

    // Navigation
    public Question Question { get; set; } = null!;
}
