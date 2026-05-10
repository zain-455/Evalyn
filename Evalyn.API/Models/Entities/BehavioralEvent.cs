namespace Evalyn.API.Models.Entities;

public class BehavioralEvent
{
    public int Id { get; set; }
    public int TestSessionId { get; set; }
    public string EventType { get; set; } = string.Empty;
    // EventTypes: "TabSwitch", "CopyPaste", "RightClick", "IdlePeriod",
    //             "MouseMovement", "KeystrokePattern", "QuestionRevisit", "FocusLost"
    public string EventData { get; set; } = "{}";  // JSON payload with event-specific details
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    // Navigation
    public TestSession TestSession { get; set; } = null!;
}
