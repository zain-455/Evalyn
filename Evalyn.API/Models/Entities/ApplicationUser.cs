using Microsoft.AspNetCore.Identity;
using Evalyn.API.Constants;

namespace Evalyn.API.Models.Entities;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = Roles.Student; // Admin, Instructor, Student
    public string Institution { get; set; } = string.Empty;
    public string Identifier { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty; // Added: For exam visibility logic
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Refresh token (hash stored server-side; raw token stored in httpOnly cookie)
    public string? RefreshTokenHash { get; set; }
    public DateTime? RefreshTokenExpiresAt { get; set; }

    // Navigation
    public ICollection<TestSession> TestSessions { get; set; } = new List<TestSession>();
    public ICollection<Exam> CreatedExams { get; set; } = new List<Exam>();
}
