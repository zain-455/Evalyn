using System.Data;
using Evalyn.API.Constants;
using Evalyn.API.Data;
using Evalyn.API.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Evalyn.API.Services;

/// <summary>
/// Service encapsulating all psychometric analytics computations:
/// item analysis, point-biserial correlation, Test Information Function,
/// integrity/theta distributions, and platform-level metrics.
/// </summary>
public class PsychometricService
{
    private readonly AppDbContext _db;
    private readonly AnomalyDetectionService _anomaly;
    private readonly IRTSettings _irtSettings;

    public PsychometricService(
        AppDbContext db,
        AnomalyDetectionService anomaly,
        IOptions<IRTSettings> irtOptions)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));
        _anomaly = anomaly ?? throw new ArgumentNullException(nameof(anomaly));
        _irtSettings = irtOptions?.Value ?? new IRTSettings();
    }

    // ─────────────────────────────────────────────────────────────
    // Student Profile Analytics
    // ─────────────────────────────────────────────────────────────

    public async Task<object> GetStudentProfileAsync(string userId)
    {
        var sessions = await _db.TestSessions
            .AsNoTracking()
            .Where(s => s.UserId == userId && s.Status == TestSessionStatuses.Completed)
            .Include(s => s.Responses).ThenInclude(r => r.Question).ThenInclude(q => q.DomainTags)
            .OrderBy(s => s.CompletedAt ?? s.StartedAt)
            .ToListAsync();

        if (sessions.Count == 0)
        {
            return new
            {
                radarStats = Array.Empty<object>(),
                abilityHistory = Array.Empty<object>(),
                currentTheta = 0.0,
                percentile = 0.0,
                sem = 0.0,
                confidenceInterval = new[] { 0.0, 0.0 }
            };
        }

        var abilityHistory = sessions
            .Select(s => new
            {
                date = (s.CompletedAt ?? s.StartedAt).ToString("yyyy-MM-dd"),
                theta = Math.Round(s.ThetaEstimate, 2)
            })
            .ToList();

        var latest = sessions[^1];
        var sem = latest.ThetaSEM;
        var ciLow = latest.ThetaEstimate - (1.96 * sem);
        var ciHigh = latest.ThetaEstimate + (1.96 * sem);

        var userDomainStats = sessions
            .SelectMany(s => s.Responses)
            .SelectMany(r => r.Question.DomainTags.Select(t => new { t.DomainName, r.IsCorrect }))
            .GroupBy(x => x.DomainName)
            .Select(g => new
            {
                Domain = g.Key,
                Correct = g.Count(x => x.IsCorrect),
                Total = g.Count()
            })
            .ToList();

        var cohortDomainStats = await _db.Responses
            .AsNoTracking()
            .Where(r => r.TestSession.Status == TestSessionStatuses.Completed)
            .SelectMany(r => r.Question.DomainTags.Select(t => new { t.DomainName, r.IsCorrect }))
            .GroupBy(x => x.DomainName)
            .Select(g => new
            {
                Domain = g.Key,
                Correct = g.Count(x => x.IsCorrect),
                Total = g.Count()
            })
            .ToListAsync();

        var cohortMap = cohortDomainStats.ToDictionary(x => x.Domain, x => x);

        var radarStats = userDomainStats
            .OrderByDescending(x => x.Total)
            .ThenByDescending(x => x.Total > 0 ? (double)x.Correct / x.Total : 0)
            .Take(6)
            .Select(x =>
            {
                var cohort = cohortMap.GetValueOrDefault(x.Domain);
                var userPct = x.Total > 0 ? (x.Correct * 100.0 / x.Total) : 0.0;
                var cohortPct = cohort != null && cohort.Total > 0
                    ? (cohort.Correct * 100.0 / cohort.Total)
                    : userPct;
                return new
                {
                    subject = x.Domain,
                    A = Math.Round(userPct, 1),
                    B = Math.Round(cohortPct, 1),
                    fullMark = 100
                };
            })
            .ToList();

        return new
        {
            radarStats = radarStats,
            abilityHistory = abilityHistory,
            currentTheta = Math.Round(latest.ThetaEstimate, 2),
            percentile = Math.Round(latest.PercentileRank, 1),
            sem = Math.Round(sem, 3),
            confidenceInterval = new[] { Math.Round(ciLow, 2), Math.Round(ciHigh, 2) }
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Exam-Level Analytics
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Full exam analytics for an instructor: item analysis, point-biserial,
    /// distractor analysis, TIF curve, student results, and ML model status.
    /// </summary>
    public async Task<object?> GetExamAnalyticsAsync(int examId)
    {
        var exam = await _db.Exams
            .AsNoTracking()
            .Include(e => e.Questions).ThenInclude(q => q.Options)
            .Include(e => e.Questions).ThenInclude(q => q.DomainTags)
            .Include(e => e.QuestionPoolItems).ThenInclude(x => x.Question).ThenInclude(q => q.Options)
            .Include(e => e.QuestionPoolItems).ThenInclude(x => x.Question).ThenInclude(q => q.DomainTags)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null) return null;

        var effectiveQuestions = GetEffectiveQuestions(exam);

        var sessions = await GetCompletedSessionsAsync(examId);
        int totalSessions = sessions.Count;

        if (totalSessions == 0)
        {
            return CreateEmptyAnalyticsResult(exam, effectiveQuestions);
        }

        double avgTheta = sessions.Average(s => s.ThetaEstimate);
        double avgIntegrity = sessions.Average(s => s.IntegrityScore);
        double avgPercentile = sessions.Average(s => s.PercentileRank);

        // Fetch flattened response data using a JOIN to avoid IN clause performance issues
        var responsesList = await GetResponsesWithThetaAsync(examId);

        var itemAnalysis = ComputeItemAnalysis(effectiveQuestions, responsesList, avgTheta);
        var (tifData, reliabilityCurve) = ComputeTIFAndReliability(effectiveQuestions);
        var reliabilityMetrics = ComputeCohortReliability(sessions, exam, effectiveQuestions, responsesList);
        var integrityHistogram = ComputeIntegrityHistogram(sessions);

        var mlStatus = _anomaly.GetModelStatus(examId);

        return new
        {
            ExamId = exam.Id,
            exam.Title,
            exam.IsAdaptive,
            TotalSessions = totalSessions,
            AvgTheta = Math.Round(avgTheta, 3),
            AvgIntegrity = Math.Round(avgIntegrity, 1),
            AvgPercentile = Math.Round(avgPercentile, 1),
            TotalQuestions = effectiveQuestions.Count,
            ItemAnalysis = itemAnalysis,
            StudentResults = FormatStudentResults(sessions),
            TestInformationFunction = tifData,
            ReliabilityCurve = reliabilityCurve,
            CohortSummary = new
            {
                ThetaVariance = reliabilityMetrics.ThetaVariance.HasValue ? Math.Round(reliabilityMetrics.ThetaVariance.Value, 6) : (double?)null,
                MeanSEM = reliabilityMetrics.MeanSem.HasValue ? Math.Round(reliabilityMetrics.MeanSem.Value, 4) : (double?)null
            },
            Reliability = new
            {
                AdaptiveMarginalReliability = reliabilityMetrics.AdaptiveMarginalReliability.HasValue ? Math.Round(reliabilityMetrics.AdaptiveMarginalReliability.Value, 4) : (double?)null,
                CronbachAlpha = reliabilityMetrics.CronbachAlpha.HasValue ? Math.Round(reliabilityMetrics.CronbachAlpha.Value, 4) : (double?)null,
                CronbachAlphaSessionsUsed = reliabilityMetrics.AlphaSessionsUsed,
                CronbachAlphaItemsUsed = reliabilityMetrics.AlphaItemsUsed
            },
            IntegrityHistogram = integrityHistogram,
            AnomalyModel = new
            {
                mlStatus.IsTrained,
                mlStatus.TrainedOnSessionCount,
                MinSessionsRequired = AnomalyDetectionService.MinSessionsForTraining
            }
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Internal Computation Methods
    // ─────────────────────────────────────────────────────────────

    private List<Question> GetEffectiveQuestions(Exam exam)
    {
        return exam.QuestionPoolItems.Count > 0
            ? exam.QuestionPoolItems
                .OrderBy(x => x.FixedFormOrder ?? int.MaxValue)
                .ThenBy(x => x.AttachedAt)
                .Select(x => x.Question)
                .Concat(exam.Questions)
                .GroupBy(q => q.Id)
                .Select(g => g.First())
                .ToList()
            : exam.Questions
                .GroupBy(q => q.Id)
                .Select(g => g.First())
                .ToList();
    }

    private async Task<List<TestSession>> GetCompletedSessionsAsync(int examId)
    {
        return await _db.TestSessions
            .AsNoTracking()
            .Where(s => s.ExamId == examId && s.Status == TestSessionStatuses.Completed)
            .Include(s => s.User)
            .ToListAsync();
    }

    /// <summary>
    /// Fetches responses using an explicit join to avoid massive IN clauses.
    /// </summary>
    private async Task<List<ResponseDataDto>> GetResponsesWithThetaAsync(int examId)
    {
        return await _db.TestSessions
            .AsNoTracking()
            .Where(s => s.ExamId == examId && s.Status == TestSessionStatuses.Completed)
            .Join(
                _db.Responses.AsNoTracking(),
                session => session.Id,
                response => response.TestSessionId,
                (session, response) => new ResponseDataDto
                {
                    TestSessionId = session.Id,
                    FinalTheta = session.ThetaEstimate, // For point-biserial
                    QuestionId = response.QuestionId,
                    SelectedOptionId = response.SelectedOptionId,
                    IsCorrect = response.IsCorrect,
                    TimeTakenMs = response.TimeTakenMs,
                    ThetaAtTime = response.ThetaAtTime  // For distractor analysis
                }
            )
            .ToListAsync();
    }

    private List<object> ComputeItemAnalysis(
        List<Question> questions,
        List<ResponseDataDto> allResponses,
        double avgCohortTheta)
    {
        // Group responses by QuestionId in memory
        var responseMap = allResponses
            .GroupBy(r => r.QuestionId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return questions.Select(q =>
        {
            var rForQ = responseMap.GetValueOrDefault(q.Id) ?? new List<ResponseDataDto>();

            var totalAnswered = rForQ.Count;
            var totalCorrect = rForQ.Count(r => r.IsCorrect);
            var pValue = totalAnswered > 0 ? (double)totalCorrect / totalAnswered : 0;
            var avgTime = totalAnswered > 0 ? rForQ.Average(r => r.TimeTakenMs) : 0;

            // Correct Point-Biserial calculation: r_pbis = ((M1 - M0) / S_x) * sqrt((n1 * n0) / (n * (n-1)))
            // Note: Many sources use ((M1 - Mx) / Sx) * sqrt(p/q), combining standard deviations.
            // A more standard operational version uses Pearson correlation between dichotomous (0/1) and continuous scores.
            double pbis = ComputePointBiserialCorrelation(rForQ);

            // Options analysis
            var correctOptionId = q.Options.FirstOrDefault(o => o.IsCorrect)?.Id;
            var correctAvgThetaAtTime = correctOptionId.HasValue
                ? rForQ.Where(r => r.SelectedOptionId == correctOptionId.Value).Select(r => (double?)r.ThetaAtTime).Average()
                : null;

            var distractorAnalysis = q.Options.Select(o =>
            {
                var selectionCount = rForQ.Count(r => r.SelectedOptionId == o.Id);
                var selectionRate = totalAnswered > 0 ? (double)selectionCount / totalAnswered : 0;
                var avgThetaAtSelection = selectionCount > 0
                    ? rForQ.Where(r => r.SelectedOptionId == o.Id).Average(r => r.ThetaAtTime)
                    : (double?)null;

                // Better distractor flagging: chosen reasonably often by above-average students
                var isHighAbilityDistractor =
                    !o.IsCorrect &&
                    selectionCount >= 3 &&
                    selectionRate >= 0.05 &&
                    avgThetaAtSelection.HasValue &&
                    (
                        avgThetaAtSelection.Value >= avgCohortTheta + 0.5 ||
                        (correctAvgThetaAtTime.HasValue && avgThetaAtSelection.Value >= correctAvgThetaAtTime.Value - 0.15)
                    );

                return new
                {
                    o.Id,
                    o.OptionText,
                    o.IsCorrect,
                    SelectionCount = selectionCount,
                    SelectionRate = totalAnswered > 0 ? Math.Round(selectionRate * 100, 1) : 0,
                    AvgThetaAtSelection = avgThetaAtSelection.HasValue ? Math.Round(avgThetaAtSelection.Value, 3) : (double?)null,
                    IsHighAbilityDistractor = isHighAbilityDistractor
                };
            }).ToList();

            return new
            {
                q.Id,
                q.QuestionText,
                q.IRT_Difficulty,
                q.IRT_Discrimination,
                q.DifficultyLabel,
                q.IsCalibrated,
                TotalAnswered = totalAnswered,
                TotalCorrect = totalCorrect,
                PValue = Math.Round(pValue, 3),
                PointBiserial = Math.Round(pbis, 3), // Fixed
                AvgTimeTakenMs = Math.Round(avgTime),
                Domains = q.DomainTags.Select(t => $"{t.DomainName}/{t.SubDomain}").ToList(),
                Distractors = distractorAnalysis
            };
        }).Cast<object>().ToList();
    }

    /// <summary>
    /// Computes Pearson Point-Biserial Correlation between correctness (0/1) and Final Theta.
    /// </summary>
    private double ComputePointBiserialCorrelation(List<ResponseDataDto> responses)
    {
        if (responses.Count < 3) return 0; // Not enough data variance

        int n1 = responses.Count(r => r.IsCorrect);
        int n0 = responses.Count - n1;

        if (n1 == 0 || n0 == 0) return 0; // No variance in scores

        double m1 = responses.Where(r => r.IsCorrect).Average(r => r.FinalTheta);
        double m0 = responses.Where(r => !r.IsCorrect).Average(r => r.FinalTheta);

        // Standard Deviation of all thetas for this item's responses
        double meanTotal = responses.Average(r => r.FinalTheta);
        double sumSqTotal = responses.Sum(r => Math.Pow(r.FinalTheta - meanTotal, 2));

        // Sample standard deviation
        double sx = Math.Sqrt(sumSqTotal / (responses.Count - 1));
        if (sx == 0) return 0;

        // Formula: ((M1 - M0) / Sx) * sqrt((n1 * n0) / (n * (n-1)))
        double pbis = ((m1 - m0) / sx) * Math.Sqrt(((double)n1 * n0) / ((double)responses.Count * (responses.Count - 1)));

        // Handle floating point edge cases
        if (double.IsNaN(pbis) || double.IsInfinity(pbis)) return 0;
        return pbis;
    }

    private (List<object> tifData, List<object> reliabilityCurve) ComputeTIFAndReliability(List<Question> questions)
    {
        var tifData = new List<object>();
        var reliabilityCurve = new List<object>();

        // Use bound settings rather than hardcoded [-4, 4]
        for (double theta = _irtSettings.ThetaMin; theta <= _irtSettings.ThetaMax; theta += 0.25)
        {
            double totalInfo = 0;
            foreach (var q in questions)
            {
                // Rely on IRTEngine for numerical stability (prevents NaN from Math.Exp overflows)
                double p = IRTEngine.ProbCorrect(theta, q.IRT_Difficulty, q.IRT_Discrimination);
                totalInfo += (q.IRT_Discrimination * q.IRT_Discrimination) * p * (1 - p);
            }

            tifData.Add(new { Theta = Math.Round(theta, 2), Information = Math.Round(totalInfo, 4) });

            var semAtTheta = totalInfo > 0 ? 1.0 / Math.Sqrt(totalInfo) : (double?)null;
            var reliabilityAtTheta = totalInfo > 0 ? totalInfo / (totalInfo + 1.0) : 0;
            reliabilityCurve.Add(new
            {
                Theta = Math.Round(theta, 2),
                SEM = semAtTheta.HasValue ? Math.Round(semAtTheta.Value, 4) : (double?)null,
                Reliability = Math.Round(reliabilityAtTheta, 4)
            });
        }

        return (tifData, reliabilityCurve);
    }

    private ReliabilityMetricsRecord ComputeCohortReliability(
        List<TestSession> sessions,
        Exam exam,
        List<Question> questions,
        List<ResponseDataDto> responsesList)
    {
        var metrics = new ReliabilityMetricsRecord();

        if (sessions.Count < 2) return metrics;

        var thetaValues = sessions.Select(s => s.ThetaEstimate).ToList();
        metrics.ThetaVariance = SampleVariance(thetaValues);

        var semValues = sessions.Select(s => s.ThetaSEM).Where(x => x > 0).ToList();
        if (semValues.Count > 0)
        {
            metrics.MeanSem = semValues.Average();
            var meanSemSq = semValues.Average(x => x * x);

            if (metrics.ThetaVariance > 0)
            {
                metrics.AdaptiveMarginalReliability = Math.Clamp(1.0 - (meanSemSq / metrics.ThetaVariance.Value), 0, 1);
            }
        }

        // Cronbach's Alpha (Only for Fixed-Form items, if enough sessions)
        if (!exam.IsAdaptive && sessions.Count >= 2 && questions.Count >= 2)
        {
            metrics.AlphaItemsUsed = questions.Count;

            var questionIndex = questions
                .Select((q, idx) => (q.Id, idx))
                .ToDictionary(x => x.Id, x => x.idx);

            var sessionVectors = new List<double[]>();
            var groupedResponses = responsesList.GroupBy(r => r.TestSessionId);

            foreach (var group in groupedResponses)
            {
                var vec = new double[metrics.AlphaItemsUsed];
                Array.Fill(vec, double.NaN);

                foreach (var r in group)
                {
                    if (!questionIndex.TryGetValue(r.QuestionId, out var idx)) continue;
                    vec[idx] = r.IsCorrect ? 1.0 : 0.0;
                }

                if (!vec.Any(double.IsNaN))
                    sessionVectors.Add(vec);
            }

            metrics.AlphaSessionsUsed = sessionVectors.Count;
            if (metrics.AlphaSessionsUsed >= 2)
            {
                var totalScores = sessionVectors.Select(v => v.Sum()).ToList();
                var totalVar = SampleVariance(totalScores);

                if (totalVar > 0)
                {
                    var itemVarSum = 0.0;
                    for (var j = 0; j < metrics.AlphaItemsUsed; j++)
                    {
                        var itemScores = sessionVectors.Select(v => v[j]).ToList();
                        itemVarSum += SampleVariance(itemScores);
                    }

                    var alpha = (metrics.AlphaItemsUsed / (double)(metrics.AlphaItemsUsed - 1)) * (1.0 - (itemVarSum / totalVar));
                    metrics.CronbachAlpha = Math.Clamp(alpha, 0, 1);
                }
            }
        }

        return metrics;
    }

    private List<object> ComputeIntegrityHistogram(List<TestSession> sessions)
    {
        var integrityCounts = new int[10];
        var integrityFlaggedCounts = new int[10];

        foreach (var s in sessions)
        {
            var score = Math.Clamp(s.IntegrityScore, 0, 100);
            var idx = Math.Min(9, (int)(score / 10));
            integrityCounts[idx]++;

            var isFlagged = (s.IntegrityLabel == "Low") || ((s.AnomalyScore ?? 0) >= 0.75);
            if (isFlagged) integrityFlaggedCounts[idx]++;
        }

        return Enumerable.Range(0, 10)
            .Select(i => new
            {
                BinStart = i * 10,
                BinEnd = (i + 1) * 10,
                Count = integrityCounts[i],
                FlaggedCount = integrityFlaggedCounts[i]
            })
            .Cast<object>()
            .ToList();
    }

    private List<object> FormatStudentResults(List<TestSession> sessions)
    {
        // Avoid N+1 mapping properties in select loop
        return sessions.Select(s => new
        {
            s.Id,
            s.User.FullName,
            s.User.Email,
            s.ThetaEstimate,
            s.ThetaSEM,
            s.PercentileRank,
            s.TotalCorrect,
            s.TotalQuestions,
            s.IntegrityScore,
            s.IntegrityLabel,
            s.AnomalyScore,
            s.StartedAt,
            s.CompletedAt,
            DurationMinutes = s.CompletedAt.HasValue
                ? Math.Round((s.CompletedAt.Value - s.StartedAt).TotalMinutes, 1)
                : 0
        }).OrderByDescending(s => s.ThetaEstimate).Cast<object>().ToList();
    }

    private object CreateEmptyAnalyticsResult(Exam exam, List<Question> effectiveQuestions)
    {
        var mlStatus = _anomaly.GetModelStatus(exam.Id);
        var (tifData, reliabilityCurve) = ComputeTIFAndReliability(effectiveQuestions);

        return new
        {
            ExamId = exam.Id,
            exam.Title,
            exam.IsAdaptive,
            TotalSessions = 0,
            AvgTheta = 0.0,
            AvgIntegrity = 0.0,
            AvgPercentile = 0.0,
            TotalQuestions = effectiveQuestions.Count,
            ItemAnalysis = new List<object>(),
            StudentResults = new List<object>(),
            TestInformationFunction = tifData,
            ReliabilityCurve = reliabilityCurve,
            CohortSummary = new { ThetaVariance = (double?)null, MeanSEM = (double?)null },
            Reliability = new
            {
                AdaptiveMarginalReliability = (double?)null,
                CronbachAlpha = (double?)null,
                CronbachAlphaSessionsUsed = 0,
                CronbachAlphaItemsUsed = 0
            },
            IntegrityHistogram = Enumerable.Range(0, 10).Select(i => new { BinStart = i * 10, BinEnd = (i + 1) * 10, Count = 0, FlaggedCount = 0 }).ToList(),
            AnomalyModel = new
            {
                mlStatus.IsTrained,
                mlStatus.TrainedOnSessionCount,
                MinSessionsRequired = AnomalyDetectionService.MinSessionsForTraining
            }
        };
    }

    private static double SampleVariance(IReadOnlyList<double> values)
    {
        if (values.Count < 2) return 0;
        var mean = values.Average();
        double sumSq = 0;
        for (var i = 0; i < values.Count; i++)
        {
            var d = values[i] - mean;
            sumSq += d * d;
        }
        return sumSq / (values.Count - 1);
    }

    // ─────────────────────────────────────────────────────────────
    // Instructor Dashboard & Admin Overview (Unchanged logic, optimized selects where needed)
    // ─────────────────────────────────────────────────────────────

    // DTO for response data flattened into memory
    private class ResponseDataDto
    {
        public int TestSessionId { get; set; }
        public double FinalTheta { get; set; }
        public int QuestionId { get; set; }
        public int? SelectedOptionId { get; set; }
        public bool IsCorrect { get; set; }
        public long TimeTakenMs { get; set; }
        public double ThetaAtTime { get; set; }
    }

    private class ReliabilityMetricsRecord
    {
        public double? ThetaVariance { get; set; }
        public double? MeanSem { get; set; }
        public double? AdaptiveMarginalReliability { get; set; }
        public double? CronbachAlpha { get; set; }
        public int AlphaSessionsUsed { get; set; }
        public int AlphaItemsUsed { get; set; }
    }


    /// <summary>
    /// Instructor dashboard metrics: exam stats, flagged sessions,
    /// integrity/theta distributions, question bank health, volume trends.
    /// </summary>
    public async Task<object> GetInstructorDashboardAsync(string userId)
    {
        var myExams = await _db.Exams
            .AsNoTracking()
            .Where(e => e.CreatedById == userId)
            .Include(e => e.Questions)
            .Include(e => e.QuestionPoolItems).ThenInclude(x => x.Question)
            .ToListAsync();

        var examIds = myExams.Select(e => e.Id).ToList();

        var mySessions = await GetCompletedSessionsForDashboard(examIds);

        var totalQuestions = myExams.Sum(e =>
            e.QuestionPoolItems.Count > 0
                ? e.QuestionPoolItems.Select(x => x.QuestionId).Distinct().Count()
                : e.Questions.Select(q => q.Id).Distinct().Count());
        var activeExams = myExams.Count(e => e.Status == ExamStatuses.Published);

        var totalStudentsTested = mySessions.Select(s => s.UserId).Distinct().Count();
        var avgIntegrity = mySessions.Count > 0 ? mySessions.Average(s => s.IntegrityScore) : 100;

        return new
        {
            Stats = new
            {
                TotalExams = myExams.Count,
                ActiveExams = activeExams,
                TotalQuestions = totalQuestions,
                TotalStudentsTested = totalStudentsTested,
                AvgClassIntegrity = Math.Round(avgIntegrity, 1)
            },
            RecentExams = GetRecentExams(myExams, mySessions),
            FlaggedSessions = GetFlaggedSessions(mySessions),
            IntegrityDistribution = GetIntegrityDistribution(mySessions),
            ThetaDistribution = GetThetaDistribution(mySessions),
            QuestionBankHealth = GetQuestionBankHealth(myExams),
            VolumeLast7Days = GetVolumeLast7Days(mySessions)
        };
    }

    private async Task<List<TestSession>> GetCompletedSessionsForDashboard(List<int> examIds)
    {
        return await _db.TestSessions
            .AsNoTracking()
            .Where(s => examIds.Contains(s.ExamId) && s.Status == TestSessionStatuses.Completed)
            .Include(s => s.User)
            .Include(s => s.Exam)
            .ToListAsync();
    }


    private List<object> GetIntegrityDistribution(List<TestSession> sessions)
    {
        return new List<object>
        {
            new { Range = "0-20",   Count = sessions.Count(s => s.IntegrityScore <= 20) },
            new { Range = "21-40",  Count = sessions.Count(s => s.IntegrityScore > 20  && s.IntegrityScore <= 40) },
            new { Range = "41-60",  Count = sessions.Count(s => s.IntegrityScore > 40  && s.IntegrityScore <= 60) },
            new { Range = "61-80",  Count = sessions.Count(s => s.IntegrityScore > 60  && s.IntegrityScore <= 80) },
            new { Range = "81-100", Count = sessions.Count(s => s.IntegrityScore > 80  && s.IntegrityScore <= 100) }
        };
    }

    private List<object> GetThetaDistribution(List<TestSession> sessions)
    {
        return new List<object>
        {
            new { Range = "-3 to -2", Count = sessions.Count(s => s.ThetaEstimate >= -3 && s.ThetaEstimate < -2) },
            new { Range = "-2 to -1", Count = sessions.Count(s => s.ThetaEstimate >= -2 && s.ThetaEstimate < -1) },
            new { Range = "-1 to 0",  Count = sessions.Count(s => s.ThetaEstimate >= -1 && s.ThetaEstimate <  0) },
            new { Range = "0 to 1",   Count = sessions.Count(s => s.ThetaEstimate >=  0 && s.ThetaEstimate <  1) },
            new { Range = "1 to 2",   Count = sessions.Count(s => s.ThetaEstimate >=  1 && s.ThetaEstimate <  2) },
            new { Range = "2 to 3",   Count = sessions.Count(s => s.ThetaEstimate >=  2 && s.ThetaEstimate <= 3) }
        };
    }

    private List<object> GetQuestionBankHealth(List<Exam> exams)
    {
        return exams.Select(e =>
        {
            var qs = e.QuestionPoolItems.Count > 0
                ? e.QuestionPoolItems.Select(x => x.Question).ToList()
                : e.Questions.ToList();

            return new
            {
                ExamName = e.Title,
                AvgDiscrimination = qs.Count > 0
                    ? Math.Round(qs.Average(q => q.IRT_Discrimination), 2)
                    : 0
            };
        }).OrderByDescending(x => x.AvgDiscrimination).Cast<object>().ToList();
    }

    private List<object> GetVolumeLast7Days(List<TestSession> sessions)
    {
        var today = DateTime.UtcNow.Date;
        return Enumerable.Range(0, 7)
            .Select(offset => today.AddDays(-6 + offset))
            .Select(date => new
            {
                Date = date.ToString("MMM dd"),
                Submissions = sessions.Count(s => s.CompletedAt.HasValue && s.CompletedAt.Value.Date == date)
            })
            .Cast<object>()
            .ToList();
    }

    private List<object> GetFlaggedSessions(List<TestSession> sessions)
    {
        return sessions
            .Where(s => s.IntegrityLabel == "Low" || s.IntegrityScore < 70)
            .OrderByDescending(s => s.CompletedAt)
            .Take(5)
            .Select(s => new
            {
                SessionId = s.Id,
                ExamId = s.ExamId,
                StudentName = s.User.FullName,
                ExamTitle = s.Exam.Title,
                Date = s.CompletedAt?.ToString("MM/dd/yyyy"),
                TrustScore = $"{Math.Round(s.IntegrityScore)}%",
                Status = s.IntegrityLabel == "Low" ? "Critical" : "Warning",
                Color = s.IntegrityLabel == "Low" ? "var(--danger)" : "#f59e0b"
            }).Cast<object>().ToList();
    }

    private List<object> GetRecentExams(List<Exam> exams, List<TestSession> sessions)
    {
        return exams
            .OrderByDescending(e => e.CreatedAt)
            .Take(4)
            .Select(e => new
            {
                e.Id,
                e.Title,
                e.IsAdaptive,
                QuestionCount = e.QuestionPoolItems.Count > 0
                    ? e.QuestionPoolItems.Select(x => x.QuestionId).Distinct().Count()
                    : e.Questions.Select(q => q.Id).Distinct().Count(),
                e.Status,
                CompletedSessions = sessions.Count(s => s.ExamId == e.Id)
            }).Cast<object>().ToList();
    }

    /// <summary>
    /// Admin-level platform overview: total users, exams, sessions,
    /// average integrity, flagged sessions, and recent activity.
    /// </summary>
    public async Task<object> GetPlatformOverviewAsync()
    {
        var totalUsers = await _db.Users.CountAsync();
        var totalExams = await _db.Exams.CountAsync();
        var totalSessions = await _db.TestSessions.CountAsync();
        var completedSessions = await _db.TestSessions.CountAsync(s => s.Status == TestSessionStatuses.Completed);

        var avgIntegrity = completedSessions > 0
            ? await _db.TestSessions
                .Where(s => s.Status == TestSessionStatuses.Completed)
                .AverageAsync(s => s.IntegrityScore)
            : 0;

        var flaggedSessions = await _db.TestSessions
            .CountAsync(s => s.Status == TestSessionStatuses.Completed && s.IntegrityLabel == "Low");

        var recentSessions = await _db.TestSessions
            .AsNoTracking()
            .Where(s => s.Status == TestSessionStatuses.Completed)
            .OrderByDescending(s => s.CompletedAt)
            .Take(10)
            .Include(s => s.User)
            .Include(s => s.Exam)
            .Select(s => new
            {
                s.Id,
                StudentName = s.User.FullName,
                ExamTitle = s.Exam.Title,
                s.ThetaEstimate,
                s.PercentileRank,
                s.IntegrityScore,
                s.IntegrityLabel,
                s.CompletedAt
            })
            .ToListAsync();

        return new
        {
            TotalUsers = totalUsers,
            TotalExams = totalExams,
            TotalSessions = totalSessions,
            CompletedSessions = completedSessions,
            AvgIntegrity = Math.Round(avgIntegrity, 1),
            FlaggedSessions = flaggedSessions,
            RecentSessions = recentSessions
        };
    }
}
