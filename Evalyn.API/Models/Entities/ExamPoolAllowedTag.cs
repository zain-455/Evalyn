namespace Evalyn.API.Models.Entities;

public class ExamPoolAllowedTag
{
    public int Id { get; set; }
    public int ExamId { get; set; }

    public string DomainName { get; set; } = string.Empty;
    public string SubDomain { get; set; } = string.Empty;

    public ExamPoolSettings PoolSettings { get; set; } = null!;
}
