using Evalyn.API.Models.DTOs;

namespace Evalyn.API.Services.Exams;

public interface IExamService
{
    Task<List<object>> GetExamsForUserAsync(string userId, string userRole, int? skip = null, int? take = null);
    Task<ExamResponse> GetExamAsync(int examId, string userId, string userRole);
    Task<ExamResponse> CreateExamAsync(CreateExamRequest request, string userId);
    Task PublishExamAsync(int examId, string userId, string userRole);
    Task DeleteExamAsync(int examId, string userId, string userRole);
}
