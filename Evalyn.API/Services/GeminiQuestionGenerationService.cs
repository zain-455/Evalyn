using Evalyn.API.Models.DTOs;
using Microsoft.Extensions.Options;
using System.Text;
using System.Text.Json;

namespace Evalyn.API.Services;

/// <summary>
/// Google Gemini implementation of AI MCQ generation.
/// Keeps a strict contract: returns JSON-only content, validated server-side.
/// </summary>
public class GeminiQuestionGenerationService : IQuestionGenerationService
{
    private readonly HttpClient _http;
    private readonly GeminiSettings _settings;

    public GeminiQuestionGenerationService(HttpClient http, IOptions<GeminiSettings> settings)
    {
        _http = http;
        _settings = settings.Value ?? new GeminiSettings();
    }

    public async Task<List<GeneratedQuestionResponse>> GenerateQuestionsAsync(
        GenerateQuestionsRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            throw new InvalidOperationException("Gemini API key not configured. Set Gemini:ApiKey (or env var Gemini__ApiKey).");

        var topic = (request.Topic ?? string.Empty).Trim();
        if (topic.Length < 3)
            throw new ArgumentException("Topic must be at least 3 characters.", nameof(request));
        if (topic.Length > 200)
            throw new ArgumentException("Topic is too long (max 200 characters).", nameof(request));

        var domain = (request.Domain ?? string.Empty).Trim();
        var subDomain = (request.SubDomain ?? string.Empty).Trim();
        var questionType = (request.QuestionType ?? "MCQ").Trim();

        var difficulty = NormalizeDifficulty(request.Difficulty);
        var count = Math.Clamp(request.Count, 1, 10);

        var system =
            "You are a psychometric question designer. Return ONLY valid JSON. " +
            "No markdown, no code fences, no commentary.\n" +
            "Return a JSON array of objects. Each object must contain:\n" +
            "- questionText (string)\n" +
            "- options: array of objects { text (string), isCorrect (boolean) }\n" +
            "- suggestedDifficulty (number between -3 and 3)\n" +
            "- suggestedDiscrimination (number between 0.5 and 2.5)\n" +
            "- domainTags (optional): array of objects { domainName (string), subDomain (string) }\n";

        var typeInstruction = questionType switch
        {
            "True / False" => "Return exactly 2 options: 'True' and 'False'.",
            "Short answer" => "Return exactly 1 option containing the correct answer text.",
            _ => "Return exactly 4 options with exactly one correct answer."
        };

        var context = new StringBuilder();
        if (!string.IsNullOrEmpty(domain)) context.AppendLine($"Domain: {domain}");
        if (!string.IsNullOrEmpty(subDomain)) context.AppendLine($"Sub-Domain: {subDomain}");

        var difficultyInstruction = difficulty switch
        {
            "mixed" => "Difficulty Mix: Generate a balanced mix of easy, medium, and hard questions. For the total Count, aim for roughly one-third easy, one-third medium, and one-third hard (adjust by +/-1 to sum to Count).",
            "easy" => "Difficulty Target: Easy overall. SuggestedDifficulty should skew lower (easier) on average.",
            "hard" => "Difficulty Target: Hard overall. SuggestedDifficulty should skew higher (harder) on average.",
            _ => "Difficulty Target: Medium overall. SuggestedDifficulty should cluster around the middle on average."
        };

        var userPrompt =
            $"{context}" +
            $"Topic: {topic}\n" +
            $"Question Type: {questionType}\n" +
            $"Difficulty: {difficulty}\n" +
            $"Count: {count}\n" +
            $"{difficultyInstruction}\n" +
            $"Constraint: {typeInstruction}\n" +
            "Create exam-ready questions. Keep them unambiguous and avoid trick wording.";

        var body = new
        {
            systemInstruction = new
            {
                parts = new[] { new { text = system } }
            },
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new[] { new { text = userPrompt } }
                }
            },
            generationConfig = new
            {
                temperature = _settings.Temperature,
                maxOutputTokens = _settings.MaxOutputTokens
            }
        };

        var url = $"v1beta/models/{_settings.Model}:generateContent?key={Uri.EscapeDataString(_settings.ApiKey)}";
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };

        using var response = await _http.SendAsync(httpRequest, HttpCompletionOption.ResponseContentRead, cancellationToken);
        var responseText = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Gemini API error ({(int)response.StatusCode}). {Truncate(responseText, 800)}");

        var assistantText = ExtractAssistantText(responseText);
        assistantText = StripCodeFences(assistantText).Trim();

        var results = QuestionGenerationJson.ParseQuestionsJson(assistantText);
        if (results.Count == 0)
            throw new InvalidOperationException("AI returned no questions.");

        return results.Take(count).ToList();
    }

    private static string NormalizeDifficulty(string? difficulty)
    {
        var d = (difficulty ?? string.Empty).Trim().ToLowerInvariant();
        return d switch
        {
            "easy" or "e" => "easy",
            "mixed" or "mix" => "mixed",
            "hard" or "h" => "hard",
            _ => "medium"
        };
    }

    private static string ExtractAssistantText(string responseJson)
    {
        using var doc = JsonDocument.Parse(responseJson);

        if (!doc.RootElement.TryGetProperty("candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array)
            throw new InvalidOperationException("Unexpected Gemini response: missing candidates array.");

        var first = candidates.EnumerateArray().FirstOrDefault();
        if (first.ValueKind != JsonValueKind.Object)
            throw new InvalidOperationException("Unexpected Gemini response: empty candidates.");

        if (!first.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Object)
            throw new InvalidOperationException("Unexpected Gemini response: missing content.");

        if (!content.TryGetProperty("parts", out var parts) || parts.ValueKind != JsonValueKind.Array)
            throw new InvalidOperationException("Unexpected Gemini response: missing parts.");

        foreach (var part in parts.EnumerateArray())
        {
            if (part.ValueKind == JsonValueKind.Object && part.TryGetProperty("text", out var textEl))
                return textEl.GetString() ?? string.Empty;
        }

        return string.Empty;
    }

    private static string StripCodeFences(string text)
    {
        var trimmed = text.Trim();
        if (!trimmed.StartsWith("```", StringComparison.Ordinal))
            return text;

        var firstNewline = trimmed.IndexOf('\n');
        if (firstNewline < 0) return text;
        var withoutFirstLine = trimmed[(firstNewline + 1)..];
        var lastFence = withoutFirstLine.LastIndexOf("```", StringComparison.Ordinal);
        if (lastFence >= 0)
            return withoutFirstLine[..lastFence];
        return withoutFirstLine;
    }

    private static string Truncate(string text, int max)
    {
        if (string.IsNullOrEmpty(text) || text.Length <= max) return text;
        return text[..max] + "…";
    }
}

/// <summary>
/// Shared JSON parsing/validation for LLM MCQ output.
/// </summary>
internal static class QuestionGenerationJson
{
    public static List<GeneratedQuestionResponse> ParseQuestionsJson(string json)
    {
        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.ValueKind != JsonValueKind.Array)
            throw new InvalidOperationException("AI output must be a JSON array.");

        var list = new List<GeneratedQuestionResponse>();

        foreach (var item in doc.RootElement.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object) continue;

            var questionText = GetRequiredString(item, "questionText");
            var options = ParseOptions(item);
            var suggestedDifficulty = ClampNumber(GetOptionalNumber(item, "suggestedDifficulty", 0), -4, 4);
            var suggestedDiscrimination = ClampNumber(GetOptionalNumber(item, "suggestedDiscrimination", 1.0), 0.2, 3.0);
            var domainTags = ParseDomainTags(item);

            list.Add(new GeneratedQuestionResponse(
                questionText,
                options,
                suggestedDifficulty,
                suggestedDiscrimination,
                domainTags
            ));
        }

        return list;
    }

    private static List<GeneratedQuestionOption> ParseOptions(JsonElement item)
    {
        if (!item.TryGetProperty("options", out var optionsEl) || optionsEl.ValueKind != JsonValueKind.Array)
            throw new InvalidOperationException("Each question must include an options array.");

        var options = new List<GeneratedQuestionOption>();
        foreach (var opt in optionsEl.EnumerateArray())
        {
            if (opt.ValueKind != JsonValueKind.Object) continue;
            var text = GetRequiredString(opt, "text");
            var isCorrect = opt.TryGetProperty("isCorrect", out var c) && c.ValueKind == JsonValueKind.True;
            options.Add(new GeneratedQuestionOption(text, isCorrect));
        }

        if (options.Count == 0)
            throw new InvalidOperationException("Each question must have at least one option.");

        var correctCount = options.Count(o => o.IsCorrect);
        if (correctCount == 0)
            options[0] = options[0] with { IsCorrect = true };
        else if (correctCount > 1)
        {
            var firstCorrectIdx = options.FindIndex(o => o.IsCorrect);
            for (int i = 0; i < options.Count; i++)
                options[i] = options[i] with { IsCorrect = i == firstCorrectIdx };
        }

        return options;
    }

    private static List<GeneratedDomainTag>? ParseDomainTags(JsonElement item)
    {
        if (!item.TryGetProperty("domainTags", out var tagsEl) || tagsEl.ValueKind != JsonValueKind.Array)
            return null;

        var tags = new List<GeneratedDomainTag>();
        foreach (var tag in tagsEl.EnumerateArray())
        {
            if (tag.ValueKind != JsonValueKind.Object) continue;
            var domain = GetOptionalString(tag, "domainName");
            var sub = GetOptionalString(tag, "subDomain");
            if (string.IsNullOrWhiteSpace(domain) && string.IsNullOrWhiteSpace(sub))
                continue;
            tags.Add(new GeneratedDomainTag((domain ?? string.Empty).Trim(), (sub ?? string.Empty).Trim()));
            if (tags.Count >= 2) break;
        }

        return tags.Count == 0 ? null : tags;
    }

    private static string GetRequiredString(JsonElement obj, string property)
    {
        if (!obj.TryGetProperty(property, out var el) || el.ValueKind != JsonValueKind.String)
            throw new InvalidOperationException($"Missing required string field: {property}.");
        var value = (el.GetString() ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException($"Field '{property}' cannot be empty.");
        return value;
    }

    private static string? GetOptionalString(JsonElement obj, string property)
    {
        if (!obj.TryGetProperty(property, out var el) || el.ValueKind != JsonValueKind.String)
            return null;
        return el.GetString();
    }

    private static double GetOptionalNumber(JsonElement obj, string property, double fallback)
    {
        if (!obj.TryGetProperty(property, out var el))
            return fallback;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetDouble(out var d))
            return d;
        return fallback;
    }

    private static double ClampNumber(double v, double min, double max) => Math.Min(max, Math.Max(min, v));
}
