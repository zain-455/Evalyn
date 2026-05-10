using Evalyn.API.Constants;
using System.ComponentModel.DataAnnotations;

namespace Evalyn.API.Models.DTOs;

// ── Auth DTOs ──────────────────────────────────────────
public record RegisterRequest(
    [param: Required, EmailAddress, StringLength(256)] string Email,
    [param: Required, StringLength(128, MinimumLength = 6)] string Password,
    [param: Required, StringLength(120, MinimumLength = 2)] string FullName,
    [param: Required, StringLength(120, MinimumLength = 2)] string Institution,
    [param: Required, StringLength(80, MinimumLength = 2)] string Identifier,
    [param: Required, StringLength(30)] string Role = Roles.Student,
    string? Section = null
);
public record LoginRequest(
    [param: Required, EmailAddress, StringLength(256)] string Email,
    [param: Required, StringLength(128, MinimumLength = 6)] string Password
);
public record AuthResponse(string Token, string Email, string FullName, string Role, DateTime ExpiresAt);

// ── Student / User DTOs ───────────────────────────────
public record StudentAssessmentSummary(
    int ExamId,
    string? ExamTitle,
    string Status,
    DateTime StartedAt,
    DateTime? CompletedAt
);

public record StudentSummaryResponse(
    string Id,
    string? FullName,
    string? Email,
    string? Institution,
    string? Identifier,
    string? Section,
    DateTime CreatedAt,
    int CompletedSessions,
    int AttemptedSessions,
    List<StudentAssessmentSummary> AttemptedAssessments
);

// ── Exam DTOs ──────────────────────────────────────────
public record CreateExamRequest(
    [param: Required, StringLength(160, MinimumLength = 3)] string Title,
    [param: StringLength(2000)] string? Description,   // Optional — removed Required, made nullable
    [param: Range(1, 1440)] int DurationMinutes,
    bool IsAdaptive,
    [param: Range(1, 500)] int MaxQuestions,
    [param: Required, StringLength(30)] string AudienceType = "SECTION",
    List<string>? Sections = null,
    List<string>? StudentIds = null,
    DateTime? StartsAtUtc = null,
    DateTime? EndsAtUtc = null
);
public record ExamResponse(int Id, string Title, string? Description, int DurationMinutes, bool IsAdaptive, int MaxQuestions, string Status, int QuestionCount, DateTime CreatedAt, DateTime? StartsAtUtc, DateTime? EndsAtUtc);
public record ExamListResponse(int Id, string Title, string Status, int QuestionCount, bool IsAdaptive, int MaxQuestions, bool HasPoolSettings, DateTime CreatedAt, DateTime? StartsAtUtc, DateTime? EndsAtUtc);
public record StudentExamListResponse(
    int Id, string Title, string Status, int QuestionCount, bool IsAdaptive, int MaxQuestions,
    bool HasPoolSettings, DateTime CreatedAt, int DurationMinutes,
    int? SessionId, string? SessionStatus, DateTime? SessionStartedAt, int? TotalCorrect, int? TotalQuestions, double? PercentileRank, DateTime? CompletedAt,
    DateTime? StartsAtUtc, DateTime? EndsAtUtc
);

public record ExamPoolSettingsResponse(
    bool AllowAIGenerated,
    bool RequireCalibrated,
    double MinDifficulty,
    double MaxDifficulty,
    List<DomainTagFilter> AllowedTags,
    int ExamQuestionCount,
    int AttachedBankQuestionCount,
    int EffectivePoolCount
);

public record DomainTagFilter(
    [param: Required, StringLength(120, MinimumLength = 2)] string DomainName,
    [param: Required, StringLength(120, MinimumLength = 1)] string SubDomain
);

public record UpdateExamPoolSettingsRequest(
    bool AllowAIGenerated,
    bool RequireCalibrated,
    [param: Range(-4.0, 4.0)] double MinDifficulty,
    [param: Range(-4.0, 4.0)] double MaxDifficulty,
    List<DomainTagFilter>? AllowedTags
);

public record AttachBankQuestionsRequest(
    [param: Required, MinLength(1)] List<int> QuestionIds
);

public record PooledQuestionResponse(QuestionResponse Question, string Source);

// ── Question DTOs ──────────────────────────────────────
public record CreateQuestionRequest(
    [param: Required, StringLength(5000, MinimumLength = 5)] string QuestionText,
    [param: Required, StringLength(30)] string QuestionType,
    [param: Range(-4.0, 4.0)] double IRT_Difficulty,
    [param: Range(0.2, 3.0)] double IRT_Discrimination,
    [param: Required, StringLength(30)] string DifficultyLabel,
    [param: Required, MinLength(1), MaxLength(10)] List<CreateOptionRequest> Options,
    List<CreateDomainTagRequest>? DomainTags,
    bool IsAIGenerated = false
);

public record UpdateQuestionRequest(
    [param: Required, StringLength(5000, MinimumLength = 5)] string QuestionText,
    [param: Required, StringLength(30)] string QuestionType,
    [param: Range(-4.0, 4.0)] double IRT_Difficulty,
    [param: Range(0.2, 3.0)] double IRT_Discrimination,
    [param: Required, StringLength(30)] string DifficultyLabel,
    [param: Required, MinLength(1), MaxLength(10)] List<CreateOptionRequest> Options,
    List<CreateDomainTagRequest>? DomainTags,
    bool IsAIGenerated = false
);
public record CreateOptionRequest(
    [param: Required, StringLength(1000, MinimumLength = 1)] string OptionText,
    bool IsCorrect
);
public record CreateDomainTagRequest(
    [param: Required, StringLength(120, MinimumLength = 2)] string DomainName,
    [param: Required, StringLength(120, MinimumLength = 1)] string SubDomain
);

public record QuestionResponse(
    int Id,
    string QuestionText,
    string QuestionType,
    double IRT_Difficulty,
    double IRT_Discrimination,
    string DifficultyLabel,
    bool IsCalibrated,
    bool IsAIGenerated,
    List<OptionResponse> Options,
    List<DomainTagResponse> DomainTags
);
public record OptionResponse(int Id, string OptionText, bool IsCorrect);
public record DomainTagResponse(int Id, string DomainName, string SubDomain);

// ── Test Session DTOs ──────────────────────────────────
public record StartExamResponse(
    int SessionId,
    string ExamTitle,
    QuestionDto FirstQuestion,
    int TotalQuestions,
    int DurationMinutes,
    int RemainingSeconds,
    int CurrentQuestionNumber,
    bool IsResumed
);
public record SubmitAnswerRequest(
    [param: Range(1, int.MaxValue)] int QuestionId,
    [param: Range(1, int.MaxValue)] int SelectedOptionId,
    [param: Range(0, 3_600_000)] int TimeTakenMs
);
public record SubmitAnswerResponse(bool IsCorrect, double CurrentTheta, QuestionDto? NextQuestion, bool IsComplete);

public record QuestionDto(int Id, string QuestionText, string QuestionType, List<OptionDto> Options, int QuestionNumber);
public record OptionDto(int Id, string OptionText);

public record TestResultResponse(
    int SessionId,
    string ExamTitle,
    double ThetaEstimate,
    double ThetaSEM,
    double PercentileRank,
    int TotalCorrect,
    int TotalQuestions,
    double IntegrityScore,
    string IntegrityLabel,
    double? AnomalyScore,
    DateTime StartedAt,
    DateTime? CompletedAt,
    List<SkillDomainScore> SkillMap,
    List<IntegrityFlag> IntegrityFlags
);
public record SkillDomainScore(string Domain, string SubDomain, double MasteryPercentage, int Correct, int Total);
public record IntegrityFlag(string Signal, string Description, string Severity, string Evidence);

// ── Behavioral Event DTOs ──────────────────────────────
public record BehavioralEventRequest(
    [param: Required, StringLength(60, MinimumLength = 2)] string EventType,
    [param: Required, StringLength(4000)] string EventData
);

// ── AI Question Generation DTOs ───────────────────────
public record GenerateQuestionsRequest(
    [param: Required, StringLength(200, MinimumLength = 3)] string Topic,
    [param: StringLength(20)] string Difficulty = "medium",
    [param: Range(1, 10)] int Count = 5,
    string? Domain = null,
    string? SubDomain = null,
    string? QuestionType = "MCQ"
);

public record GeneratedQuestionOption(string Text, bool IsCorrect);
public record GeneratedDomainTag(string DomainName, string SubDomain);

public record GeneratedQuestionResponse(
    string QuestionText,
    List<GeneratedQuestionOption> Options,
    double SuggestedDifficulty,
    double SuggestedDiscrimination,
    List<GeneratedDomainTag>? DomainTags
);