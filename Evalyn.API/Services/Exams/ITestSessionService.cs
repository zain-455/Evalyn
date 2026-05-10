using Evalyn.API.Models.DTOs;

namespace Evalyn.API.Services.Exams;

public interface ITestSessionService
{
    Task<StartExamResponse> StartSessionAsync(int examId, string userId);
    Task<SubmitAnswerResponse> SubmitAnswerAsync(int sessionId, string userId, SubmitAnswerRequest request);
    Task<TestResultResponse> GetResultAsync(int sessionId, string userId, string userRole);
    Task<object> GetMyHistoryAsync(string userId);
    Task LogEventAsync(int sessionId, string userId, BehavioralEventRequest request);
    Task LogEventsBatchAsync(int sessionId, string userId, IReadOnlyList<BehavioralEventRequest> events);
}
