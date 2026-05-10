namespace Evalyn.API.Models.Entities;

public class BehavioralFeatureVector
{
    // 1:1 with TestSession
    public int TestSessionId { get; set; }

    // 7D feature vector
    public double TabSwitchesPerMinute { get; set; }
    public int PasteCount { get; set; }
    public int RightClickCount { get; set; }
    public double IdleSeconds { get; set; }
    public int FocusLostCount { get; set; }
    public double TimingCv { get; set; }
    public double MouseAngleEntropy { get; set; }

    public DateTime ComputedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public TestSession TestSession { get; set; } = null!;
}
