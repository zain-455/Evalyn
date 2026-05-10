using Evalyn.API.Data;
using Evalyn.API.Constants;
using Evalyn.API.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Evalyn.API.Services;

/// <summary>
/// IRT Item Calibration Service — batch re-estimation of item parameters
/// (difficulty <c>b</c> and discrimination <c>a</c>) from accumulated response data.
///
/// Uses a simplified Joint Maximum Likelihood Estimation (JMLE) approach:
/// 1. Fix student abilities (θ) at their MAP/MLE estimates from the adaptive engine.
/// 2. For each question, estimate <c>b</c> and <c>a</c> by maximizing the likelihood
///    of the observed response pattern given the fixed θ values.
///
/// This is the standard "online calibration" model used by large-scale CAT systems
/// (GRE, GMAT) for field-testing new questions alongside operational items.
///
/// <b>Minimum data requirement:</b> A question must have ≥ 30 responses before
/// calibration is attempted. Below this, parameter estimates are unstable.
/// </summary>
public class CalibrationService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CalibrationService> _logger;

    /// <summary>Minimum responses required before a question can be calibrated.</summary>
    public const int MinResponsesForCalibration = 30;

    /// <summary>Maximum Newton-Raphson iterations per item.</summary>
    private const int MaxIterations = 50;

    /// <summary>Convergence criterion for parameter updates.</summary>
    private const double ConvergenceThreshold = 0.001;

    /// <summary>Valid range for difficulty parameter <c>b</c>.</summary>
    private const double MinDifficulty = -4.0;
    private const double MaxDifficulty = 4.0;

    /// <summary>Valid range for discrimination parameter <c>a</c>.</summary>
    private const double MinDiscrimination = 0.2;
    private const double MaxDiscrimination = 3.0;

    public CalibrationService(
        IServiceScopeFactory scopeFactory,
        ILogger<CalibrationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────

    /// <summary>
    /// Run calibration for all eligible questions in a specific exam.
    /// Returns a summary of how many questions were calibrated.
    /// </summary>
    public async Task<CalibrationResult> CalibrateExamAsync(int examId)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Get all questions assigned to this exam (both direct + pool)
        var exam = await db.Exams
            .Include(e => e.Questions)
            .Include(e => e.QuestionPoolItems).ThenInclude(p => p.Question)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null)
            return new CalibrationResult(0, 0, 0, "Exam not found.");

        var allQuestions = exam.Questions
            .Concat(exam.QuestionPoolItems.Select(p => p.Question))
            .DistinctBy(q => q.Id)
            .ToList();

        return await CalibrateQuestionsAsync(db, allQuestions);
    }

    /// <summary>
    /// Run calibration for all eligible questions in the global question bank.
    /// </summary>
    public async Task<CalibrationResult> CalibrateGlobalBankAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var allQuestions = await db.Questions.ToListAsync();
        return await CalibrateQuestionsAsync(db, allQuestions);
    }

    /// <summary>
    /// Calibrate a single question by ID.
    /// </summary>
    public async Task<SingleItemCalibrationResult> CalibrateQuestionAsync(int questionId)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var question = await db.Questions.FindAsync(questionId);
        if (question == null)
            return new SingleItemCalibrationResult(false, "Question not found.", null);

        var responses = await GetResponsesWithTheta(db, questionId);
        if (responses.Count < MinResponsesForCalibration)
        {
            return new SingleItemCalibrationResult(
                false,
                $"Insufficient data: {responses.Count} responses (need {MinResponsesForCalibration}).",
                new ItemCalibrationDetail(
                    question.Id, question.QuestionText,
                    question.IRT_Difficulty, question.IRT_Discrimination,
                    question.IRT_Difficulty, question.IRT_Discrimination,
                    responses.Count, false, "Insufficient responses"));
        }

        var result = EstimateParameters(responses, question.IRT_Difficulty, question.IRT_Discrimination);

        // Apply the calibrated parameters
        question.IRT_Difficulty = result.Difficulty;
        question.IRT_Discrimination = result.Discrimination;
        question.IsCalibrated = true;
        question.TimesAdministered = responses.Count;
        question.TimesCorrect = responses.Count(r => r.IsCorrect);

        // Update difficulty label based on new difficulty
        question.DifficultyLabel = result.Difficulty switch
        {
            < -1.5 => "Easy",
            > 1.5 => "Hard",
            _ => "Medium"
        };

        await db.SaveChangesAsync();

        _logger.LogInformation(
            "Calibrated question {Id}: b={Difficulty:F3}, a={Discrimination:F3} from {N} responses.",
            question.Id, result.Difficulty, result.Discrimination, responses.Count);

        return new SingleItemCalibrationResult(true, "Calibrated successfully.", result.Detail);
    }

    // ─────────────────────────────────────────────────────
    // Core IRT Parameter Estimation
    // ─────────────────────────────────────────────────────

    /// <summary>
    /// Estimate difficulty (b) and discrimination (a) for one item using
    /// Joint MLE with fixed theta values.
    ///
    /// Uses Newton-Raphson optimization on the 2PL log-likelihood:
    ///   L(a,b) = Σ [ u_i * log(P_i) + (1-u_i) * log(1-P_i) ]
    /// where P_i = 1 / (1 + exp(-a(θ_i - b)))
    /// </summary>
    private EstimationResult EstimateParameters(
        List<ResponseData> responses, double initialB, double initialA)
    {
        double b = initialB;
        double a = initialA;

        for (int iter = 0; iter < MaxIterations; iter++)
        {
            // Compute gradient and Hessian for (a, b)
            double dL_da = 0, dL_db = 0;
            double d2L_da2 = 0, d2L_db2 = 0, d2L_dadb = 0;

            foreach (var r in responses)
            {
                double z = a * (r.Theta - b);
                double p = Sigmoid(z);
                double q = 1.0 - p;
                double u = r.IsCorrect ? 1.0 : 0.0;
                double residual = u - p; // (u - P)

                double thetaMinusB = r.Theta - b;

                // Gradients
                dL_da += residual * thetaMinusB;
                dL_db += residual * (-a);

                // Hessian diagonals (using expected information for stability)
                double pq = p * q;
                d2L_da2 -= pq * thetaMinusB * thetaMinusB;
                d2L_db2 -= pq * a * a;
                d2L_dadb -= pq * (-a) * thetaMinusB;
            }

            // Add weak prior to prevent extreme estimates
            // Prior: a ~ Normal(1.0, 0.5), b ~ Normal(0.0, 2.0)
            double priorA_mean = 1.0, priorA_var = 0.25;
            double priorB_mean = 0.0, priorB_var = 4.0;

            dL_da -= (a - priorA_mean) / priorA_var;
            dL_db -= (b - priorB_mean) / priorB_var;
            d2L_da2 -= 1.0 / priorA_var;
            d2L_db2 -= 1.0 / priorB_var;

            // Solve 2x2 Newton-Raphson system:  [da, db] = -H^(-1) * g
            double det = d2L_da2 * d2L_db2 - d2L_dadb * d2L_dadb;

            if (Math.Abs(det) < 1e-12)
            {
                // Hessian is singular — fall back to gradient ascent with small step
                double step = 0.01;
                a += step * dL_da;
                b += step * dL_db;
            }
            else
            {
                double invDet = 1.0 / det;
                double da = -(d2L_db2 * dL_da - d2L_dadb * dL_db) * invDet;
                double db = -(d2L_da2 * dL_db - d2L_dadb * dL_da) * invDet;

                // Dampen step size for stability
                double maxStep = 0.5;
                da = Math.Max(-maxStep, Math.Min(maxStep, da));
                db = Math.Max(-maxStep, Math.Min(maxStep, db));

                a += da;
                b += db;
            }

            // Clamp to valid ranges
            a = Math.Max(MinDiscrimination, Math.Min(MaxDiscrimination, a));
            b = Math.Max(MinDifficulty, Math.Min(MaxDifficulty, b));

            // Check convergence
            if (Math.Abs(dL_da) < ConvergenceThreshold && Math.Abs(dL_db) < ConvergenceThreshold)
            {
                _logger.LogDebug("Converged in {Iter} iterations.", iter + 1);
                break;
            }
        }

        // Compute standard errors from Fisher Information
        double seA = 0, seB = 0;
        double info_aa = 0, info_bb = 0;
        foreach (var r in responses)
        {
            double z = a * (r.Theta - b);
            double p = Sigmoid(z);
            double pq = p * (1.0 - p);
            info_aa += pq * (r.Theta - b) * (r.Theta - b);
            info_bb += pq * a * a;
        }
        seA = info_aa > 0 ? 1.0 / Math.Sqrt(info_aa) : double.NaN;
        seB = info_bb > 0 ? 1.0 / Math.Sqrt(info_bb) : double.NaN;

        return new EstimationResult(
            Math.Round(a, 4),
            Math.Round(b, 4),
            new ItemCalibrationDetail(
                0, "", // filled by caller
                initialB, initialA,
                Math.Round(b, 4), Math.Round(a, 4),
                responses.Count, true,
                $"SE(a)={seA:F4}, SE(b)={seB:F4}"));
    }

    // ─────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────

    private async Task<CalibrationResult> CalibrateQuestionsAsync(
        AppDbContext db, List<Question> questions)
    {
        int attempted = 0, calibrated = 0, skipped = 0;
        var details = new List<ItemCalibrationDetail>();

        foreach (var question in questions)
        {
            var responses = await GetResponsesWithTheta(db, question.Id);

            if (responses.Count < MinResponsesForCalibration)
            {
                skipped++;
                details.Add(new ItemCalibrationDetail(
                    question.Id, question.QuestionText,
                    question.IRT_Difficulty, question.IRT_Discrimination,
                    question.IRT_Difficulty, question.IRT_Discrimination,
                    responses.Count, false,
                    $"Only {responses.Count}/{MinResponsesForCalibration} responses"));
                continue;
            }

            attempted++;
            var result = EstimateParameters(responses, question.IRT_Difficulty, question.IRT_Discrimination);

            // Apply calibrated parameters
            question.IRT_Difficulty = result.Difficulty;
            question.IRT_Discrimination = result.Discrimination;
            question.IsCalibrated = true;
            question.TimesAdministered = responses.Count;
            question.TimesCorrect = responses.Count(r => r.IsCorrect);
            question.DifficultyLabel = result.Difficulty switch
            {
                < -1.5 => "Easy",
                > 1.5 => "Hard",
                _ => "Medium"
            };

            var detail = result.Detail with
            {
                QuestionId = question.Id,
                QuestionText = question.QuestionText
            };
            details.Add(detail);
            calibrated++;
        }

        await db.SaveChangesAsync();

        _logger.LogInformation(
            "Calibration complete: {Calibrated} calibrated, {Skipped} skipped (insufficient data), {Total} total.",
            calibrated, skipped, questions.Count);

        return new CalibrationResult(
            calibrated, skipped, questions.Count,
            $"Calibrated {calibrated} items, skipped {skipped} (need ≥{MinResponsesForCalibration} responses).",
            details);
    }

    private static async Task<List<ResponseData>> GetResponsesWithTheta(AppDbContext db, int questionId)
    {
        return await db.Responses
            .AsNoTracking()
            .Where(r => r.QuestionId == questionId
                     && r.TestSession.Status == TestSessionStatuses.Completed)
            .Select(r => new ResponseData(r.IsCorrect, r.ThetaAtTime))
            .ToListAsync();
    }

    private static double Sigmoid(double z)
    {
        if (z > 20) return 1.0;
        if (z < -20) return 0.0;
        return 1.0 / (1.0 + Math.Exp(-z));
    }

    // ─────────────────────────────────────────────────────
    // DTOs
    // ─────────────────────────────────────────────────────

    private record EstimationResult(double Discrimination, double Difficulty, ItemCalibrationDetail Detail);
    private record ResponseData(bool IsCorrect, double Theta);
}

// ── Public result records ───────────────────────────────

/// <summary>Summary result for a batch calibration run.</summary>
public record CalibrationResult(
    int Calibrated,
    int Skipped,
    int TotalQuestions,
    string Message,
    List<ItemCalibrationDetail>? Details = null);

/// <summary>Per-item calibration detail.</summary>
public record ItemCalibrationDetail(
    int QuestionId,
    string QuestionText,
    double OldDifficulty,
    double OldDiscrimination,
    double NewDifficulty,
    double NewDiscrimination,
    int ResponseCount,
    bool WasCalibrated,
    string Notes);

/// <summary>Result for a single item calibration request.</summary>
public record SingleItemCalibrationResult(
    bool Success,
    string Message,
    ItemCalibrationDetail? Detail);
