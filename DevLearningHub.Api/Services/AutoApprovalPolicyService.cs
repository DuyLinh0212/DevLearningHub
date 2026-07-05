namespace DevLearningHub.Api.Services;

public interface IAutoApprovalPolicy
{
    Task<string> EvaluatePostAsync(Guid creatorId, string title, string? bodyMarkdown, bool isPublic);
    Task<string> EvaluateProblemAsync(Guid creatorId, string title, string? description, bool isPublic);
    Task<string> EvaluateQuizSetAsync(Guid creatorId, string title, string? description, bool isPublic);
    Task<string> EvaluateProblemBankAsync(Guid creatorId, Guid? bankId, string title, string? description, bool isPublic);
    Task<string> EvaluateRoadmapAsync(Guid creatorId, Guid? roadmapId, string title, string? description, bool isPublic);
}

public sealed class AutoApprovalPolicy : IAutoApprovalPolicy
{
    private const string PendingReviewStatus = "pending";
    private const string ApprovedReviewStatus = "approved";

    // Private content is never shown publicly, so it never needs moderation review.
    public Task<string> EvaluatePostAsync(Guid creatorId, string title, string? bodyMarkdown, bool isPublic)
        => Task.FromResult(isPublic ? PendingReviewStatus : ApprovedReviewStatus);

    public Task<string> EvaluateProblemAsync(Guid creatorId, string title, string? description, bool isPublic)
        => Task.FromResult(isPublic ? PendingReviewStatus : ApprovedReviewStatus);

    public Task<string> EvaluateQuizSetAsync(Guid creatorId, string title, string? description, bool isPublic)
        => Task.FromResult(isPublic ? PendingReviewStatus : ApprovedReviewStatus);

    public Task<string> EvaluateProblemBankAsync(Guid creatorId, Guid? bankId, string title, string? description, bool isPublic)
        => Task.FromResult(isPublic ? PendingReviewStatus : ApprovedReviewStatus);

    public Task<string> EvaluateRoadmapAsync(Guid creatorId, Guid? roadmapId, string title, string? description, bool isPublic)
        => Task.FromResult(isPublic ? PendingReviewStatus : ApprovedReviewStatus);
}
