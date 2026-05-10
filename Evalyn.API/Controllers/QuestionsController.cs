using Evalyn.API.Data;
using Evalyn.API.Constants;
using Evalyn.API.Models.DTOs;
using Evalyn.API.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Evalyn.API.Controllers;

[ApiController]
[Route("api/exams/{examId}/[controller]")]
[Authorize(Roles = Roles.InstructorOrAdmin)]
public class QuestionsController : ControllerBase
{
    private readonly AppDbContext _db;
    public QuestionsController(AppDbContext db) => _db = db;

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    private static (double Difficulty, double Discrimination) SeedIrtFromLabel(string? difficultyLabel)
    {
        return (difficultyLabel ?? "Medium") switch
        {
            "Easy" => (-1.5, 0.9),
            "Hard" => (1.5, 1.1),
            _ => (0.0, 1.0)
        };
    }

    private static (double Difficulty, double Discrimination) GetEffectiveIrt(CreateQuestionRequest request)
    {
        // If instructor/AI provided meaningful values, keep them.
        // Otherwise seed from label so reports aren't flat before calibration.
        var isPlaceholder = Math.Abs(request.IRT_Difficulty) < 1e-9 && Math.Abs(request.IRT_Discrimination - 1.0) < 1e-9;
        return isPlaceholder ? SeedIrtFromLabel(request.DifficultyLabel) : (request.IRT_Difficulty, request.IRT_Discrimination);
    }

    private static (double Difficulty, double Discrimination) GetEffectiveIrt(UpdateQuestionRequest request)
    {
        var isPlaceholder = Math.Abs(request.IRT_Difficulty) < 1e-9 && Math.Abs(request.IRT_Discrimination - 1.0) < 1e-9;
        return isPlaceholder ? SeedIrtFromLabel(request.DifficultyLabel) : (request.IRT_Difficulty, request.IRT_Discrimination);
    }

    /// <summary>GET /api/exams/{examId}/questions</summary>
    [HttpGet]
    public async Task<ActionResult<List<QuestionResponse>>> GetQuestions(int examId)
    {
        var exam = await _db.Exams.FindAsync(examId);
        if (exam == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Exam not found.");

        var baseQuery = _db.Questions
            .Where(q => q.ExamId == examId)
            .Include(q => q.Options)
            .Include(q => q.DomainTags)
            .AsQueryable();

        // For fixed-form exams, list in the linear delivery sequence.
        // For adaptive exams, keep the existing difficulty-based listing.
        var orderedQuery = exam.IsAdaptive
            ? baseQuery.OrderBy(q => q.IRT_Difficulty)
            : baseQuery.OrderBy(q => q.FixedFormOrder ?? int.MaxValue).ThenBy(q => q.Id);

        var questions = await orderedQuery
            .Select(q => new QuestionResponse(
                q.Id, q.QuestionText, q.QuestionType,
                q.IRT_Difficulty, q.IRT_Discrimination, q.DifficultyLabel,
                q.IsCalibrated,
                q.IsAIGenerated,
                q.Options.Select(o => new OptionResponse(o.Id, o.OptionText, o.IsCorrect)).ToList(),
                q.DomainTags.Select(t => new DomainTagResponse(t.Id, t.DomainName, t.SubDomain)).ToList()
            )).ToListAsync();

        return Ok(questions);
    }

    /// <summary>POST /api/exams/{examId}/questions — add a question</summary>
    [HttpPost]
    public async Task<ActionResult<QuestionResponse>> CreateQuestion(int examId, [FromBody] CreateQuestionRequest request)
    {
        var exam = await _db.Exams.FindAsync(examId);
        if (exam == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Exam not found.");
        if (exam.CreatedById != UserId) return Forbid();

        // Validate options (MCQ/TF need 2+, Short need 1+)
        bool needsTwoOptions = request.QuestionType == "MCQ" || request.QuestionType == "True / False";
        if (needsTwoOptions && request.Options.Count < 2)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: $"{request.QuestionType} questions must have at least 2 options.");
        if (!needsTwoOptions && request.Options.Count < 1)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Question must have at least 1 correct answer option.");
        
        if (request.Options.Count(o => o.IsCorrect) != 1)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Exactly one option must be marked as correct.");

        int? nextFixedOrder = await _db.Questions
            .Where(q => q.ExamId == examId && q.FixedFormOrder != null)
            .MaxAsync(q => (int?)q.FixedFormOrder);

        var (difficulty, discrimination) = GetEffectiveIrt(request);

        var question = new Question
        {
            ExamId = examId,
            CreatedById = exam.CreatedById,
            FixedFormOrder = (nextFixedOrder ?? 0) + 1,
            QuestionText = request.QuestionText,
            QuestionType = request.QuestionType,
            IRT_Difficulty = difficulty,
            IRT_Discrimination = discrimination,
            DifficultyLabel = request.DifficultyLabel,
            IsAIGenerated = request.IsAIGenerated
        };

        foreach (var opt in request.Options)
        {
            question.Options.Add(new QuestionOption
            {
                OptionText = opt.OptionText,
                IsCorrect = opt.IsCorrect
            });
        }

        if (request.DomainTags != null)
        {
            foreach (var tag in request.DomainTags)
            {
                question.DomainTags.Add(new QuestionDomainTag
                {
                    DomainName = tag.DomainName,
                    SubDomain = tag.SubDomain
                });
            }
        }

        _db.Questions.Add(question);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetQuestions), new { examId },
            new QuestionResponse(
                question.Id, question.QuestionText, question.QuestionType,
                question.IRT_Difficulty, question.IRT_Discrimination, question.DifficultyLabel,
                question.IsCalibrated,
                question.IsAIGenerated,
                question.Options.Select(o => new OptionResponse(o.Id, o.OptionText, o.IsCorrect)).ToList(),
                question.DomainTags.Select(t => new DomainTagResponse(t.Id, t.DomainName, t.SubDomain)).ToList()
            ));
    }

    /// <summary>PUT /api/exams/{examId}/questions/{id} — update a question</summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<QuestionResponse>> UpdateQuestion(int examId, int id, [FromBody] UpdateQuestionRequest request)
    {
        var exam = await _db.Exams.FindAsync(examId);
        if (exam == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Exam not found.");
        if (exam.CreatedById != UserId) return Forbid();

        var question = await _db.Questions
            .Include(q => q.Options)
            .Include(q => q.DomainTags)
            .FirstOrDefaultAsync(q => q.Id == id && q.ExamId == examId);

        if (question == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Question not found.");

        bool needsTwoOptions = request.QuestionType == "MCQ" || request.QuestionType == "True / False";
        if (needsTwoOptions && request.Options.Count < 2)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: $"{request.QuestionType} questions must have at least 2 options.");
        if (!needsTwoOptions && request.Options.Count < 1)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Question must have at least 1 correct answer option.");
        if (request.Options.Count(o => o.IsCorrect) != 1)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Exactly one option must be marked as correct.");

        question.QuestionText = request.QuestionText;
        question.QuestionType = request.QuestionType;
        if (!question.IsCalibrated)
        {
            var (difficulty, discrimination) = GetEffectiveIrt(request);
            question.IRT_Difficulty = difficulty;
            question.IRT_Discrimination = discrimination;
        }
        else
        {
            // If already calibrated, keep the calibration unless explicitly changed away from placeholder.
            // This prevents accidental overwrites from default UI values.
            var isPlaceholder = Math.Abs(request.IRT_Difficulty) < 1e-9 && Math.Abs(request.IRT_Discrimination - 1.0) < 1e-9;
            if (!isPlaceholder)
            {
                question.IRT_Difficulty = request.IRT_Difficulty;
                question.IRT_Discrimination = request.IRT_Discrimination;
            }
        }
        question.DifficultyLabel = request.DifficultyLabel;
        question.IsAIGenerated = request.IsAIGenerated;

        _db.QuestionOptions.RemoveRange(question.Options);
        question.Options.Clear();
        foreach (var opt in request.Options)
        {
            question.Options.Add(new QuestionOption
            {
                OptionText = opt.OptionText,
                IsCorrect = opt.IsCorrect
            });
        }

        _db.QuestionDomainTags.RemoveRange(question.DomainTags);
        question.DomainTags.Clear();
        if (request.DomainTags != null)
        {
            foreach (var tag in request.DomainTags)
            {
                question.DomainTags.Add(new QuestionDomainTag
                {
                    DomainName = tag.DomainName,
                    SubDomain = tag.SubDomain
                });
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new QuestionResponse(
            question.Id,
            question.QuestionText,
            question.QuestionType,
            question.IRT_Difficulty,
            question.IRT_Discrimination,
            question.DifficultyLabel,
            question.IsCalibrated,
            question.IsAIGenerated,
            question.Options.Select(o => new OptionResponse(o.Id, o.OptionText, o.IsCorrect)).ToList(),
            question.DomainTags.Select(t => new DomainTagResponse(t.Id, t.DomainName, t.SubDomain)).ToList()
        ));
    }

    /// <summary>DELETE /api/exams/{examId}/questions/{id}</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteQuestion(int examId, int id)
    {
        var exam = await _db.Exams.FindAsync(examId);
        if (exam == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Exam not found.");
        if (exam.CreatedById != UserId) return Forbid();

        var question = await _db.Questions.FirstOrDefaultAsync(q => q.Id == id && q.ExamId == examId);
        if (question == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Question not found.");

        _db.Questions.Remove(question);
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
