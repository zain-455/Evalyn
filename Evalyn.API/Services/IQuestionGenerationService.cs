using Evalyn.API.Models.DTOs;

namespace Evalyn.API.Services;

public interface IQuestionGenerationService
{
    Task<List<GeneratedQuestionResponse>> GenerateQuestionsAsync(
        GenerateQuestionsRequest request,
        CancellationToken cancellationToken = default);
}
