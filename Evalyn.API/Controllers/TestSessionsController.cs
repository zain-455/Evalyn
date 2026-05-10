using Evalyn.API.Constants;
using Evalyn.API.Models.DTOs;
using Evalyn.API.Services.Exams;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Evalyn.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TestSessionsController : ControllerBase
{
    private readonly ITestSessionService _sessions;

    public TestSessionsController(ITestSessionService sessions) => _sessions = sessions;

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private string UserRole => User.FindFirstValue(ClaimTypes.Role)!;

    /// <summary>POST /api/testsessions/start/{examId} — start a test session</summary>
    [HttpPost("start/{examId}")]
    [Authorize(Roles = Roles.Student)]
    public async Task<ActionResult<StartExamResponse>> StartExam(int examId)
    {
        return Ok(await _sessions.StartSessionAsync(examId, UserId));
    }

    /// <summary>POST /api/testsessions/{sessionId}/answer — submit answer and get next question</summary>
    [HttpPost("{sessionId}/answer")]
    [Authorize(Roles = Roles.Student)]
    public async Task<ActionResult<SubmitAnswerResponse>> SubmitAnswer(int sessionId, [FromBody] SubmitAnswerRequest request)
    {
        return Ok(await _sessions.SubmitAnswerAsync(sessionId, UserId, request));
    }

    /// <summary>POST /api/testsessions/{sessionId}/events — log behavioral event</summary>
    [HttpPost("{sessionId}/events")]
    [Authorize(Roles = Roles.Student)]
    public async Task<IActionResult> LogEvent(int sessionId, [FromBody] BehavioralEventRequest request)
    {
        await _sessions.LogEventAsync(sessionId, UserId, request);
        return Ok();
    }

    /// <summary>POST /api/testsessions/{sessionId}/events/batch — log multiple behavioral events</summary>
    [HttpPost("{sessionId}/events/batch")]
    [Authorize(Roles = Roles.Student)]
    public async Task<IActionResult> LogEventsBatch(int sessionId, [FromBody] List<BehavioralEventRequest> events)
    {
        await _sessions.LogEventsBatchAsync(sessionId, UserId, events);
        return Ok();
    }

    /// <summary>GET /api/testsessions/{sessionId}/result — get test result with analysis</summary>
    [HttpGet("{sessionId}/result")]
    public async Task<ActionResult<TestResultResponse>> GetResult(int sessionId)
    {
        return Ok(await _sessions.GetResultAsync(sessionId, UserId, UserRole));
    }

    /// <summary>GET /api/testsessions/my — student's test history</summary>
    [HttpGet("my")]
    [Authorize(Roles = Roles.Student)]
    public async Task<IActionResult> GetMyHistory()
    {
        return Ok(await _sessions.GetMyHistoryAsync(UserId));
    }
}
