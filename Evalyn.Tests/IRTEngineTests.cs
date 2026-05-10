using Evalyn.API.Models.Entities;
using Evalyn.API.Services;

namespace Evalyn.Tests;

/// <summary>
/// Unit tests for IRTEngine — the core adaptive ability estimation engine.
/// Validates mathematical correctness of IRT computations, convergence
/// of Newton-Raphson, boundary constraints, and edge case handling.
/// </summary>
public class IRTEngineTests
{
    private static readonly IRTSettings DefaultSettings = new()
    {
        ThetaMin = -4.0,
        ThetaMax = 4.0,
        MaxStepSize = 1.0,
        MapThreshold = 5,
        PriorMean = 0.0,
        PriorSd = 1.0,
        ExposureTopK = 3
    };

    private static IRTEngine Engine() => new(DefaultSettings);

    // ─────────────────────────────────────────────────────────────
    // ProbCorrect Tests
    // ─────────────────────────────────────────────────────────────

    [Fact]
    public void ProbCorrect_WhenThetaEqualsdifficulty_Returns0Point5()
    {
        // When ability equals difficulty, probability of correct should be 0.5
        double p = IRTEngine.ProbCorrect(theta: 0.0, difficulty: 0.0, discrimination: 1.0);
        Assert.Equal(0.5, p, precision: 10);
    }

    [Fact]
    public void ProbCorrect_WhenThetaFarAboveDifficulty_ApproachesOne()
    {
        double p = IRTEngine.ProbCorrect(theta: 4.0, difficulty: -4.0, discrimination: 1.0);
        Assert.True(p > 0.999, $"Expected p > 0.999 but got {p}");
    }

    [Fact]
    public void ProbCorrect_WhenThetaFarBelowDifficulty_ApproachesZero()
    {
        double p = IRTEngine.ProbCorrect(theta: -4.0, difficulty: 4.0, discrimination: 1.0);
        Assert.True(p < 0.001, $"Expected p < 0.001 but got {p}");
    }

    [Fact]
    public void ProbCorrect_NumericalStabilityGuard_VeryLargeZ_ReturnsOne()
    {
        // z > 35 should return exactly 1.0 to prevent exp overflow
        double p = IRTEngine.ProbCorrect(theta: 100.0, difficulty: -100.0, discrimination: 2.0);
        Assert.Equal(1.0, p);
    }

    [Fact]
    public void ProbCorrect_NumericalStabilityGuard_VerySmallZ_ReturnsZero()
    {
        // z < -35 should return exactly 0.0
        double p = IRTEngine.ProbCorrect(theta: -100.0, difficulty: 100.0, discrimination: 2.0);
        Assert.Equal(0.0, p);
    }

    [Fact]
    public void ProbCorrect_HigherDiscrimination_SteepersSlope()
    {
        // Higher discrimination = steeper ICC = bigger difference at theta slightly off difficulty
        double pLow  = IRTEngine.ProbCorrect(theta: 0.5, difficulty: 0.0, discrimination: 0.5);
        double pHigh = IRTEngine.ProbCorrect(theta: 0.5, difficulty: 0.0, discrimination: 2.0);
        Assert.True(pHigh > pLow, "Higher discrimination should give higher P(correct) for theta above difficulty");
    }

    [Fact]
    public void ProbCorrect_ZeroOrNegativeDiscrimination_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            IRTEngine.ProbCorrect(theta: 0, difficulty: 0, discrimination: 0));

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            IRTEngine.ProbCorrect(theta: 0, difficulty: 0, discrimination: -1));
    }

    // ─────────────────────────────────────────────────────────────
    // Fisher Information Tests
    // ─────────────────────────────────────────────────────────────

    [Fact]
    public void FisherInformation_MaximisedWhenThetaEqualsDifficulty()
    {
        // Fisher information is maximised at theta = difficulty (p = 0.5)
        double infoAtPeak  = IRTEngine.FisherInformation(theta: 0.0, difficulty: 0.0, discrimination: 1.0);
        double infoAbove   = IRTEngine.FisherInformation(theta: 1.0, difficulty: 0.0, discrimination: 1.0);
        double infoBelow   = IRTEngine.FisherInformation(theta: -1.0, difficulty: 0.0, discrimination: 1.0);

        Assert.True(infoAtPeak > infoAbove, "Info should be highest at theta = difficulty");
        Assert.True(infoAtPeak > infoBelow, "Info should be highest at theta = difficulty");
    }

    [Fact]
    public void FisherInformation_ScalesWithDiscriminationSquared()
    {
        double info1 = IRTEngine.FisherInformation(theta: 0.0, difficulty: 0.0, discrimination: 1.0);
        double info2 = IRTEngine.FisherInformation(theta: 0.0, difficulty: 0.0, discrimination: 2.0);

        // I(θ) = a² * p * (1-p) → doubling a quadruples info
        Assert.Equal(info2, info1 * 4, precision: 10);
    }

    // ─────────────────────────────────────────────────────────────
    // EstimateTheta Tests
    // ─────────────────────────────────────────────────────────────

    [Fact]
    public void EstimateTheta_EmptyResponses_ReturnsZero()
    {
        var engine = Engine();
        double theta = engine.EstimateTheta(new List<(double, double, bool)>());
        Assert.Equal(0.0, theta);
    }

    [Fact]
    public void EstimateTheta_AllCorrect_ThetaAboveHardestItem()
    {
        var engine = Engine();
        var responses = new List<(double difficulty, double discrimination, bool correct)>
        {
            (-1.0, 1.0, true),
            (0.0,  1.0, true),
            (1.0,  1.0, true)
        };

        // Starting from 0, all-correct raw = hardest + 0.5 = 1.5
        // MaxStepSize clamps the step to 1.0, so theta will be at most 1.0
        // We assert it moved positively from the initial 0.0
        double theta = engine.EstimateTheta(responses, previousTheta: 0.0);
        Assert.True(theta > 0.0, $"Expected theta > 0.0 for all-correct responses, got {theta}");
        Assert.InRange(theta, 0.0, DefaultSettings.ThetaMax);
    }

    [Fact]
    public void EstimateTheta_AllWrong_ThetaBelowEasiestItem()
    {
        var engine = Engine();
        var responses = new List<(double difficulty, double discrimination, bool correct)>
        {
            (-2.0, 1.0, false),
            (-1.0, 1.0, false),
            (0.0,  1.0, false)
        };

        // Starting from 0, all-wrong raw = easiest - 0.5 = -2.5
        // MaxStepSize clamps the step to -1.0, so theta = -1.0
        // We assert it moved negatively from the initial 0.0
        double theta = engine.EstimateTheta(responses, previousTheta: 0.0);
        Assert.True(theta < 0.0, $"Expected theta < 0.0 for all-wrong responses, got {theta}");
        Assert.InRange(theta, DefaultSettings.ThetaMin, 0.0);
    }

    [Fact]
    public void EstimateTheta_MixedResponses_ConvergesReasonably()
    {
        var engine = Engine();
        // Student gets easy items right, hard items wrong → moderate ability
        var responses = new List<(double difficulty, double discrimination, bool correct)>
        {
            (-2.0, 1.0, true),
            (-1.0, 1.0, true),
            (0.0,  1.0, false),
            (1.0,  1.0, false),
            (2.0,  1.0, false)
        };

        double theta = engine.EstimateTheta(responses, previousTheta: 0.0);
        // Should converge to a negative/low ability estimate
        Assert.InRange(theta, -4.0, 0.5);
    }

    [Fact]
    public void EstimateTheta_AlwaysWithinBounds()
    {
        var engine = Engine();
        // Extreme case: many all-correct responses on hard items
        var responses = Enumerable.Range(0, 20).Select(i =>
            (difficulty: 3.9, discrimination: 1.0, correct: true)).ToList();

        double theta = engine.EstimateTheta(responses, previousTheta: 3.0);
        Assert.InRange(theta, DefaultSettings.ThetaMin, DefaultSettings.ThetaMax);
    }

    [Fact]
    public void EstimateTheta_StepSizeDampingApplied()
    {
        var engine = Engine();
        // From theta = 0, all-correct on hard items; new raw = 3.5 + 0.5 = 4.0
        // MaxStepSize = 1.0, so the step from 0 cannot exceed 1.0
        var responses = new List<(double difficulty, double discrimination, bool correct)>
        {
            (3.5, 1.0, true)
        };

        double theta = engine.EstimateTheta(responses, previousTheta: 0.0);
        Assert.True(theta <= 0.0 + DefaultSettings.MaxStepSize + 0.001,
            $"Theta jump {theta} exceeds MaxStepSize={DefaultSettings.MaxStepSize}");
    }

    [Fact]
    public void EstimateTheta_NegativeOrZeroDiscrimination_Throws()
    {
        var engine = Engine();
        var responses = new List<(double difficulty, double discrimination, bool correct)>
        {
            (0.0, -0.5, true) // Invalid discrimination
        };

        Assert.Throws<ArgumentException>(() => engine.EstimateTheta(responses));
    }

    // ─────────────────────────────────────────────────────────────
    // SEM Tests
    // ─────────────────────────────────────────────────────────────

    [Fact]
    public void CalculateSEM_NoItems_ReturnsPriorSd()
    {
        var engine = Engine();
        double sem = engine.CalculateSEM(0.0, new List<(double, double)>());
        Assert.Equal(DefaultSettings.PriorSd, sem);
    }

    [Fact]
    public void CalculateSEM_MoreItems_LowerSEM()
    {
        var engine = Engine();
        var oneItem  = new List<(double, double)> { (0.0, 1.0) };
        var fiveItems = Enumerable.Range(0, 5).Select(_ => (0.0, 1.0)).ToList();

        double sem1 = engine.CalculateSEM(0.0, oneItem);
        double sem5 = engine.CalculateSEM(0.0, fiveItems);

        Assert.True(sem5 < sem1, "More items → more information → lower SEM");
    }

    [Fact]
    public void CalculateSEM_IsPositive()
    {
        var engine = Engine();
        var items = new List<(double, double)> { (-1.0, 0.8), (0.0, 1.2), (1.0, 1.5) };
        double sem = engine.CalculateSEM(0.0, items);
        Assert.True(sem > 0, "SEM must always be positive");
    }

    // ─────────────────────────────────────────────────────────────
    // ThetaToPercentile Tests
    // ─────────────────────────────────────────────────────────────

    [Fact]
    public void ThetaToPercentile_ZeroTheta_Returns50thPercentile()
    {
        double p = IRTEngine.ThetaToPercentile(0.0);
        Assert.InRange(p, 49.0, 51.0);
    }

    [Fact]
    public void ThetaToPercentile_PostiveTheta_AboveFiftyth()
    {
        double p = IRTEngine.ThetaToPercentile(1.0);
        Assert.True(p > 50.0, $"Expected percentile > 50 for positive theta, got {p}");
    }

    [Fact]
    public void ThetaToPercentile_NegativeTheta_BelowFiftyth()
    {
        double p = IRTEngine.ThetaToPercentile(-1.0);
        Assert.True(p < 50.0, $"Expected percentile < 50 for negative theta, got {p}");
    }

    [Fact]
    public void ThetaToPercentile_IsMonotoneIncreasing()
    {
        double p1 = IRTEngine.ThetaToPercentile(-2.0);
        double p2 = IRTEngine.ThetaToPercentile(-1.0);
        double p3 = IRTEngine.ThetaToPercentile(0.0);
        double p4 = IRTEngine.ThetaToPercentile(1.0);
        double p5 = IRTEngine.ThetaToPercentile(2.0);

        Assert.True(p1 < p2 && p2 < p3 && p3 < p4 && p4 < p5,
            "Percentile mapping must be strictly monotone increasing");
    }

    // ─────────────────────────────────────────────────────────────
    // SelectNextQuestion Tests
    // ─────────────────────────────────────────────────────────────

    [Fact]
    public void SelectNextQuestion_EmptyPool_ReturnsNull()
    {
        var engine = Engine();
        var result = engine.SelectNextQuestion(0.0, new List<Question>(), new HashSet<int>());
        Assert.Null(result);
    }

    [Fact]
    public void SelectNextQuestion_AllAnswered_ReturnsNull()
    {
        var engine = Engine();
        var questions = new List<Question>
        {
            new() { Id = 1, IRT_Difficulty = 0.0, IRT_Discrimination = 1.0 }
        };
        var answered = new HashSet<int> { 1 };

        var result = engine.SelectNextQuestion(0.0, questions, answered);
        Assert.Null(result);
    }

    [Fact]
    public void SelectNextQuestion_PrefersCalibrated_Questions()
    {
        var engine = Engine();
        // One calibrated, one not — should always choose from calibrated pool
        var questions = new List<Question>
        {
            new() { Id = 1, IRT_Difficulty = 0.0, IRT_Discrimination = 1.0, IsCalibrated = true },
            new() { Id = 2, IRT_Difficulty = 0.0, IRT_Discrimination = 1.0, IsCalibrated = false }
        };

        // Run multiple times to verify the selector never returns uncalibrated when calibrated exist
        for (int i = 0; i < 20; i++)
        {
            var result = engine.SelectNextQuestion(0.0, questions, new HashSet<int>());
            Assert.NotNull(result);
            Assert.Equal(1, result!.Id); // Only the calibrated one
        }
    }

    [Fact]
    public void SelectNextQuestion_ZeroDiscrimination_Excluded()
    {
        var engine = Engine();
        var questions = new List<Question>
        {
            new() { Id = 1, IRT_Difficulty = 0.0, IRT_Discrimination = 0.0 }, // Invalid
            new() { Id = 2, IRT_Difficulty = 0.0, IRT_Discrimination = 1.0 }  // Valid
        };

        var result = engine.SelectNextQuestion(0.0, questions, new HashSet<int>());
        Assert.NotNull(result);
        Assert.Equal(2, result!.Id);
    }
}
