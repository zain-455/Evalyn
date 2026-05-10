using Evalyn.API.Models.Entities;

namespace Evalyn.API.Services;

public class IRTSettings
{
    public double ThetaMin { get; set; } = -4.0;
    public double ThetaMax { get; set; } = 4.0;
    public double MaxStepSize { get; set; } = 1.0;
    public int MapThreshold { get; set; } = 5;
    public double PriorMean { get; set; } = 0.0;
    public double PriorSd { get; set; } = 1.0;
    public int ExposureTopK { get; set; } = 3;
}

public class IRTEngine
{
    private readonly IRTSettings _settings;
    private readonly Random _rng = new();

    public IRTEngine(IRTSettings settings)
    {
        _settings = settings ?? throw new ArgumentNullException(nameof(settings));
    }

    public IRTEngine() : this(new IRTSettings()) { }

    // ─────────────────────────────────────────────
    // Core IRT Math
    // ─────────────────────────────────────────────

    public static double ProbCorrect(double theta, double difficulty, double discrimination = 1.0)
    {
        if (discrimination <= 0)
            throw new ArgumentOutOfRangeException(nameof(discrimination));

        double z = discrimination * (theta - difficulty);

        // Numerical stability guard
        if (z > 35) return 1.0;
        if (z < -35) return 0.0;

        return 1.0 / (1.0 + Math.Exp(-z));
    }

    public static double FisherInformation(double theta, double difficulty, double discrimination = 1.0)
    {
        double p = ProbCorrect(theta, difficulty, discrimination);
        return discrimination * discrimination * p * (1 - p);
    }

    // ─────────────────────────────────────────────
    // Theta Estimation
    // ─────────────────────────────────────────────

    public double EstimateTheta(
        List<(double difficulty, double discrimination, bool correct)> responses,
        double previousTheta = 0.0)
    {
        if (responses == null || responses.Count == 0)
            return 0.0;

        ValidateResponses(responses);

        bool allCorrect = responses.All(r => r.correct);
        bool allWrong = responses.All(r => !r.correct);

        double rawTheta;

        if (allCorrect)
        {
            double hardest = responses.Max(r => r.difficulty);
            rawTheta = hardest + 0.5;
        }
        else if (allWrong)
        {
            double easiest = responses.Min(r => r.difficulty);
            rawTheta = easiest - 0.5;
        }
        else
        {
            bool useMAP = responses.Count <= _settings.MapThreshold;

            var (theta, converged) = NewtonRaphsonEstimate(
                responses,
                previousTheta,
                useMAP
            );

            // fallback if not converged
            rawTheta = converged ? theta : previousTheta;
        }

        // Step-size damping
        double step = rawTheta - previousTheta;
        if (Math.Abs(step) > _settings.MaxStepSize)
        {
            rawTheta = previousTheta + Math.Sign(step) * _settings.MaxStepSize;
        }

        return Clamp(rawTheta);
    }

    private (double theta, bool converged) NewtonRaphsonEstimate(
        List<(double difficulty, double discrimination, bool correct)> responses,
        double initialTheta,
        bool useMAP,
        int maxIterations = 25,
        double tolerance = 0.001)
    {
        double theta = initialTheta;
        double priorVar = _settings.PriorSd * _settings.PriorSd;

        for (int i = 0; i < maxIterations; i++)
        {
            double first = 0.0;
            double second = 0.0;

            foreach (var (difficulty, discrimination, correct) in responses)
            {
                double p = ProbCorrect(theta, difficulty, discrimination);
                double u = correct ? 1.0 : 0.0;

                first += discrimination * (u - p);
                second -= discrimination * discrimination * p * (1 - p);
            }

            if (useMAP)
            {
                first -= (theta - _settings.PriorMean) / priorVar;
                second -= 1.0 / priorVar;
            }

            // Prevent division instability
            if (Math.Abs(second) < 1e-10)
                return (theta, false);

            double delta = first / second;

            // Clamp extreme jumps
            if (Math.Abs(delta) > _settings.MaxStepSize)
                delta = Math.Sign(delta) * _settings.MaxStepSize;

            theta -= delta;
            theta = Clamp(theta);

            if (Math.Abs(delta) < tolerance)
                return (theta, true);
        }

        return (theta, false);
    }

    private void ValidateResponses(List<(double difficulty, double discrimination, bool correct)> responses)
    {
        foreach (var (d, a, _) in responses)
        {
            if (a <= 0)
                throw new ArgumentException("Discrimination must be > 0");
        }
    }

    // ─────────────────────────────────────────────
    // SEM
    // ─────────────────────────────────────────────

    public double CalculateSEM(double theta,
        List<(double difficulty, double discrimination)> items)
    {
        if (items == null || items.Count == 0)
            return _settings.PriorSd;

        double info = 0;

        foreach (var (d, a) in items)
        {
            if (a <= 0) continue;
            info += FisherInformation(theta, d, a);
        }

        return info < 1e-10
            ? _settings.PriorSd
            : 1.0 / Math.Sqrt(info);
    }

    // ─────────────────────────────────────────────
    // Question Selection
    // ─────────────────────────────────────────────

    public Question? SelectNextQuestion(
        double theta,
        List<Question> questions,
        HashSet<int> answeredIds)
    {
        if (questions == null || questions.Count == 0)
            return null;

        var pool = questions
            .Where(q => !answeredIds.Contains(q.Id) && q.IRT_Discrimination > 0)
            .ToList();

        if (pool.Count == 0)
            return null;

        var calibrated = pool.Where(q => q.IsCalibrated).ToList();
        if (calibrated.Count > 0)
            pool = calibrated;

        var ranked = pool
            .Select(q => new
            {
                Question = q,
                Info = FisherInformation(theta, q.IRT_Difficulty, q.IRT_Discrimination)
            })
            .OrderByDescending(x => x.Info)
            .ToList();

        int k = Math.Clamp(_settings.ExposureTopK, 1, ranked.Count);
        var top = ranked.Take(k).ToList();

        return top[_rng.Next(top.Count)].Question;
    }

    // ─────────────────────────────────────────────
    // Percentile Mapping
    // ─────────────────────────────────────────────

    public static double ThetaToPercentile(double theta)
    {
        double p = 0.5 * (1 + Erf(theta / Math.Sqrt(2)));
        return Math.Round(p * 100, 1);
    }

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────

    private static double Erf(double x)
    {
        double sign = Math.Sign(x);
        x = Math.Abs(x);

        const double a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
        const double a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;

        double t = 1.0 / (1.0 + p * x);
        double y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1)
                         * t * Math.Exp(-x * x);

        return sign * y;
    }

    private double Clamp(double theta) =>
        Math.Max(_settings.ThetaMin, Math.Min(_settings.ThetaMax, theta));
}