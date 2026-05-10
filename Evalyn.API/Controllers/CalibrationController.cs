using Evalyn.API.Constants;
using Evalyn.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Evalyn.API.Controllers;

/// <summary>
/// API for triggering IRT item parameter calibration.
/// Restricted to Instructors and Admins.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = Roles.InstructorOrAdmin)]
public class CalibrationController : ControllerBase
{
    private readonly CalibrationService _calibration;

    public CalibrationController(CalibrationService calibration)
        => _calibration = calibration;

    /// <summary>
    /// POST /api/calibration/exam/{examId}
    /// Calibrate all eligible questions for a specific exam.
    /// </summary>
    [HttpPost("exam/{examId}")]
    public async Task<IActionResult> CalibrateExam(int examId)
    {
        var result = await _calibration.CalibrateExamAsync(examId);
        return Ok(result);
    }

    /// <summary>
    /// POST /api/calibration/global
    /// Calibrate all eligible questions in the global question bank.
    /// </summary>
    [HttpPost("global")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> CalibrateGlobalBank()
    {
        var result = await _calibration.CalibrateGlobalBankAsync();
        return Ok(result);
    }

    /// <summary>
    /// POST /api/calibration/question/{questionId}
    /// Calibrate a single question by ID.
    /// </summary>
    [HttpPost("question/{questionId}")]
    public async Task<IActionResult> CalibrateQuestion(int questionId)
    {
        var result = await _calibration.CalibrateQuestionAsync(questionId);
        if (!result.Success)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: result.Message);
        return Ok(result);
    }
}
