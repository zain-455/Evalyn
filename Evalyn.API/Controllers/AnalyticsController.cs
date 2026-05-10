using Evalyn.API.Constants;
using Evalyn.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Evalyn.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AnalyticsController : ControllerBase
{
    private readonly PsychometricService _psychometrics;
    public AnalyticsController(PsychometricService psychometrics)
        => _psychometrics = psychometrics;

    /// <summary>GET /api/analytics/exam/{examId} — full exam analytics for instructor</summary>
    [HttpGet("exam/{examId}")]
    [Authorize(Roles = Roles.InstructorOrAdmin)]
    public async Task<IActionResult> GetExamAnalytics(int examId)
    {
        var result = await _psychometrics.GetExamAnalyticsAsync(examId);
        if (result == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Exam not found.");
        return Ok(result);
    }

    /// <summary>GET /api/analytics/instructor-dashboard — quick metrics for instructor dashboard</summary>
    [HttpGet("instructor-dashboard")]
    [Authorize(Roles = Roles.InstructorOrAdmin)]
    public async Task<IActionResult> GetInstructorDashboard()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var result = await _psychometrics.GetInstructorDashboardAsync(userId);
        return Ok(result);
    }

    /// <summary>GET /api/analytics/platform — admin platform overview</summary>
    [HttpGet("platform")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> GetPlatformOverview()
    {
        var result = await _psychometrics.GetPlatformOverviewAsync();
        return Ok(result);
    }

    /// <summary>GET /api/analytics/student-profile — profile analytics for student performance page</summary>
    [HttpGet("student-profile")]
    [Authorize(Roles = Roles.Student)]
    public async Task<IActionResult> GetStudentProfile()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var result = await _psychometrics.GetStudentProfileAsync(userId);
        return Ok(result);
    }
}