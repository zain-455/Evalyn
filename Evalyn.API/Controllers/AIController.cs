using Evalyn.API.Models.DTOs;
using Evalyn.API.Services;
using Evalyn.API.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Evalyn.API.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize(Roles = Roles.InstructorOrAdmin)]
public class AIController : ControllerBase
{
    private readonly IQuestionGenerationService _generator;

    public AIController(IQuestionGenerationService generator)
    {
        _generator = generator;
    }

    /// <summary>
    /// POST /api/ai/generate-questions
    /// Body: { "topic": "Newton's Laws", "difficulty": "medium", "count": 5 }
    /// </summary>
    [HttpPost("generate-questions")]
    public async Task<ActionResult<List<GeneratedQuestionResponse>>> GenerateQuestions(
        [FromBody] GenerateQuestionsRequest request,
        CancellationToken cancellationToken)
    {
        var results = await _generator.GenerateQuestionsAsync(request, cancellationToken);
        return Ok(results);
    }
}
