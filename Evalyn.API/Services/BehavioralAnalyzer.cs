using Evalyn.API.Models.Entities;

namespace Evalyn.API.Services;

/// <summary>
/// Behavioral Integrity Analyzer — detects exam cheating through statistical
/// anomalies in behavioral telemetry. Uses within-student baselines and
/// absolute thresholds from research. No webcam required.
/// </summary>
public class BehavioralAnalyzer
{
    // ── Absolute thresholds (from published exam behavior research) ──
    private const int FAST_ANSWER_THRESHOLD_MS = 3000;      // < 3s = suspiciously fast
    private const int MAX_ALLOWED_TAB_SWITCHES = 5;
    private const int IDLE_THRESHOLD_MS = 60000;             // > 60s idle = suspicious gap
    private const double MIN_TIMING_CV = 0.15;               // Coefficient of variation < 0.15 = bot-like uniformity

    public record IntegrityResult(
        double Score,
        string Label,
        List<IntegrityFlagDetail> Flags,
        FeatureVector7D Features
    );

    public record FeatureVector7D(
        double TabSwitchesPerMinute,
        int PasteCount,
        int RightClickCount,
        double IdleSeconds,
        int FocusLostCount,
        double TimingCv,
        double MouseAngleEntropy
    );

    public record IntegrityFlagDetail(
        string Signal,
        string Description,
        string Severity,     // High, Medium, Low
        string Evidence
    );

    /// <summary>
    /// Analyze a completed test session and return an integrity score with flags.
    /// </summary>
    public IntegrityResult Analyze(
        List<Response> responses,
        List<BehavioralEvent> events)
    {
        var features = ExtractFeatures(responses, events);

        var flags = new List<IntegrityFlagDetail>();
        double score = 100.0;

        // ── Signal 1: Impossibly fast answers ──
        var fastAnswers = responses.Where(r => r.TimeTakenMs > 0 && r.TimeTakenMs < FAST_ANSWER_THRESHOLD_MS).ToList();
        if (fastAnswers.Count > 0)
        {
            double penalty = Math.Min(30, fastAnswers.Count * 8);
            score -= penalty;
            flags.Add(new IntegrityFlagDetail(
                "FastAnswers",
                $"{fastAnswers.Count} question(s) answered in under {FAST_ANSWER_THRESHOLD_MS / 1000}s",
                fastAnswers.Count >= 3 ? "High" : "Medium",
                $"Questions answered in: {string.Join(", ", fastAnswers.Select(r => $"Q{r.QuestionOrder}: {r.TimeTakenMs}ms"))}"
            ));
        }

        // ── Signal 2: Timing uniformity (bot detection) ──
        if (responses.Count >= 5)
        {
            var times = responses.Where(r => r.TimeTakenMs > 0).Select(r => (double)r.TimeTakenMs).ToList();
            if (times.Count >= 5)
            {
                double mean = times.Average();
                double stdDev = Math.Sqrt(times.Sum(t => Math.Pow(t - mean, 2)) / times.Count);
                double cv = mean > 0 ? stdDev / mean : 0;

                if (cv < MIN_TIMING_CV)
                {
                    score -= 20;
                    flags.Add(new IntegrityFlagDetail(
                        "UniformTiming",
                        "Answer timing is unusually uniform — possible automated/scripted responses",
                        "High",
                        $"Coefficient of variation: {cv:F3} (threshold: {MIN_TIMING_CV})"
                    ));
                }
            }
        }

        // ── Signal 3: Tab switches ──
        var tabSwitches = events.Where(e => e.EventType == "TabSwitch").ToList();
        if (tabSwitches.Count > MAX_ALLOWED_TAB_SWITCHES)
        {
            double penalty = Math.Min(25, (tabSwitches.Count - MAX_ALLOWED_TAB_SWITCHES) * 5);
            score -= penalty;
            flags.Add(new IntegrityFlagDetail(
                "TabSwitches",
                $"{tabSwitches.Count} tab switches detected (threshold: {MAX_ALLOWED_TAB_SWITCHES})",
                tabSwitches.Count > 10 ? "High" : "Medium",
                $"Tab switches occurred at: {string.Join(", ", tabSwitches.Take(10).Select(e => e.Timestamp.ToString("HH:mm:ss")))}"
            ));
        }

        // ── Signal 4: Copy-paste events ──
        var pasteEvents = events.Where(e => e.EventType == "CopyPaste").ToList();
        if (pasteEvents.Count > 0)
        {
            score -= Math.Min(30, pasteEvents.Count * 15);
            flags.Add(new IntegrityFlagDetail(
                "CopyPaste",
                $"{pasteEvents.Count} paste event(s) detected during exam",
                "High",
                $"Paste events at: {string.Join(", ", pasteEvents.Select(e => e.Timestamp.ToString("HH:mm:ss")))}"
            ));
        }

        // ── Signal 5: Idle periods ──
        var idleEvents = events.Where(e => e.EventType == "IdlePeriod").ToList();
        if (idleEvents.Count > 2)
        {
            score -= Math.Min(15, idleEvents.Count * 5);
            flags.Add(new IntegrityFlagDetail(
                "IdlePeriods",
                $"{idleEvents.Count} extended idle period(s) detected (>{IDLE_THRESHOLD_MS / 1000}s each)",
                "Medium",
                $"Idle periods at: {string.Join(", ", idleEvents.Select(e => e.Timestamp.ToString("HH:mm:ss")))}"
            ));
        }

        // ── Signal 6: Within-student anomaly (sudden speed change) ──
        if (responses.Count >= 8)
        {
            var orderedResponses = responses.OrderBy(r => r.QuestionOrder).ToList();
            int halfPoint = orderedResponses.Count / 2;
            var firstHalf = orderedResponses.Take(halfPoint).Where(r => r.TimeTakenMs > 0).Select(r => (double)r.TimeTakenMs).ToList();
            var secondHalf = orderedResponses.Skip(halfPoint).Where(r => r.TimeTakenMs > 0).Select(r => (double)r.TimeTakenMs).ToList();

            if (firstHalf.Count > 0 && secondHalf.Count > 0)
            {
                double firstMean = firstHalf.Average();
                double secondMean = secondHalf.Average();

                // If second half is more than 3x faster than first half, flag it
                if (firstMean > 0 && secondMean < firstMean / 3.0)
                {
                    score -= 15;
                    flags.Add(new IntegrityFlagDetail(
                        "SpeedAnomaly",
                        "Answer speed increased dramatically mid-exam — possible external help discovered",
                        "Medium",
                        $"First half avg: {firstMean:F0}ms, Second half avg: {secondMean:F0}ms (ratio: {firstMean / secondMean:F1}x faster)"
                    ));
                }
            }
        }

        // ── Signal 7: Focus lost events ──
        var focusLost = events.Where(e => e.EventType == "FocusLost").ToList();
        if (focusLost.Count > 3)
        {
            score -= Math.Min(10, focusLost.Count * 3);
            flags.Add(new IntegrityFlagDetail(
                "FocusLost",
                $"Browser focus was lost {focusLost.Count} times",
                "Low",
                $"Focus lost at: {string.Join(", ", focusLost.Take(5).Select(e => e.Timestamp.ToString("HH:mm:ss")))}"
            ));
        }

        // Clamp score
        score = Math.Max(0, Math.Min(100, score));

        // Determine label
        string label = score switch
        {
            >= 80 => "High",
            >= 50 => "Medium",
            _ => "Low"
        };

        return new IntegrityResult(Math.Round(score, 1), label, flags, features);
    }

    public FeatureVector7D ExtractFeatures(
        List<Response> responses,
        List<BehavioralEvent> events)
    {
        var tabSwitches = events.Count(e => e.EventType == "TabSwitch");
        var pastes = events.Count(e => e.EventType == "CopyPaste");
        var rightClicks = events.Count(e => e.EventType == "RightClick");
        var focusLost = events.Count(e => e.EventType == "FocusLost");

        var responseTimes = responses.Where(r => r.TimeTakenMs > 0).Select(r => (double)r.TimeTakenMs).ToList();
        double timingCv = 0;
        if (responseTimes.Count >= 2)
        {
            double mean = responseTimes.Average();
            double stdDev = Math.Sqrt(responseTimes.Sum(t => Math.Pow(t - mean, 2)) / responseTimes.Count);
            timingCv = mean > 0 ? stdDev / mean : 0;
        }

        // Idle seconds: sum durations from eventData when available
        double idleSeconds = 0;
        foreach (var idle in events.Where(e => e.EventType == "IdlePeriod"))
        {
            if (TryReadDoubleFromJson(idle.EventData, "durationMs", out var durationMs) && durationMs > 0)
                idleSeconds += durationMs / 1000.0;
        }

        // Mouse entropy: average over MouseMovementSummary events (angleEntropy field)
        double mouseAngleEntropy = 0;
        int mouseSummaries = 0;
        foreach (var mouse in events.Where(e => e.EventType == "MouseMovementSummary"))
        {
            if (TryReadDoubleFromJson(mouse.EventData, "angleEntropy", out var entropy))
            {
                mouseAngleEntropy += entropy;
                mouseSummaries++;
            }
        }
        if (mouseSummaries > 0)
            mouseAngleEntropy /= mouseSummaries;

        // Tab switches per minute: compute over observed session time from events; fall back to responses.
        var start = events.Count > 0 ? events.Min(e => e.Timestamp) : DateTime.UtcNow;
        var end = events.Count > 0 ? events.Max(e => e.Timestamp) : DateTime.UtcNow;
        if (responses.Count > 0)
        {
            // if events are empty, approximate duration using total response time
            if (events.Count == 0)
            {
                var approxSeconds = responseTimes.Sum() / 1000.0;
                end = start.AddSeconds(Math.Max(approxSeconds, 1));
            }
        }

        var durationMinutes = Math.Max(1.0 / 60.0, (end - start).TotalMinutes);
        double tabSwitchesPerMinute = tabSwitches / durationMinutes;

        return new FeatureVector7D(
            TabSwitchesPerMinute: Math.Round(tabSwitchesPerMinute, 4),
            PasteCount: pastes,
            RightClickCount: rightClicks,
            IdleSeconds: Math.Round(idleSeconds, 2),
            FocusLostCount: focusLost,
            TimingCv: Math.Round(timingCv, 6),
            MouseAngleEntropy: Math.Round(mouseAngleEntropy, 6)
        );
    }

    private static bool TryReadDoubleFromJson(string json, string propertyName, out double value)
    {
        value = 0;
        if (string.IsNullOrWhiteSpace(json))
            return false;

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty(propertyName, out var element))
                return false;

            if (element.ValueKind == System.Text.Json.JsonValueKind.Number && element.TryGetDouble(out value))
                return true;

            if (element.ValueKind == System.Text.Json.JsonValueKind.String && double.TryParse(element.GetString(), out value))
                return true;
        }
        catch
        {
            return false;
        }

        return false;
    }
}
