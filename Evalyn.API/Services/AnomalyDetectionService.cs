using Evalyn.API.Data;
using Evalyn.API.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.ML;
using Microsoft.ML.Data;
using System.Collections.Concurrent;

namespace Evalyn.API.Services;

// ── ML.NET Schema ───────────────────────────────────────

/// <summary>
/// Input row fed into the ML.NET Randomized PCA anomaly detector.
/// All seven behavioral features are represented as floats.
/// </summary>
public class AnomalyInputRow
{
    public float TabSwitchesPerMinute { get; set; }
    public float PasteCount { get; set; }
    public float RightClickCount { get; set; }
    public float IdleSeconds { get; set; }
    public float FocusLostCount { get; set; }
    public float TimingCv { get; set; }
    public float MouseAngleEntropy { get; set; }
}

/// <summary>
/// Output prediction from the Randomized PCA anomaly model.
/// </summary>
public class AnomalyPrediction
{
    [ColumnName("PredictedLabel")]
    public bool IsAnomaly { get; set; }

    /// <summary>
    /// Raw anomaly score. Higher = more anomalous.
    /// The Randomized PCA trainer returns the normalized reconstruction error.
    /// </summary>
    [ColumnName("Score")]
    public float Score { get; set; }
}

// ── Service ─────────────────────────────────────────────

/// <summary>
/// ML.NET-powered anomaly detection service.
///
/// Uses Randomized PCA (an Isolation-Forest-style unsupervised anomaly
/// detector) trained on the 7-dimensional behavioral feature vectors
/// from completed test sessions.
///
/// Design:
/// - Models are trained per-exam and cached in memory.
/// - Cold-start: returns null when fewer than MinSessionsForTraining sessions exist.
/// - Auto-retrain: model retrains when session count crosses defined thresholds
///   (20, 50, 100, then every 50 after that).
/// </summary>
public class AnomalyDetectionService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MLContext _mlContext;
    private readonly ILogger<AnomalyDetectionService> _logger;

    /// <summary>Minimum completed sessions required before the ML model is trained.</summary>
    public const int MinSessionsForTraining = 20;

    /// <summary>Number of principal components retained by Randomized PCA.</summary>
    private const int PcaRank = 5;

    // Per-exam trained models: examId → (transformer, sessionCountAtTraining)
    private readonly ConcurrentDictionary<int, (ITransformer Model, int SessionCount)> _models = new();

    public AnomalyDetectionService(
        IServiceScopeFactory scopeFactory,
        ILogger<AnomalyDetectionService> logger)
    {
        _scopeFactory = scopeFactory;
        _mlContext = new MLContext(seed: 42);
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────

    /// <summary>
    /// Score a single session's behavioral features using the ML model.
    /// Returns the anomaly score (0.0–1.0) or null if the model is not
    /// yet available (cold-start).
    /// </summary>
    public async Task<double?> ScoreSessionAsync(int sessionId, int examId)
    {
        // Ensure we have a trained model for this exam
        if (!_models.TryGetValue(examId, out var entry))
        {
            // Try to train one now
            var trained = await TrainModelForExamAsync(examId);
            if (!trained) return null; // cold start
            entry = _models[examId];
        }

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var features = await db.BehavioralFeatureVectors
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.TestSessionId == sessionId);

        if (features == null) return null;

        var input = ToInputRow(features);
        var predictionEngine = _mlContext.Model.CreatePredictionEngine<AnomalyInputRow, AnomalyPrediction>(entry.Model);
        var prediction = predictionEngine.Predict(input);

        // Normalize the score to [0, 1] range
        // PCA score can vary; we clamp to [0, 1]
        double normalizedScore = Math.Max(0.0, Math.Min(1.0, prediction.Score));

        _logger.LogInformation(
            "Anomaly scored session {SessionId} (exam {ExamId}): score={Score:F4}, isAnomaly={IsAnomaly}",
            sessionId, examId, normalizedScore, prediction.IsAnomaly);

        return normalizedScore;
    }

    /// <summary>
    /// Train (or retrain) the PCA anomaly model for a specific exam.
    /// Returns true if training succeeded, false if insufficient data (cold start).
    /// </summary>
    public async Task<bool> TrainModelForExamAsync(int examId)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Get all completed sessions for this exam that have feature vectors
        var completedSessionIds = await db.TestSessions
            .Where(s => s.ExamId == examId && s.Status == Constants.TestSessionStatuses.Completed)
            .Select(s => s.Id)
            .ToListAsync();

        if (completedSessionIds.Count < MinSessionsForTraining)
        {
            _logger.LogDebug(
                "Exam {ExamId}: only {Count} completed sessions, need {Min} for ML training.",
                examId, completedSessionIds.Count, MinSessionsForTraining);
            return false;
        }

        var featureVectors = await db.BehavioralFeatureVectors
            .AsNoTracking()
            .Where(f => completedSessionIds.Contains(f.TestSessionId))
            .ToListAsync();

        if (featureVectors.Count < MinSessionsForTraining)
        {
            _logger.LogDebug(
                "Exam {ExamId}: only {Count} feature vectors available.",
                examId, featureVectors.Count);
            return false;
        }

        // Convert to ML.NET input rows
        var inputRows = featureVectors.Select(ToInputRow).ToList();
        var dataView = _mlContext.Data.LoadFromEnumerable(inputRows);

        // Build the pipeline: Normalize → Concatenate → Randomized PCA
        var pipeline = _mlContext.Transforms
            .NormalizeMeanVariance(nameof(AnomalyInputRow.TabSwitchesPerMinute))
            .Append(_mlContext.Transforms.NormalizeMeanVariance(nameof(AnomalyInputRow.PasteCount)))
            .Append(_mlContext.Transforms.NormalizeMeanVariance(nameof(AnomalyInputRow.RightClickCount)))
            .Append(_mlContext.Transforms.NormalizeMeanVariance(nameof(AnomalyInputRow.IdleSeconds)))
            .Append(_mlContext.Transforms.NormalizeMeanVariance(nameof(AnomalyInputRow.FocusLostCount)))
            .Append(_mlContext.Transforms.NormalizeMeanVariance(nameof(AnomalyInputRow.TimingCv)))
            .Append(_mlContext.Transforms.NormalizeMeanVariance(nameof(AnomalyInputRow.MouseAngleEntropy)))
            .Append(_mlContext.Transforms.Concatenate("Features",
                nameof(AnomalyInputRow.TabSwitchesPerMinute),
                nameof(AnomalyInputRow.PasteCount),
                nameof(AnomalyInputRow.RightClickCount),
                nameof(AnomalyInputRow.IdleSeconds),
                nameof(AnomalyInputRow.FocusLostCount),
                nameof(AnomalyInputRow.TimingCv),
                nameof(AnomalyInputRow.MouseAngleEntropy)))
            .Append(_mlContext.AnomalyDetection.Trainers.RandomizedPca(
                featureColumnName: "Features",
                rank: PcaRank,
                oversampling: 20,
                ensureZeroMean: true));

        _logger.LogInformation(
            "Training anomaly model for exam {ExamId} with {Count} sessions...",
            examId, featureVectors.Count);

        var model = pipeline.Fit(dataView);
        _models[examId] = (model, featureVectors.Count);

        _logger.LogInformation(
            "Anomaly model trained for exam {ExamId}. Sessions used: {Count}.",
            examId, featureVectors.Count);

        return true;
    }

    /// <summary>
    /// Check if the model should be retrained (based on session count thresholds)
    /// and trigger retraining if needed. Call this after every session completion.
    /// </summary>
    public async Task MaybeRetrainAsync(int examId)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var currentCount = await db.TestSessions
            .CountAsync(s => s.ExamId == examId && s.Status == Constants.TestSessionStatuses.Completed);

        if (currentCount < MinSessionsForTraining)
            return;

        // Determine if retraining is needed
        bool shouldRetrain;
        if (!_models.TryGetValue(examId, out var existing))
        {
            // No model yet and we have enough data — train
            shouldRetrain = true;
        }
        else
        {
            // Retrain at thresholds: 20, 50, 100, then every 50
            int trainedAt = existing.SessionCount;
            shouldRetrain = (trainedAt < 20 && currentCount >= 20)
                         || (trainedAt < 50 && currentCount >= 50)
                         || (trainedAt < 100 && currentCount >= 100)
                         || (currentCount >= 100 && currentCount - trainedAt >= 50);
        }

        if (shouldRetrain)
        {
            _logger.LogInformation(
                "Retrain triggered for exam {ExamId} (current sessions: {Count}).",
                examId, currentCount);
            await TrainModelForExamAsync(examId);
        }
    }

    /// <summary>
    /// Get the model's current status for a given exam.
    /// </summary>
    public ModelStatus GetModelStatus(int examId)
    {
        if (_models.TryGetValue(examId, out var entry))
            return new ModelStatus(true, entry.SessionCount);
        return new ModelStatus(false, 0);
    }

    // ─────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────

    private static AnomalyInputRow ToInputRow(BehavioralFeatureVector fv) => new()
    {
        TabSwitchesPerMinute = (float)fv.TabSwitchesPerMinute,
        PasteCount = fv.PasteCount,
        RightClickCount = fv.RightClickCount,
        IdleSeconds = (float)fv.IdleSeconds,
        FocusLostCount = fv.FocusLostCount,
        TimingCv = (float)fv.TimingCv,
        MouseAngleEntropy = (float)fv.MouseAngleEntropy
    };

    /// <summary>
    /// Blend the rule-based integrity score with the ML anomaly score.
    ///   - ruleScore: 0–100 from BehavioralAnalyzer
    ///   - mlAnomalyScore: 0.0–1.0 from the PCA model (higher = more anomalous)
    /// Returns a blended integrity score (0–100).
    /// </summary>
    public static double BlendScores(double ruleScore, double mlAnomalyScore)
    {
        // ML score is "anomaly": convert to "integrity" by inverting
        double mlIntegrityScore = (1.0 - mlAnomalyScore) * 100.0;

        // 60% rule-based (maintains explainability) + 40% ML (adds adaptive power)
        double blended = 0.6 * ruleScore + 0.4 * mlIntegrityScore;

        return Math.Round(Math.Max(0, Math.Min(100, blended)), 1);
    }
}

public record ModelStatus(bool IsTrained, int TrainedOnSessionCount);
