using Evalyn.API.Models.Entities;

namespace Evalyn.API.Services.Exams;

public static class ExamPoolCalculator
{
    public static List<Question> BuildEffectivePool(Exam exam)
    {
        if (exam == null) throw new ArgumentNullException(nameof(exam));

        var pool = new List<Question>();
        if (exam.Questions != null && exam.Questions.Count > 0)
            pool.AddRange(exam.Questions);

        if (exam.QuestionPoolItems != null && exam.QuestionPoolItems.Count > 0)
            pool.AddRange(exam.QuestionPoolItems.Select(x => x.Question));

        // De-dupe by Question.Id
        pool = pool
            .Where(q => q != null)
            .GroupBy(q => q.Id)
            .Select(g => g.First())
            .ToList();

        var settings = exam.PoolSettings;
        if (settings == null)
            return pool;

        // Difficulty range
        pool = pool
            .Where(q => q.IRT_Difficulty >= settings.MinDifficulty && q.IRT_Difficulty <= settings.MaxDifficulty)
            .ToList();

        // AI filter
        if (!settings.AllowAIGenerated)
            pool = pool.Where(q => !q.IsAIGenerated).ToList();

        // Calibrated-only filter
        if (settings.RequireCalibrated)
            pool = pool.Where(q => q.IsCalibrated).ToList();

        // Domain constraints: if any tags are configured, allow questions matching ANY configured tag.
        if (settings.AllowedTags != null && settings.AllowedTags.Count > 0)
        {
            var allowed = settings.AllowedTags
                .Select(t => (DomainName: t.DomainName.Trim(), SubDomain: t.SubDomain.Trim()))
                .Where(x => x.DomainName.Length > 0 && x.SubDomain.Length > 0)
                .ToHashSet();

            if (allowed.Count > 0)
            {
                pool = pool.Where(q => q.DomainTags.Any(dt => allowed.Contains((dt.DomainName, dt.SubDomain)))).ToList();
            }
        }

        return pool;
    }
}
