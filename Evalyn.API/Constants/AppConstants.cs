namespace Evalyn.API.Constants;

public static class Roles
{
    public const string Student = "Student";
    public const string Instructor = "Instructor";
    public const string Admin = "Admin";

    // For [Authorize(Roles = ...)] which requires a compile-time constant
    public const string InstructorOrAdmin = "Instructor,Admin";
}

public static class ExamStatuses
{
    public const string Draft = "Draft";
    public const string Published = "Published";
    public const string Archived = "Archived";
}

public static class TestSessionStatuses
{
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Abandoned = "Abandoned";
}
