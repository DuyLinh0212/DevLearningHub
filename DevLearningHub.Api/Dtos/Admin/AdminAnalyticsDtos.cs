namespace DevLearningHub.Api.Dtos.Admin;

public class QuizSetAnalyticsResponse
{
    public Guid QuizSetId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int TotalAttempts { get; set; }
    public int CompletedAttempts { get; set; }
    public int ParticipantCount { get; set; }
    public double AverageScore { get; set; }
    public double AverageAccuracy { get; set; }
    public DateTime? LastAttemptAt { get; set; }
}

public class QuizSetParticipantResponse
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public int AttemptsCount { get; set; }
    public int CompletedAttempts { get; set; }
    public int BestScore { get; set; }
    public int BestTotalQuestions { get; set; }
    public double BestAccuracy { get; set; }
    public DateTime? LastAttemptAt { get; set; }
}

public class ProblemBankAnalyticsResponse
{
    public Guid BankId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int ProblemCount { get; set; }
    public int ParticipantCount { get; set; }
    public double AverageCompletionPercent { get; set; }
    public double AverageAccuracyPercent { get; set; }
    public int SolvedSubmissionCount { get; set; }
}

public class ModeratorDashboardAnalyticsResponse
{
    public int PendingReports { get; set; }
    public int PendingPosts { get; set; }
    public int PendingProblems { get; set; }
    public int PendingProblemBanks { get; set; }
    public int PendingQuizSets { get; set; }
    public int HiddenPosts { get; set; }
    public int TotalPosts { get; set; }
    public int TotalProblems { get; set; }
    public int TotalQuizSets { get; set; }
    public int TotalProblemBanks { get; set; }
    public List<RecentModerationActivityResponse> RecentActivities { get; set; } = new();
}

public class RecentModerationActivityResponse
{
    public Guid Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? TargetType { get; set; }
    public Guid? TargetId { get; set; }
    public string? Detail { get; set; }
    public DateTime CreatedAt { get; set; }
}
