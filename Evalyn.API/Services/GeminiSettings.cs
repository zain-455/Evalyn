namespace Evalyn.API.Services;

public class GeminiSettings
{
    /// <summary>
    /// Google Gemini API key.
    /// Prefer environment variable: Gemini__ApiKey
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Model id for Generative Language API.
    /// Examples: "gemini-1.5-flash", "gemini-1.5-pro".
    /// </summary>
    public string Model { get; set; } = "gemini-1.5-flash";

    public int MaxOutputTokens { get; set; } = 1400;
    public double Temperature { get; set; } = 0.2;
    public int TimeoutSeconds { get; set; } = 60;
}
