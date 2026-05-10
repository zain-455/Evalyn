using Evalyn.API.Constants;
using Evalyn.API.Data;
using Evalyn.API.Infrastructure;
using Evalyn.API.Models.DTOs;
using Evalyn.API.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Evalyn.API.Services.Exams;

/// <summary>
/// Encapsulates all business logic for adaptive and linear test sessions,
/// including IRT-based ability estimation, question selection, response
/// processing, integrity scoring, and result computation.
/// </summary>
public sealed class TestSessionService : ITestSessionService
{
    private readonly AppDbContext _db;
    private readonly IRTEngine _irt;
    private readonly BehavioralAnalyzer _analyzer;
    private readonly AnomalyDetectionService _anomaly;
    private readonly CalibrationService _calibration;

    public TestSessionService(
        AppDbContext db,
        IRTEngine irt,
        BehavioralAnalyzer analyzer,
        AnomalyDetectionService anomaly,
        CalibrationService calibration)
    {
        _db = db;
        _irt = irt;
        _analyzer = analyzer;
        _anomaly = anomaly;
        _calibration = calibration;
    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    public async Task<StartExamResponse> StartSessionAsync(int examId, string userId)
    {
        // P0 access control: ensure the student is in the exam audience before loading the full exam graph.
        var studentSection = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.Section)
            .FirstOrDefaultAsync() ?? string.Empty;

        var examMeta = await _db.Exams
            .AsNoTracking()
            .Where(e => e.Id == examId && e.Status == ExamStatuses.Published)
            .Select(e => new { e.Id, e.StartsAtUtc, e.EndsAtUtc })
            .FirstOrDefaultAsync();

        if (examMeta == null)
            throw new ApiException(StatusCodes.Status404NotFound, "Exam not found or not published.");

        var nowUtc = DateTime.UtcNow;
        if (examMeta.StartsAtUtc.HasValue && nowUtc < examMeta.StartsAtUtc.Value)
            throw new ApiException(StatusCodes.Status403Forbidden, "This exam is not open yet.");
        if (examMeta.EndsAtUtc.HasValue && nowUtc > examMeta.EndsAtUtc.Value)
            throw new ApiException(StatusCodes.Status403Forbidden, "This exam is closed.");

        var hasAccess = await _db.ExamAudiences
            .AsNoTracking()
            .AnyAsync(a => a.ExamId == examId &&
                           (a.StudentId == userId || a.Section == studentSection));

        if (!hasAccess)
            throw new ApiException(StatusCodes.Status403Forbidden, "You are not in the audience for this exam.");

        var exam = await _db.Exams
            .AsSplitQuery()
            .Include(e => e.Questions).ThenInclude(q => q.DomainTags)
            .Include(e => e.QuestionPoolItems).ThenInclude(i => i.Question).ThenInclude(q => q.DomainTags)
            .Include(e => e.PoolSettings).ThenInclude(s => s!.AllowedTags)
            .FirstOrDefaultAsync(e => e.Id == examId && e.Status == ExamStatuses.Published);

        if (exam == null)
            throw new ApiException(StatusCodes.Status404NotFound, "Exam not found or not published.");

        // Build the question pool
        var pool = exam.IsAdaptive
            ? ExamPoolCalculator.BuildEffectivePool(exam)
            : BuildFixedFormPool(exam);

        if (pool.Count == 0)
            throw new ApiException(StatusCodes.Status400BadRequest, "No questions available.");

        var fixedOrderedPool = exam.IsAdaptive
            ? pool
            : OrderFixedFormPool(exam, pool);

        // Enforce single-attempt policy: once completed, the exam cannot be started again.
        var completedSessionExists = await _db.TestSessions.AnyAsync(s =>
            s.UserId == userId
            && s.ExamId == examId
            && s.Status == TestSessionStatuses.Completed);

        if (completedSessionExists)
            throw new ApiException(StatusCodes.Status409Conflict, "This exam has already been submitted and can no longer be accessed.");

        // Resume existing in-progress session if present.
        var existing = await _db.TestSessions
            .Include(s => s.Responses)
            .FirstOrDefaultAsync(s =>
                s.UserId == userId
                && s.ExamId == examId
                && s.Status == TestSessionStatuses.InProgress);

        if (existing != null)
        {
            int remainingSeconds = CalculateRemainingSeconds(existing.StartedAt, exam.DurationMinutes);
            if (remainingSeconds <= 0)
            {
                existing.Status = TestSessionStatuses.Abandoned;
                existing.CompletedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                throw new ApiException(StatusCodes.Status403Forbidden, "Your previous session has expired.");
            }

            var answeredIds = existing.Responses
                .OrderBy(r => r.QuestionOrder)
                .Select(r => r.QuestionId)
                .ToHashSet();

            int currentQuestionNumber = Math.Min(existing.Responses.Count + 1, existing.TotalQuestions);
            Question? resumeQuestion;

            if (exam.IsAdaptive)
            {
                resumeQuestion = _irt.SelectNextQuestion(existing.ThetaEstimate, pool, answeredIds);
            }
            else
            {
                var fixedSet = fixedOrderedPool.Take(existing.TotalQuestions).ToList();
                var shuffled = ShuffleWithSeed(fixedSet, existing.Id);
                resumeQuestion = shuffled.FirstOrDefault(q => !answeredIds.Contains(q.Id));
            }

            if (resumeQuestion == null)
            {
                existing.Status = TestSessionStatuses.Completed;
                existing.CompletedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                throw new ApiException(StatusCodes.Status409Conflict, "This session is already completed. Please open your result.");
            }

            await _db.Entry(resumeQuestion).Collection(q => q.Options).LoadAsync();

            return new StartExamResponse(
                existing.Id,
                exam.Title,
                MapToQuestionDto(resumeQuestion, currentQuestionNumber),
                existing.TotalQuestions,
                exam.DurationMinutes,
                remainingSeconds,
                currentQuestionNumber,
                true
            );
        }

        int totalQuestions = Math.Min(exam.MaxQuestions, fixedOrderedPool.Count);

        var session = new TestSession
        {
            UserId = userId,
            ExamId = examId,
            TotalQuestions = totalQuestions,
            Status = TestSessionStatuses.InProgress
        };

        _db.TestSessions.Add(session);
        await _db.SaveChangesAsync();

        // Select first question
        Question? firstQuestion;
        if (exam.IsAdaptive)
        {
            firstQuestion = _irt.SelectNextQuestion(0.0, pool, new HashSet<int>());
        }
        else
        {
            var fixedSet = fixedOrderedPool.Take(session.TotalQuestions).ToList();
            var shuffled = ShuffleWithSeed(fixedSet, session.Id);
            firstQuestion = shuffled.FirstOrDefault();
        }

        if (firstQuestion == null)
            throw new ApiException(StatusCodes.Status400BadRequest, "No questions available.");

        await _db.Entry(firstQuestion).Collection(q => q.Options).LoadAsync();

        int initialRemainingSeconds = CalculateRemainingSeconds(session.StartedAt, exam.DurationMinutes);

        return new StartExamResponse(
            session.Id,
            exam.Title,
            MapToQuestionDto(firstQuestion, 1),
            session.TotalQuestions,
            exam.DurationMinutes,
            initialRemainingSeconds,
            1,
            false
        );
    }

    public async Task<SubmitAnswerResponse> SubmitAnswerAsync(int sessionId, string userId, SubmitAnswerRequest request)
    {
        var session = await _db.TestSessions
            .AsSplitQuery()
            .Include(s => s.Exam).ThenInclude(e => e.Questions).ThenInclude(q => q.DomainTags)
            .Include(s => s.Exam).ThenInclude(e => e.QuestionPoolItems).ThenInclude(i => i.Question).ThenInclude(q => q.DomainTags)
            .Include(s => s.Exam).ThenInclude(e => e.PoolSettings).ThenInclude(ps => ps!.AllowedTags)
            .Include(s => s.Responses)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);

        if (session == null)
            throw new ApiException(StatusCodes.Status404NotFound, "Test session not found.");
        if (session.Status != TestSessionStatuses.InProgress)
            throw new ApiException(StatusCodes.Status400BadRequest, "This session is already completed.");

        if (CalculateRemainingSeconds(session.StartedAt, session.Exam.DurationMinutes) <= 0)
        {
            session.Status = TestSessionStatuses.Abandoned;
            session.CompletedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            throw new ApiException(StatusCodes.Status403Forbidden, "Exam time has expired for this session.");
        }

        // Prevent double-submission of the same question (client retries / refreshes)
        if (session.Responses.Any(r => r.QuestionId == request.QuestionId))
            throw new ApiException(StatusCodes.Status409Conflict, "This question has already been answered.");

        var pool = session.Exam.IsAdaptive
            ? ExamPoolCalculator.BuildEffectivePool(session.Exam)
            : BuildFixedFormPool(session.Exam);
        if (pool.Count == 0)
            throw new ApiException(StatusCodes.Status400BadRequest, "No questions available.");

        var fixedOrderedPool = session.Exam.IsAdaptive
            ? pool
            : ShuffleWithSeed(OrderFixedFormPool(session.Exam, pool).Take(session.TotalQuestions), session.Id);

        // Find the question and check answer
        var question = pool.FirstOrDefault(q => q.Id == request.QuestionId);
        if (question == null)
            throw new ApiException(StatusCodes.Status400BadRequest, "Question not found in this exam.");

        await _db.Entry(question).Collection(q => q.Options).LoadAsync();

        var selectedOption = question.Options.FirstOrDefault(o => o.Id == request.SelectedOptionId);
        if (selectedOption == null)
            throw new ApiException(StatusCodes.Status400BadRequest, "Invalid option.");

        bool isCorrect = selectedOption.IsCorrect;

        // Update question statistics
        question.TimesAdministered++;
        if (isCorrect) question.TimesCorrect++;
        selectedOption.SelectionCount++;

        double newTheta = session.ThetaEstimate;
        if (session.Exam.IsAdaptive)
        {
            // Update theta estimate using IRT engine (theta trajectory)
            var responseHistory = session.Responses
                .Select(r =>
                {
                    var q = pool.First(qu => qu.Id == r.QuestionId);
                    return (q.IRT_Difficulty, q.IRT_Discrimination, r.IsCorrect);
                })
                .Append((question.IRT_Difficulty, question.IRT_Discrimination, isCorrect))
                .ToList();

            newTheta = _irt.EstimateTheta(responseHistory, session.ThetaEstimate);
            session.ThetaEstimate = newTheta;
        }
        if (isCorrect) session.TotalCorrect++;

        // Record response (after theta update so ThetaAtTime reflects post-answer estimate)
        int questionOrder = session.Responses.Count + 1;
        var response = new Response
        {
            TestSessionId = sessionId,
            QuestionId = request.QuestionId,
            SelectedOptionId = request.SelectedOptionId,
            IsCorrect = isCorrect,
            TimeTakenMs = request.TimeTakenMs,
            QuestionOrder = questionOrder,
            ThetaAtTime = newTheta,
            AnsweredAt = DateTime.UtcNow
        };

        _db.Responses.Add(response);

        // Check if exam is complete
        bool isComplete = questionOrder >= session.TotalQuestions;
        QuestionDto? nextQuestion = null;

        if (!isComplete)
        {
            // Select next question
            var answeredIds = session.Responses.Select(r => r.QuestionId).ToHashSet();
            answeredIds.Add(request.QuestionId);

            Question? next;
            if (session.Exam.IsAdaptive)
            {
                next = _irt.SelectNextQuestion(newTheta, pool, answeredIds);
            }
            else
            {
                next = fixedOrderedPool.FirstOrDefault(q => !answeredIds.Contains(q.Id));
            }

            if (next != null)
            {
                await _db.Entry(next).Collection(q => q.Options).LoadAsync();
                nextQuestion = MapToQuestionDto(next, questionOrder + 1);
            }
            else
            {
                isComplete = true; // No more questions available
            }
        }

        if (isComplete)
        {
            await FinalizeSessionAsync(session, response, pool, newTheta, sessionId);
        }

        await _db.SaveChangesAsync();

        if (!question.IsCalibrated && question.TimesAdministered == 30)
        {
            _ = _calibration.CalibrateQuestionAsync(question.Id);
        }

        return new SubmitAnswerResponse(isCorrect, newTheta, nextQuestion, isComplete);
    }

    public async Task<TestResultResponse> GetResultAsync(int sessionId, string userId, string userRole)
    {
        var session = await _db.TestSessions
            .AsNoTracking()
            .AsSplitQuery()
            .Include(s => s.Exam)
            .Include(s => s.Responses).ThenInclude(r => r.Question).ThenInclude(q => q.DomainTags)
            .Include(s => s.BehavioralEvents)
            .FirstOrDefaultAsync(s => s.Id == sessionId);

        if (session == null)
            throw new ApiException(StatusCodes.Status404NotFound, "Test session not found.");

        // Students can only see their own results
        if (userRole == Roles.Student && session.UserId != userId)
            throw new ApiException(StatusCodes.Status403Forbidden, "You do not have access to this result.");

        // Calculate skill domain scores
        var skillMap = session.Responses
            .SelectMany(r => r.Question.DomainTags.Select(t => new { t.DomainName, t.SubDomain, r.IsCorrect }))
            .GroupBy(x => new { x.DomainName, x.SubDomain })
            .Select(g => new SkillDomainScore(
                g.Key.DomainName,
                g.Key.SubDomain,
                g.Count() > 0 ? Math.Round(g.Count(x => x.IsCorrect) * 100.0 / g.Count(), 1) : 0,
                g.Count(x => x.IsCorrect),
                g.Count()
            )).ToList();

        // Get integrity flags (re-analyze for detailed breakdown)
        var integrity = _analyzer.Analyze(
            session.Responses.ToList(),
            session.BehavioralEvents.ToList());

        var flags = integrity.Flags.Select(f =>
            new IntegrityFlag(f.Signal, f.Description, f.Severity, f.Evidence)).ToList();

        return new TestResultResponse(
            session.Id, session.Exam.Title,
            session.ThetaEstimate, session.ThetaSEM, session.PercentileRank,
            session.TotalCorrect, session.TotalQuestions,
            session.IntegrityScore, session.IntegrityLabel,
            session.AnomalyScore,
            session.StartedAt, session.CompletedAt,
            skillMap, flags
        );
    }

    public async Task<object> GetMyHistoryAsync(string userId)
    {
        // NOTE: Avoid EF Core GroupBy/First translation issues on SQL Server.
        // We fetch completed sessions ordered by completion time and de-dupe in-memory by ExamId.
        var raw = await _db.TestSessions
            .Where(s => s.UserId == userId && s.Status == TestSessionStatuses.Completed)
            .Select(s => new
            {
                s.Id,
                s.ExamId,
                ExamTitle = s.Exam.Title,
                s.ThetaEstimate,
                s.PercentileRank,
                s.TotalCorrect,
                s.TotalQuestions,
                s.IntegrityScore,
                s.IntegrityLabel,
                s.Status,
                s.StartedAt,
                s.CompletedAt,
                SortAt = s.CompletedAt ?? s.StartedAt
            })
            .OrderByDescending(s => s.SortAt)
            .ToListAsync();

        return raw
            .GroupBy(s => s.ExamId)
            .Select(g => g.First())
            .OrderByDescending(s => s.SortAt)
            .Select(s => new
            {
                s.Id,
                s.ExamTitle,
                s.ThetaEstimate,
                s.PercentileRank,
                s.TotalCorrect,
                s.TotalQuestions,
                s.IntegrityScore,
                s.IntegrityLabel,
                s.Status,
                s.StartedAt,
                s.CompletedAt
            })
            .ToList();
    }

    public async Task LogEventAsync(int sessionId, string userId, BehavioralEventRequest request)
    {
        var session = await _db.TestSessions.FindAsync(sessionId);
        if (session == null || session.UserId != userId)
            throw new ApiException(StatusCodes.Status404NotFound, "Test session not found.");

        _db.BehavioralEvents.Add(new BehavioralEvent
        {
            TestSessionId = sessionId,
            EventType = request.EventType,
            EventData = request.EventData
        });

        await _db.SaveChangesAsync();
    }

    public async Task LogEventsBatchAsync(int sessionId, string userId, IReadOnlyList<BehavioralEventRequest> events)
    {
        if (events == null || events.Count == 0)
            return;

        // Guardrail: prevent abusive payload sizes.
        if (events.Count > 200)
            throw new ApiException(StatusCodes.Status400BadRequest, "Too many events in one batch.");

        var session = await _db.TestSessions.FindAsync(sessionId);
        if (session == null || session.UserId != userId)
            throw new ApiException(StatusCodes.Status404NotFound, "Test session not found.");

        var rows = events
            .Where(e => e != null && !string.IsNullOrWhiteSpace(e.EventType))
            .Select(e => new BehavioralEvent
            {
                TestSessionId = sessionId,
                EventType = e.EventType,
                EventData = e.EventData
            })
            .ToList();

        if (rows.Count == 0)
            return;

        _db.BehavioralEvents.AddRange(rows);
        await _db.SaveChangesAsync();
    }

    // ─────────────────────────────────────────────────────────────
    // Private Helpers
    // ─────────────────────────────────────────────────────────────

    /// <summary>Finalizes a completed session: computes SEM, integrity scores, and triggers ML retraining.</summary>
    private async Task FinalizeSessionAsync(
        TestSession session, Response lastResponse,
        List<Question> pool, double newTheta, int sessionId)
    {
        session.Status = TestSessionStatuses.Completed;
        session.CompletedAt = DateTime.UtcNow;

        if (session.Exam.IsAdaptive)
        {
            // Calculate SEM
            var answeredQuestionParams = session.Responses
                .Append(lastResponse)
                .Select(r =>
                {
                    var q = pool.First(qu => qu.Id == r.QuestionId);
                    return (q.IRT_Difficulty, q.IRT_Discrimination);
                }).ToList();

            session.ThetaSEM = _irt.CalculateSEM(newTheta, answeredQuestionParams);
            session.PercentileRank = IRTEngine.ThetaToPercentile(newTheta);
        }
        else
        {
            // Fixed-form exams do not run IRT scoring.
            session.ThetaEstimate = 0.0;
            session.ThetaSEM = 0.0;
            session.PercentileRank = 0.0;
        }

        // ── Layer 1: Rule-based behavioral analysis ──
        var allResponses = session.Responses
            .OrderBy(r => r.QuestionOrder)
            .Append(lastResponse)
            .ToList();

        var events = await _db.BehavioralEvents
            .Where(e => e.TestSessionId == sessionId)
            .ToListAsync();

        var integrity = _analyzer.Analyze(allResponses, events);
        double ruleScore = integrity.Score;

        // Save feature vector (needed before ML scoring)
        var existingFeatures = await _db.BehavioralFeatureVectors
            .FirstOrDefaultAsync(f => f.TestSessionId == sessionId);

        if (existingFeatures == null)
        {
            _db.BehavioralFeatureVectors.Add(new BehavioralFeatureVector
            {
                TestSessionId = sessionId,
                TabSwitchesPerMinute = integrity.Features.TabSwitchesPerMinute,
                PasteCount = integrity.Features.PasteCount,
                RightClickCount = integrity.Features.RightClickCount,
                IdleSeconds = integrity.Features.IdleSeconds,
                FocusLostCount = integrity.Features.FocusLostCount,
                TimingCv = integrity.Features.TimingCv,
                MouseAngleEntropy = integrity.Features.MouseAngleEntropy,
                ComputedAt = DateTime.UtcNow
            });
        }
        else
        {
            existingFeatures.TabSwitchesPerMinute = integrity.Features.TabSwitchesPerMinute;
            existingFeatures.PasteCount = integrity.Features.PasteCount;
            existingFeatures.RightClickCount = integrity.Features.RightClickCount;
            existingFeatures.IdleSeconds = integrity.Features.IdleSeconds;
            existingFeatures.FocusLostCount = integrity.Features.FocusLostCount;
            existingFeatures.TimingCv = integrity.Features.TimingCv;
            existingFeatures.MouseAngleEntropy = integrity.Features.MouseAngleEntropy;
            existingFeatures.ComputedAt = DateTime.UtcNow;
        }

        // Flush feature vector so ML can read it
        await _db.SaveChangesAsync();

        // ── Layer 2: ML anomaly scoring (if model available) ──
        var mlScore = await _anomaly.ScoreSessionAsync(sessionId, session.ExamId);
        session.AnomalyScore = mlScore;

        if (mlScore.HasValue)
        {
            // Hybrid blend: 60% rule-based + 40% ML
            session.IntegrityScore = AnomalyDetectionService.BlendScores(ruleScore, mlScore.Value);
        }
        else
        {
            // Cold start — use rule score only
            session.IntegrityScore = ruleScore;
        }

        session.IntegrityLabel = session.IntegrityScore switch
        {
            >= 80 => "High",
            >= 50 => "Medium",
            _ => "Low"
        };

        // Trigger model retrain check (non-blocking for the response)
        _ = _anomaly.MaybeRetrainAsync(session.ExamId);
    }

    private static List<Question> BuildFixedFormPool(Exam exam)
        => exam.Questions
            .Concat(exam.QuestionPoolItems.Select(i => i.Question))
            .GroupBy(q => q.Id)
            .Select(g => g.First())
            .ToList();

    private static List<T> ShuffleWithSeed<T>(IEnumerable<T> items, int seed)
    {
        var list = items.ToList();
        var rng = new Random(seed);
        for (int i = list.Count - 1; i > 0; i--)
        {
            int j = rng.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
        return list;
    }

    private static List<Question> OrderFixedFormPool(Exam exam, List<Question> effectivePool)
    {
        // Exam questions come first, then attached bank questions.
        var examOrder = exam.Questions
            .GroupBy(q => q.Id)
            .Select(g => g.First())
            .ToDictionary(q => q.Id, q => q.FixedFormOrder);

        // Build lookup for attached metadata
        var attachedMeta = exam.QuestionPoolItems
            .GroupBy(i => i.QuestionId)
            .Select(g => g.First())
            .ToDictionary(
                i => i.QuestionId,
                i => (order: i.FixedFormOrder, attachedAt: i.AttachedAt));

        return effectivePool
            .OrderBy(q => examOrder.ContainsKey(q.Id) ? 0 : 1)
            .ThenBy(q =>
            {
                if (examOrder.TryGetValue(q.Id, out var order))
                    return order ?? int.MaxValue;

                return attachedMeta.TryGetValue(q.Id, out var meta)
                    ? meta.order ?? int.MaxValue
                    : int.MaxValue;
            })
            .ThenBy(q =>
            {
                if (examOrder.ContainsKey(q.Id))
                    return (long)q.Id;

                return attachedMeta.TryGetValue(q.Id, out var meta)
                    ? meta.attachedAt.Ticks
                    : long.MaxValue;
            })
            .ThenBy(q => q.Id)
            .ToList();
    }

    private static QuestionDto MapToQuestionDto(Question q, int number)
    {
        return new QuestionDto(
            q.Id,
            q.QuestionText,
            q.QuestionType,
            q.Options.Select(o => new OptionDto(o.Id, o.OptionText)).ToList(),
            number
        );
    }

    private static int CalculateRemainingSeconds(DateTime startedAtUtc, int durationMinutes)
    {
        int durationSeconds = Math.Max(0, durationMinutes) * 60;
        int elapsedSeconds = Math.Max(0, (int)(DateTime.UtcNow - startedAtUtc).TotalSeconds);
        return Math.Max(0, durationSeconds - elapsedSeconds);
    }
}
