using Evalyn.API.Services;

namespace Evalyn.Tests;

/// <summary>
/// Unit tests for AnomalyDetectionService — specifically the pure, static
/// BlendScores method, which merges rule-based and ML integrity scores.
/// The ML training pipeline requires a real DB, so is covered by integration tests.
/// </summary>
public class AnomalyDetectionServiceTests
{
    // ─────────────────────────────────────────────────────────────
    // BlendScores Tests
    // ─────────────────────────────────────────────────────────────

    [Fact]
    public void BlendScores_BothPerfect_Returns100()
    {
        // ruleScore = 100 (clean), mlAnomalyScore = 0 (not anomalous) → integrity = 100
        double result = AnomalyDetectionService.BlendScores(ruleScore: 100.0, mlAnomalyScore: 0.0);
        Assert.Equal(100.0, result);
    }

    [Fact]
    public void BlendScores_BothZero_ReturnsZero()
    {
        // ruleScore = 0 (cheating flagged), mlAnomalyScore = 1.0 (highly anomalous)
        double result = AnomalyDetectionService.BlendScores(ruleScore: 0.0, mlAnomalyScore: 1.0);
        Assert.Equal(0.0, result);
    }

    [Fact]
    public void BlendScores_NeutralRuleHighMlAnomaly_SignificantDecrease()
    {
        // Rule says fine (100), but ML says very suspicious (0.9 anomaly)
        double result = AnomalyDetectionService.BlendScores(ruleScore: 100.0, mlAnomalyScore: 0.9);

        // ML integrity = (1 - 0.9) * 100 = 10
        // Blended = 0.6 * 100 + 0.4 * 10 = 60 + 4 = 64
        Assert.Equal(64.0, result, precision: 1);
    }

    [Fact]
    public void BlendScores_HighRuleLowMlAnomaly_HighIntegrity()
    {
        // Rule says slightly suspicious (60), ML says totally clean (0.0)
        double result = AnomalyDetectionService.BlendScores(ruleScore: 60.0, mlAnomalyScore: 0.0);

        // ML integrity = 100, blended = 0.6 * 60 + 0.4 * 100 = 36 + 40 = 76
        Assert.Equal(76.0, result, precision: 1);
    }

    [Fact]
    public void BlendScores_ResultAlwaysBetween0And100()
    {
        // Even with extreme inputs, result must be clamped to [0, 100]
        double result1 = AnomalyDetectionService.BlendScores(ruleScore: -50.0, mlAnomalyScore: 2.0);
        double result2 = AnomalyDetectionService.BlendScores(ruleScore: 200.0, mlAnomalyScore: -1.0);

        Assert.InRange(result1, 0.0, 100.0);
        Assert.InRange(result2, 0.0, 100.0);
    }

    [Fact]
    public void BlendScores_WeightsAreCorrectly60_40()
    {
        // Known inputs for deterministic check: rule=80, ml anomaly=0.5
        // mlIntegrity = (1 - 0.5) * 100 = 50
        // blended = 0.6 * 80 + 0.4 * 50 = 48 + 20 = 68
        double result = AnomalyDetectionService.BlendScores(ruleScore: 80.0, mlAnomalyScore: 0.5);
        Assert.Equal(68.0, result, precision: 1);
    }

    [Fact]
    public void BlendScores_MidpointInputs_ProducesExpectedResult()
    {
        // ruleScore = 50, mlAnomalyScore = 0.5 → mlIntegrity = 50
        // blended = 0.6 * 50 + 0.4 * 50 = 50
        double result = AnomalyDetectionService.BlendScores(ruleScore: 50.0, mlAnomalyScore: 0.5);
        Assert.Equal(50.0, result, precision: 1);
    }

    [Fact]
    public void BlendScores_OutputIsRounded()
    {
        // Result should always be rounded to 1 decimal place
        double result = AnomalyDetectionService.BlendScores(ruleScore: 73.0, mlAnomalyScore: 0.33);

        // mlIntegrity = 0.67 * 100 = 67
        // blended = 0.6 * 73 + 0.4 * 67 = 43.8 + 26.8 = 70.6
        Assert.Equal(70.6, result, precision: 1);
    }

    // ─────────────────────────────────────────────────────────────
    // ModelStatus Tests
    // ─────────────────────────────────────────────────────────────

    [Fact]
    public void ModelStatus_Record_IsTrained_ReflectsState()
    {
        var trained = new ModelStatus(IsTrained: true, TrainedOnSessionCount: 25);
        var untrained = new ModelStatus(IsTrained: false, TrainedOnSessionCount: 0);

        Assert.True(trained.IsTrained);
        Assert.Equal(25, trained.TrainedOnSessionCount);
        Assert.False(untrained.IsTrained);
        Assert.Equal(0, untrained.TrainedOnSessionCount);
    }
}
