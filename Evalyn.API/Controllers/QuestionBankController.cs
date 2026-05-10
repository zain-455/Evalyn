using Evalyn.API.Constants;
using Evalyn.API.Data;
using Evalyn.API.Models.DTOs;
using Evalyn.API.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Evalyn.API.Controllers;

[ApiController]
[Route("api/question-bank")]
[Authorize(Roles = Roles.InstructorOrAdmin)]
public class QuestionBankController : ControllerBase
{
    private readonly AppDbContext _db;

    public QuestionBankController(AppDbContext db) => _db = db;

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private string UserRole => User.FindFirstValue(ClaimTypes.Role)!;

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
        var isPlaceholder = Math.Abs(request.IRT_Difficulty) < 1e-9 && Math.Abs(request.IRT_Discrimination - 1.0) < 1e-9;
        return isPlaceholder ? SeedIrtFromLabel(request.DifficultyLabel) : (request.IRT_Difficulty, request.IRT_Discrimination);
    }

    private static (double Difficulty, double Discrimination) GetEffectiveIrt(UpdateQuestionRequest request)
    {
        var isPlaceholder = Math.Abs(request.IRT_Difficulty) < 1e-9 && Math.Abs(request.IRT_Discrimination - 1.0) < 1e-9;
        return isPlaceholder ? SeedIrtFromLabel(request.DifficultyLabel) : (request.IRT_Difficulty, request.IRT_Discrimination);
    }

    /// <summary>GET /api/question-bank — list global question bank items</summary>
    [HttpGet]
    public async Task<ActionResult<List<QuestionResponse>>> GetBankQuestions()
    {
        var query = _db.Questions
            .Where(q => q.ExamId == null)
            .AsQueryable();

        // Instructors see their own bank questions + legacy/system global (CreatedById == null).
        // Admin sees everything.
        if (UserRole != Roles.Admin)
            query = query.Where(q => q.CreatedById == null || q.CreatedById == UserId);

        var questions = await query
            .Include(q => q.Options)
            .Include(q => q.DomainTags)
            .OrderBy(q => q.Id)
            .Select(q => new QuestionResponse(
                q.Id,
                q.QuestionText,
                q.QuestionType,
                q.IRT_Difficulty,
                q.IRT_Discrimination,
                q.DifficultyLabel,
                q.IsCalibrated,
                q.IsAIGenerated,
                q.Options.Select(o => new OptionResponse(o.Id, o.OptionText, o.IsCorrect)).ToList(),
                q.DomainTags.Select(t => new DomainTagResponse(t.Id, t.DomainName, t.SubDomain)).ToList()
            ))
            .ToListAsync();

        return Ok(questions);
    }

    /// <summary>POST /api/question-bank — add a global question bank item</summary>
    [HttpPost]
    public async Task<ActionResult<QuestionResponse>> CreateBankQuestion([FromBody] CreateQuestionRequest request)
    {
        bool needsTwoOptions = request.QuestionType == "MCQ" || request.QuestionType == "True / False";
        if (needsTwoOptions && request.Options.Count < 2)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: $"{request.QuestionType} questions must have at least 2 options.");
        if (!needsTwoOptions && request.Options.Count < 1)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Question must have at least 1 correct answer option.");
        if (request.Options.Count(o => o.IsCorrect) != 1)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Exactly one option must be marked as correct.");

        var (difficulty, discrimination) = GetEffectiveIrt(request);

        var question = new Question
        {
            ExamId = null,
            CreatedById = UserId,
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

        return CreatedAtAction(nameof(GetBankQuestions), null, new QuestionResponse(
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

    /// <summary>PUT /api/question-bank/{id} — update a global question bank item</summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<QuestionResponse>> UpdateBankQuestion(int id, [FromBody] UpdateQuestionRequest request)
    {
        var question = await _db.Questions
            .Include(q => q.Options)
            .Include(q => q.DomainTags)
            .FirstOrDefaultAsync(q => q.Id == id && q.ExamId == null);

        if (question == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Question not found.");

        // Ownership enforcement: instructor can edit only their own bank items.
        if (UserRole != Roles.Admin)
        {
            if (string.IsNullOrWhiteSpace(question.CreatedById) || question.CreatedById != UserId)
                return Forbid();
        }

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

    /// <summary>DELETE /api/question-bank/{id}</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteBankQuestion(int id)
    {
        var question = await _db.Questions.FirstOrDefaultAsync(q => q.Id == id && q.ExamId == null);
        if (question == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Question not found.");

        // Ownership enforcement: instructor can delete only their own bank items.
        if (UserRole != Roles.Admin)
        {
            if (string.IsNullOrWhiteSpace(question.CreatedById) || question.CreatedById != UserId)
                return Forbid();
        }

        _db.Questions.Remove(question);
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
