using Evalyn.API.Constants;
using Evalyn.API.Data;
using Evalyn.API.Models.DTOs;
using Evalyn.API.Models.Entities;
using Evalyn.API.Services.Exams;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Evalyn.API.Controllers;

[ApiController]
[Route("api/exams/{examId}/pool")]
[Authorize(Roles = Roles.InstructorOrAdmin)]
public class ExamPoolController : ControllerBase
{
    private readonly AppDbContext _db;

    public ExamPoolController(AppDbContext db) => _db = db;

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private string UserRole => User.FindFirstValue(ClaimTypes.Role)!;

    [HttpGet]
    public async Task<ActionResult<ExamPoolSettingsResponse>> GetPool(int examId)
    {
        var exam = await LoadExamWithPoolAsync(examId);
        if (exam == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Exam not found.");

        if (!CanAccessExam(exam))
            return Forbid();

        var pool = ExamPoolCalculator.BuildEffectivePool(exam);

        var settings = exam.PoolSettings;
        if (settings == null)
        {
            return Ok(new ExamPoolSettingsResponse(
                AllowAIGenerated: true,
                RequireCalibrated: false,
                MinDifficulty: -4.0,
                MaxDifficulty: 4.0,
                AllowedTags: new List<DomainTagFilter>(),
                ExamQuestionCount: exam.Questions.Count,
                AttachedBankQuestionCount: exam.QuestionPoolItems.Count,
                EffectivePoolCount: pool.Count
            ));
        }

        return Ok(new ExamPoolSettingsResponse(
            settings.AllowAIGenerated,
            settings.RequireCalibrated,
            settings.MinDifficulty,
            settings.MaxDifficulty,
            settings.AllowedTags
                .OrderBy(t => t.DomainName).ThenBy(t => t.SubDomain)
                .Select(t => new DomainTagFilter(t.DomainName, t.SubDomain))
                .ToList(),
            exam.Questions.Count,
            exam.QuestionPoolItems.Count,
            pool.Count
        ));
    }

    [HttpGet("attached")]
    public async Task<ActionResult<List<QuestionResponse>>> GetAttachedBankQuestions(int examId)
    {
        var exam = await _db.Exams
            .Include(e => e.QuestionPoolItems)
                .ThenInclude(i => i.Question)
                    .ThenInclude(q => q.Options)
            .Include(e => e.QuestionPoolItems)
                .ThenInclude(i => i.Question)
                    .ThenInclude(q => q.DomainTags)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Exam not found.");

        if (!CanAccessExam(exam))
            return Forbid();

        var attached = exam.QuestionPoolItems
            .OrderBy(i => i.FixedFormOrder ?? int.MaxValue)
            .ThenBy(i => i.AttachedAt)
            .ThenBy(i => i.QuestionId)
            .Select(i => i.Question)
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
            .ToList();

        return Ok(attached);
    }

    [HttpPut]
    public async Task<IActionResult> UpdatePoolSettings(int examId, [FromBody] UpdateExamPoolSettingsRequest request)
    {
        if (request.MinDifficulty > request.MaxDifficulty)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "MinDifficulty cannot be greater than MaxDifficulty.");

        var exam = await _db.Exams
            .Include(e => e.PoolSettings).ThenInclude(s => s!.AllowedTags)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Exam not found.");

        if (!CanEditExam(exam))
            return Forbid();

        if (exam.Status == ExamStatuses.Published && UserRole != Roles.Admin)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Cannot edit pool settings for a published exam.");

        if (exam.PoolSettings == null)
        {
            exam.PoolSettings = new ExamPoolSettings { ExamId = exam.Id };
            _db.ExamPoolSettings.Add(exam.PoolSettings);
        }

        exam.PoolSettings.AllowAIGenerated = request.AllowAIGenerated;
        exam.PoolSettings.RequireCalibrated = request.RequireCalibrated;
        exam.PoolSettings.MinDifficulty = request.MinDifficulty;
        exam.PoolSettings.MaxDifficulty = request.MaxDifficulty;

        // Replace allowed tags
        _db.ExamPoolAllowedTags.RemoveRange(exam.PoolSettings.AllowedTags);
        exam.PoolSettings.AllowedTags.Clear();

        if (request.AllowedTags != null)
        {
            foreach (var tag in request.AllowedTags)
            {
                exam.PoolSettings.AllowedTags.Add(new ExamPoolAllowedTag
                {
                    ExamId = exam.Id,
                    DomainName = tag.DomainName.Trim(),
                    SubDomain = tag.SubDomain.Trim()
                });
            }
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("questions")]
    public async Task<ActionResult<List<PooledQuestionResponse>>> GetPoolQuestions(int examId)
    {
        var exam = await _db.Exams
            .Include(e => e.Questions).ThenInclude(q => q.Options)
            .Include(e => e.Questions).ThenInclude(q => q.DomainTags)
            .Include(e => e.QuestionPoolItems).ThenInclude(i => i.Question).ThenInclude(q => q.Options)
            .Include(e => e.QuestionPoolItems).ThenInclude(i => i.Question).ThenInclude(q => q.DomainTags)
            .Include(e => e.PoolSettings).ThenInclude(s => s!.AllowedTags)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Exam not found.");

        if (!CanAccessExam(exam))
            return Forbid();

        var effectivePool = ExamPoolCalculator.BuildEffectivePool(exam);

        var examQuestionIds = exam.Questions.Select(q => q.Id).ToHashSet();

        var responses = effectivePool
            .OrderBy(q => q.Id)
            .Select(q => new PooledQuestionResponse(
                new QuestionResponse(
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
                ),
                examQuestionIds.Contains(q.Id) ? "Exam" : "Bank"
            ))
            .ToList();

        return Ok(responses);
    }

    [HttpPost("attach")]
    public async Task<IActionResult> AttachBankQuestions(int examId, [FromBody] AttachBankQuestionsRequest request)
    {
        var exam = await _db.Exams
            .Include(e => e.QuestionPoolItems)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Exam not found.");

        if (!CanEditExam(exam))
            return Forbid();

        if (exam.Status == ExamStatuses.Published && UserRole != Roles.Admin)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Cannot attach questions to a published exam.");

        var ids = request.QuestionIds.Distinct().ToList();

        var bankQuery = _db.Questions
            .Where(q => q.ExamId == null && ids.Contains(q.Id))
            .AsQueryable();

        // Instructors can attach their own bank items + legacy/system global (CreatedById == null).
        // Admin can attach anything.
        if (UserRole != Roles.Admin)
            bankQuery = bankQuery.Where(q => q.CreatedById == null || q.CreatedById == UserId);

        var bankQuestions = await bankQuery
            .Select(q => q.Id)
            .ToListAsync();

        if (bankQuestions.Count != ids.Count)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "One or more question IDs are not valid global question bank items.");

        var existing = exam.QuestionPoolItems.Select(x => x.QuestionId).ToHashSet();

        int? currentMaxOrder = exam.QuestionPoolItems
            .Where(i => i.FixedFormOrder != null)
            .Max(i => (int?)i.FixedFormOrder);
        int nextOrder = (currentMaxOrder ?? 0) + 1;

        foreach (var qid in ids)
        {
            if (existing.Contains(qid))
                continue;

            exam.QuestionPoolItems.Add(new ExamQuestionPoolItem
            {
                ExamId = exam.Id,
                QuestionId = qid,
                FixedFormOrder = nextOrder++
            });
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("attach/{questionId}")]
    public async Task<IActionResult> DetachBankQuestion(int examId, int questionId)
    {
        var exam = await _db.Exams.FirstOrDefaultAsync(e => e.Id == examId);
        if (exam == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Exam not found.");

        if (!CanEditExam(exam))
            return Forbid();

        if (exam.Status == ExamStatuses.Published && UserRole != Roles.Admin)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Cannot detach questions from a published exam.");

        var link = await _db.ExamQuestionPoolItems
            .FirstOrDefaultAsync(x => x.ExamId == examId && x.QuestionId == questionId);

        if (link == null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Attached question not found.");

        _db.ExamQuestionPoolItems.Remove(link);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private bool CanAccessExam(Exam exam)
    {
        if (UserRole == Roles.Admin) return true;
        return exam.CreatedById == UserId;
    }

    private bool CanEditExam(Exam exam)
    {
        if (UserRole == Roles.Admin) return true;
        return exam.CreatedById == UserId;
    }

    private async Task<Exam?> LoadExamWithPoolAsync(int examId)
    {
        return await _db.Exams
            .Include(e => e.Questions).ThenInclude(q => q.DomainTags)
            .Include(e => e.QuestionPoolItems).ThenInclude(i => i.Question).ThenInclude(q => q.DomainTags)
            .Include(e => e.PoolSettings).ThenInclude(s => s!.AllowedTags)
            .FirstOrDefaultAsync(e => e.Id == examId);
    }
}
