using Evalyn.API.Constants;
using Evalyn.API.Data;
using Evalyn.API.Infrastructure;
using Evalyn.API.Models.DTOs;
using Evalyn.API.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Evalyn.API.Services.Exams;

public sealed class ExamService : IExamService
{
    private readonly AppDbContext _db;

    public ExamService(AppDbContext db) => _db = db;

    public async Task<List<object>> GetExamsForUserAsync(string userId, string userRole, int? skip = null, int? take = null)
    {
        if (skip.HasValue && skip.Value < 0)
            throw new ApiException(StatusCodes.Status400BadRequest, "skip must be >= 0");
        if (take.HasValue && take.Value <= 0)
            throw new ApiException(StatusCodes.Status400BadRequest, "take must be > 0");
        if (take.HasValue && take.Value > 200)
            throw new ApiException(StatusCodes.Status400BadRequest, "take is too large");

        var query = _db.Exams.AsQueryable();

        if (userRole == Roles.Student)
        {
            var student = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            var studentSection = student?.Section ?? string.Empty;

            query = query.Where(e => e.Status == ExamStatuses.Published &&
                e.Audiences.Any(a => a.Section == studentSection || a.StudentId == userId));

            IQueryable<Exam> pagedQuery = query
                .Include(e => e.PoolSettings)
                .OrderByDescending(e => e.CreatedAt);

            if (skip.HasValue) pagedQuery = pagedQuery.Skip(skip.Value);
            if (take.HasValue) pagedQuery = pagedQuery.Take(take.Value);

            var exams = await pagedQuery
                .Select(e => new
                {
                    e.Id, e.Title, e.Status,
                    QuestionCount = e.Questions.Count + e.QuestionPoolItems.Count,
                    e.IsAdaptive, e.MaxQuestions,
                    HasPoolSettings = e.PoolSettings != null,
                    e.CreatedAt, e.DurationMinutes,
                    e.StartsAtUtc,
                    e.EndsAtUtc
                })
                .ToListAsync();

            // Fetch student sessions for the current page of exams in one query
            var examIds = exams.Select(e => e.Id).ToList();
            var sessions = await _db.TestSessions
                .Where(s => s.UserId == userId && examIds.Contains(s.ExamId))
                .GroupBy(s => s.ExamId)
                // Prefer Completed over InProgress/Abandoned so UI doesn't show "Resume" after submission
                .Select(g => g
                    .OrderByDescending(s => s.Status == TestSessionStatuses.Completed)
                    .ThenByDescending(s => s.Status == TestSessionStatuses.InProgress)
                    .ThenByDescending(s => (DateTime?)(s.CompletedAt ?? s.StartedAt))
                    .First())
                .ToListAsync();

            var sessionLookup = sessions.ToDictionary(s => s.ExamId);

            return exams.Select(e =>
            {
                sessionLookup.TryGetValue(e.Id, out var session);
                return (object)new StudentExamListResponse(
                    e.Id, e.Title, e.Status, e.QuestionCount, e.IsAdaptive, e.MaxQuestions,
                    e.HasPoolSettings, e.CreatedAt, e.DurationMinutes,
                    session?.Id, session?.Status, session?.StartedAt, session?.TotalCorrect, session?.TotalQuestions,
                    session?.PercentileRank, session?.CompletedAt,
                    e.StartsAtUtc, e.EndsAtUtc
                );
            }).ToList();
        }

        if (userRole == Roles.Instructor)
            query = query.Where(e => e.CreatedById == userId);

        IQueryable<Exam> nonStudentPagedQuery = query
            .Include(e => e.PoolSettings)
            .OrderByDescending(e => e.CreatedAt);

        if (skip.HasValue) nonStudentPagedQuery = nonStudentPagedQuery.Skip(skip.Value);
        if (take.HasValue) nonStudentPagedQuery = nonStudentPagedQuery.Take(take.Value);

        return await nonStudentPagedQuery
            .Select(e => (object)new ExamListResponse(
                e.Id,
                e.Title,
                e.Status,
                e.Questions.Count + e.QuestionPoolItems.Count,
                e.IsAdaptive,
                e.MaxQuestions,
                e.PoolSettings != null,
                e.CreatedAt,
                e.StartsAtUtc,
                e.EndsAtUtc))
            .ToListAsync();
    }

    public async Task<ExamResponse> GetExamAsync(int examId, string userId, string userRole)
    {
        var exam = await _db.Exams
            .Include(e => e.Questions)
            .Include(e => e.QuestionPoolItems)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null)
            throw new ApiException(StatusCodes.Status404NotFound, "Exam not found");

        if (userRole == Roles.Student)
        {
            if (exam.Status != ExamStatuses.Published)
                throw new ApiException(StatusCodes.Status403Forbidden, "You do not have access to this exam");

            var student = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            var studentSection = student?.Section ?? string.Empty;

            var hasAccess = await _db.ExamAudiences.AnyAsync(a =>
                a.ExamId == examId &&
                (a.Section == studentSection || a.StudentId == userId));

            if (!hasAccess)
                throw new ApiException(StatusCodes.Status403Forbidden, "You are not in the audience for this exam");
        }

        if (userRole == Roles.Instructor && exam.CreatedById != userId)
            throw new ApiException(StatusCodes.Status403Forbidden, "You do not have access to this exam");

        return new ExamResponse(
            exam.Id,
            exam.Title,
            exam.Description,
            exam.DurationMinutes,
            exam.IsAdaptive,
            exam.MaxQuestions,
            exam.Status,
            exam.Questions.Count + exam.QuestionPoolItems.Count,
            exam.CreatedAt,
            exam.StartsAtUtc,
            exam.EndsAtUtc);
    }

    public async Task<ExamResponse> CreateExamAsync(CreateExamRequest request, string userId)
    {
        if (request.StartsAtUtc.HasValue && request.EndsAtUtc.HasValue && request.EndsAtUtc.Value <= request.StartsAtUtc.Value)
            throw new ApiException(StatusCodes.Status400BadRequest, "End time must be after start time.");

        var exam = new Exam
        {
            Title = request.Title,
            Description = request.Description ?? string.Empty,
            DurationMinutes = request.DurationMinutes,
            IsAdaptive = request.IsAdaptive,
            MaxQuestions = request.MaxQuestions,
            CreatedById = userId,
            Status = ExamStatuses.Draft,
            AudienceType = request.AudienceType,
            StartsAtUtc = request.StartsAtUtc.HasValue ? DateTime.SpecifyKind(request.StartsAtUtc.Value, DateTimeKind.Utc) : null,
            EndsAtUtc = request.EndsAtUtc.HasValue ? DateTime.SpecifyKind(request.EndsAtUtc.Value, DateTimeKind.Utc) : null
        };

        _db.Exams.Add(exam);

        // Add audiences if provided
        if (request.Sections?.Any() == true)
        {
            foreach (var section in request.Sections)
            {
                _db.ExamAudiences.Add(new ExamAudience { Exam = exam, Section = section });
            }
        }

        if (request.StudentIds?.Any() == true)
        {
            foreach (var sid in request.StudentIds)
            {
                _db.ExamAudiences.Add(new ExamAudience { Exam = exam, StudentId = sid });
            }
        }

        await _db.SaveChangesAsync();

        return new ExamResponse(
            exam.Id,
            exam.Title,
            exam.Description,
            exam.DurationMinutes,
            exam.IsAdaptive,
            exam.MaxQuestions,
            exam.Status,
            0,
            exam.CreatedAt,
            exam.StartsAtUtc,
            exam.EndsAtUtc);
    }

    public async Task PublishExamAsync(int examId, string userId, string userRole)
    {
        var exam = await _db.Exams
            .Include(e => e.Questions)
                .ThenInclude(q => q.DomainTags)
            .Include(e => e.Questions)
                .ThenInclude(q => q.Options)
            .Include(e => e.QuestionPoolItems)
                .ThenInclude(i => i.Question)
                    .ThenInclude(q => q.DomainTags)
            .Include(e => e.QuestionPoolItems)
                .ThenInclude(i => i.Question)
                    .ThenInclude(q => q.Options)
            .Include(e => e.PoolSettings).ThenInclude(s => s!.AllowedTags)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null)
            throw new ApiException(StatusCodes.Status404NotFound, "Exam not found");

        if (exam.CreatedById != userId && userRole != Roles.Admin)
            throw new ApiException(StatusCodes.Status403Forbidden, "You do not have access to publish this exam");

        var effectivePool = ExamPoolCalculator.BuildEffectivePool(exam);
        if (effectivePool.Count < 10)
            throw new ApiException(StatusCodes.Status400BadRequest, "Exam must have at least 10 questions in its pool (after constraints) before publishing");

        exam.Status = ExamStatuses.Published;
        await _db.SaveChangesAsync();
    }

    public async Task DeleteExamAsync(int examId, string userId, string userRole)
    {
        var exam = await _db.Exams.FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null)
            throw new ApiException(StatusCodes.Status404NotFound, "Exam not found");

        if (exam.CreatedById != userId && userRole != Roles.Admin)
            throw new ApiException(StatusCodes.Status403Forbidden, "You do not have access to delete this exam");

        if (exam.Status == ExamStatuses.Published)
            throw new ApiException(StatusCodes.Status400BadRequest, "Cannot delete a published exam. Archive it first.");

        _db.Exams.Remove(exam);
        await _db.SaveChangesAsync();
    }
}
