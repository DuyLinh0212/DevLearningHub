using DevLearningHub.Api.Extensions;

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

    private readonly IPermissionService _permissions;

    public AutoApprovalPolicy(IPermissionService permissions)
    {
        _permissions = permissions;
    }

    // Admins (system.full_control) are trusted moderators of their own content, so
    // anything they create/publish is approved immediately instead of entering the
    // moderation queue they themselves would review.
    private Task<bool> IsAdminAsync(Guid creatorId)
        => _permissions.HasPermissionAsync(creatorId, ClaimsPrincipalExtensions.FullControlPermission);

    // Private content is never shown publicly, so it never needs moderation review.
    public async Task<string> EvaluatePostAsync(Guid creatorId, string title, string? bodyMarkdown, bool isPublic)
        => !isPublic || await IsAdminAsync(creatorId) ? ApprovedReviewStatus : PendingReviewStatus;

    public async Task<string> EvaluateProblemAsync(Guid creatorId, string title, string? description, bool isPublic)
        => !isPublic || await IsAdminAsync(creatorId) ? ApprovedReviewStatus : PendingReviewStatus;

    public async Task<string> EvaluateQuizSetAsync(Guid creatorId, string title, string? description, bool isPublic)
        => !isPublic || await IsAdminAsync(creatorId) ? ApprovedReviewStatus : PendingReviewStatus;

    public async Task<string> EvaluateProblemBankAsync(Guid creatorId, Guid? bankId, string title, string? description, bool isPublic)
        => !isPublic || await IsAdminAsync(creatorId) ? ApprovedReviewStatus : PendingReviewStatus;

    public async Task<string> EvaluateRoadmapAsync(Guid creatorId, Guid? roadmapId, string title, string? description, bool isPublic)
        => !isPublic || await IsAdminAsync(creatorId) ? ApprovedReviewStatus : PendingReviewStatus;
}
