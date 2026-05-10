using Evalyn.API.Data;
using Evalyn.API.Constants;
using Evalyn.API.Models.DTOs;
using Evalyn.API.Models.Entities;
using Evalyn.API.Services.Exams;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Evalyn.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ExamsController : ControllerBase
{
    private readonly IExamService _exams;

    public ExamsController(IExamService exams) => _exams = exams;

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private string UserRole => User.FindFirstValue(ClaimTypes.Role)!;

    /// <summary>GET /api/exams — list exams based on role</summary>
    [HttpGet]
    public async Task<IActionResult> GetExams([FromQuery] int? skip = null, [FromQuery] int? take = null)
    {
        return Ok(await _exams.GetExamsForUserAsync(UserId, UserRole, skip, take));
    }

    /// <summary>GET /api/exams/{id} — exam details with questions</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ExamResponse>> GetExam(int id)
    {
        return Ok(await _exams.GetExamAsync(id, UserId, UserRole));
    }

    /// <summary>POST /api/exams — create a new exam (Instructor/Admin only)</summary>
    [HttpPost]
    [Authorize(Roles = Roles.InstructorOrAdmin)]
    public async Task<ActionResult<ExamResponse>> CreateExam([FromBody] CreateExamRequest request)
    {
        var created = await _exams.CreateExamAsync(request, UserId);
        return CreatedAtAction(nameof(GetExam), new { id = created.Id }, created);
    }

    /// <summary>PUT /api/exams/{id}/publish — publish an exam</summary>
    [HttpPut("{id}/publish")]
    [Authorize(Roles = Roles.InstructorOrAdmin)]
    public async Task<IActionResult> PublishExam(int id)
    {
        await _exams.PublishExamAsync(id, UserId, UserRole);
        return Ok(new { message = "Exam published successfully" });
    }

    /// <summary>DELETE /api/exams/{id} — delete a draft exam</summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = Roles.InstructorOrAdmin)]
    public async Task<IActionResult> DeleteExam(int id)
    {
        await _exams.DeleteExamAsync(id, UserId, UserRole);
        return NoContent();
    }
}
