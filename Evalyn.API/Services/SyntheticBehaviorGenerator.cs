namespace Evalyn.API.Services;

/// <summary>
/// Generates synthetic behavioral feature vectors for ML model validation.
///
/// Produces two main profile categories:
///   1. Honest — natural student behavior with realistic variance
///   2. Cheating — four distinct sub-profiles modelling different cheating strategies
///
/// All distributions use a seeded Random for reproducibility.
/// Feature ranges are grounded in published exam proctoring research.
/// </summary>
public static class SyntheticBehaviorGenerator
{
    // ─────────────────────────────────────────────────────────────
    // Profile Types
    // ─────────────────────────────────────────────────────────────

    public enum CheatingSubProfile
    {
        /// <summary>Frequently switches tabs to search for answers.</summary>
        TabSwitcher,

        /// <summary>Copies answers from external sources.</summary>
        CopyPaster,

        /// <summary>Long idle periods consulting someone, then fast answers.</summary>
        ExternalHelp,

        /// <summary>Automated/scripted responses — machine-like uniformity.</summary>
        BotScript
    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Generate a batch of honest student profiles.
    /// </summary>
    public static List<AnomalyInputRow> GenerateHonestProfiles(int count, int seed = 42)
    {
        var rng = new Random(seed);
        return Enumerable.Range(0, count).Select(_ => GenerateHonestRow(rng)).ToList();
    }

    /// <summary>
    /// Generate a batch of cheating profiles with evenly distributed sub-profiles.
    /// </summary>
    public static List<AnomalyInputRow> GenerateCheatingProfiles(int count, int seed = 123)
    {
        var rng = new Random(seed);
        var subProfiles = Enum.GetValues<CheatingSubProfile>();
        return Enumerable.Range(0, count)
            .Select(i => GenerateCheatingRow(subProfiles[i % subProfiles.Length], rng))
            .ToList();
    }

    /// <summary>
    /// Generate a batch of cheating profiles for a specific sub-profile type.
    /// </summary>
    public static List<AnomalyInputRow> GenerateSubProfile(CheatingSubProfile subProfile, int count, int seed = 456)
    {
        var rng = new Random(seed);
        return Enumerable.Range(0, count).Select(_ => GenerateCheatingRow(subProfile, rng)).ToList();
    }

    /// <summary>
    /// Generate a mixed dataset with labels. Returns (rows, labels) where label=false is honest, label=true is cheating.
    /// </summary>
    public static (List<AnomalyInputRow> Rows, List<bool> IsCheating) GenerateLabeledDataset(
        int honestCount, int cheatingCount, int seed = 42)
    {
        var rows = new List<AnomalyInputRow>();
        var labels = new List<bool>();

        rows.AddRange(GenerateHonestProfiles(honestCount, seed));
        labels.AddRange(Enumerable.Repeat(false, honestCount));

        rows.AddRange(GenerateCheatingProfiles(cheatingCount, seed + 1000));
        labels.AddRange(Enumerable.Repeat(true, cheatingCount));

        return (rows, labels);
    }

    // ─────────────────────────────────────────────────────────────
    // Profile Generators
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Honest student: natural timing variance, minimal tab switches,
    /// no pasting, varied mouse movement.
    ///
    /// Feature distributions (based on Cluskey et al. 2011, Corrigan-Gibbs et al. 2015):
    ///   - TabSwitchesPerMinute:  LogNormal(μ=-2.3, σ=0.7) → median ~0.1/min
    ///   - PasteCount:            0 (honest students don't paste)
    ///   - RightClickCount:       Poisson(λ=0.3) → mostly 0, occasionally 1
    ///   - IdleSeconds:           LogNormal(μ=1.6, σ=0.8) → median ~5s, tail up to 30s
    ///   - FocusLostCount:        Poisson(λ=0.5) → 0–2 typically
    ///   - TimingCv:              Normal(μ=0.65, σ=0.12) clamped to [0.3, 1.2]
    ///   - MouseAngleEntropy:     Normal(μ=3.0, σ=0.5) clamped to [1.5, 4.5]
    /// </summary>
    private static AnomalyInputRow GenerateHonestRow(Random rng)
    {
        return new AnomalyInputRow
        {
            TabSwitchesPerMinute = (float)Math.Max(0, SampleLogNormal(rng, -2.3, 0.7)),
            PasteCount           = 0,
            RightClickCount      = SamplePoisson(rng, 0.3),
            IdleSeconds          = (float)Math.Max(0, SampleLogNormal(rng, 1.6, 0.8)),
            FocusLostCount       = SamplePoisson(rng, 0.5),
            TimingCv             = (float)Clamp(SampleNormal(rng, 0.65, 0.12), 0.3, 1.2),
            MouseAngleEntropy    = (float)Clamp(SampleNormal(rng, 3.0, 0.5), 1.5, 4.5)
        };
    }

    /// <summary>
    /// Cheating profiles — each sub-profile has a distinct behavioral signature
    /// that deviates from the honest baseline in specific feature dimensions.
    /// </summary>
    private static AnomalyInputRow GenerateCheatingRow(CheatingSubProfile subProfile, Random rng)
    {
        return subProfile switch
        {
            CheatingSubProfile.TabSwitcher => GenerateTabSwitcherRow(rng),
            CheatingSubProfile.CopyPaster => GenerateCopyPasterRow(rng),
            CheatingSubProfile.ExternalHelp => GenerateExternalHelpRow(rng),
            CheatingSubProfile.BotScript => GenerateBotScriptRow(rng),
            _ => throw new ArgumentOutOfRangeException(nameof(subProfile))
        };
    }

    /// <summary>
    /// Tab-Switcher: Frequently alt-tabs to a search engine.
    /// Key signals: high tab switches + focus lost, moderate idle time.
    /// </summary>
    private static AnomalyInputRow GenerateTabSwitcherRow(Random rng)
    {
        return new AnomalyInputRow
        {
            TabSwitchesPerMinute = (float)Clamp(SampleNormal(rng, 3.5, 1.0), 1.5, 8.0),
            PasteCount           = SamplePoisson(rng, 1.5),
            RightClickCount      = SamplePoisson(rng, 2.5),
            IdleSeconds          = (float)Clamp(SampleNormal(rng, 45.0, 15.0), 15.0, 120.0),
            FocusLostCount       = (int)Clamp(SampleNormal(rng, 12.0, 4.0), 5, 30),
            TimingCv             = (float)Clamp(SampleNormal(rng, 0.25, 0.08), 0.10, 0.45),
            MouseAngleEntropy    = (float)Clamp(SampleNormal(rng, 1.0, 0.4), 0.3, 2.0)
        };
    }

    /// <summary>
    /// Copy-Paster: Pastes answers from external sources.
    /// Key signals: high paste count, low timing CV (uniform fast answers after pasting).
    /// </summary>
    private static AnomalyInputRow GenerateCopyPasterRow(Random rng)
    {
        return new AnomalyInputRow
        {
            TabSwitchesPerMinute = (float)Clamp(SampleNormal(rng, 1.2, 0.5), 0.3, 3.0),
            PasteCount           = (int)Clamp(SampleNormal(rng, 6.0, 2.5), 2, 15),
            RightClickCount      = (int)Clamp(SampleNormal(rng, 4.0, 2.0), 1, 10),
            IdleSeconds          = (float)Clamp(SampleNormal(rng, 10.0, 5.0), 0.0, 40.0),
            FocusLostCount       = SamplePoisson(rng, 2.0),
            TimingCv             = (float)Clamp(SampleNormal(rng, 0.18, 0.06), 0.05, 0.35),
            MouseAngleEntropy    = (float)Clamp(SampleNormal(rng, 2.0, 0.7), 0.5, 3.5)
        };
    }

    /// <summary>
    /// External Help: Consults someone (phone / in-room) — long idle gaps
    /// followed by suspiciously fast correct answers.
    /// Key signals: very high idle seconds, moderate focus lost, erratic timing.
    /// </summary>
    private static AnomalyInputRow GenerateExternalHelpRow(Random rng)
    {
        return new AnomalyInputRow
        {
            TabSwitchesPerMinute = (float)Clamp(SampleNormal(rng, 0.3, 0.2), 0.0, 1.0),
            PasteCount           = 0,
            RightClickCount      = SamplePoisson(rng, 0.5),
            IdleSeconds          = (float)Clamp(SampleNormal(rng, 120.0, 40.0), 45.0, 300.0),
            FocusLostCount       = (int)Clamp(SampleNormal(rng, 5.0, 2.0), 2, 12),
            TimingCv             = (float)Clamp(SampleNormal(rng, 1.4, 0.3), 0.8, 2.5),
            MouseAngleEntropy    = (float)Clamp(SampleNormal(rng, 1.5, 0.6), 0.3, 3.0)
        };
    }

    /// <summary>
    /// Bot/Script: Automated responses — machine-like uniformity.
    /// Key signals: extremely low timing CV, near-zero mouse entropy, zero human artifacts.
    /// </summary>
    private static AnomalyInputRow GenerateBotScriptRow(Random rng)
    {
        return new AnomalyInputRow
        {
            TabSwitchesPerMinute = (float)Clamp(SampleNormal(rng, 0.02, 0.02), 0.0, 0.1),
            PasteCount           = 0,
            RightClickCount      = 0,
            IdleSeconds          = (float)Clamp(SampleNormal(rng, 0.5, 0.3), 0.0, 2.0),
            FocusLostCount       = 0,
            TimingCv             = (float)Clamp(SampleNormal(rng, 0.04, 0.02), 0.01, 0.12),
            MouseAngleEntropy    = (float)Clamp(SampleNormal(rng, 0.2, 0.15), 0.0, 0.6)
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Statistical Distribution Samplers
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Sample from a Normal distribution using Box-Muller transform.
    /// </summary>
    private static double SampleNormal(Random rng, double mean, double stdDev)
    {
        double u1 = 1.0 - rng.NextDouble(); // avoid log(0)
        double u2 = rng.NextDouble();
        double z = Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2.0 * Math.PI * u2);
        return mean + stdDev * z;
    }

    /// <summary>
    /// Sample from a Log-Normal distribution.
    /// X ~ LogNormal(μ, σ) means ln(X) ~ Normal(μ, σ).
    /// </summary>
    private static double SampleLogNormal(Random rng, double mu, double sigma)
    {
        return Math.Exp(SampleNormal(rng, mu, sigma));
    }

    /// <summary>
    /// Sample from a Poisson distribution using Knuth's algorithm.
    /// Suitable for small λ (&lt; 30).
    /// </summary>
    private static int SamplePoisson(Random rng, double lambda)
    {
        double L = Math.Exp(-lambda);
        int k = 0;
        double p = 1.0;
        do
        {
            k++;
            p *= rng.NextDouble();
        } while (p > L);
        return k - 1;
    }

    /// <summary>Clamp a value to [min, max].</summary>
    private static double Clamp(double value, double min, double max)
        => Math.Max(min, Math.Min(max, value));

    // ─────────────────────────────────────────────────────────────
    // Descriptive Statistics Helpers (for test output)
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Compute mean, standard deviation, min, and max for a set of scores.
    /// Useful for logging test results.
    /// </summary>
    public static (double Mean, double StdDev, double Min, double Max) DescriptiveStats(IEnumerable<double> values)
    {
        var list = values.ToList();
        if (list.Count == 0) return (0, 0, 0, 0);

        double mean = list.Average();
        double variance = list.Sum(v => Math.Pow(v - mean, 2)) / list.Count;
        return (
            Mean: Math.Round(mean, 4),
            StdDev: Math.Round(Math.Sqrt(variance), 4),
            Min: Math.Round(list.Min(), 4),
            Max: Math.Round(list.Max(), 4)
        );
    }

    /// <summary>
    /// Compute Cohen's d effect size between two groups.
    /// d > 0.8 = large effect, d > 1.2 = very large effect.
    /// </summary>
    public static double CohensD(IEnumerable<double> group1, IEnumerable<double> group2)
    {
        var g1 = group1.ToList();
        var g2 = group2.ToList();

        double mean1 = g1.Average();
        double mean2 = g2.Average();
        double var1 = g1.Sum(v => Math.Pow(v - mean1, 2)) / Math.Max(1, g1.Count - 1);
        double var2 = g2.Sum(v => Math.Pow(v - mean2, 2)) / Math.Max(1, g2.Count - 1);

        double pooledStdDev = Math.Sqrt((var1 + var2) / 2.0);
        if (pooledStdDev < 1e-10) return 0;

        return Math.Abs(mean1 - mean2) / pooledStdDev;
    }
}
