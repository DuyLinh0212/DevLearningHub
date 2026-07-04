using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Admin;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Admin;

[ApiController]
[Route("api/admin/moderation")]
[Authorize]
public class AdminModerationController : ControllerBase
{
    private static readonly string[] ValidStatuses = ["pending", "approved", "rejected"];

    private readonly DevLearningHubContext _db;
    private readonly IAuditService _audit;

    public AdminModerationController(DevLearningHubContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet("queue")]
    [HasPermission("analytics:view")]
    public async Task<ActionResult<ApiResponse<List<ModerationQueueItemResponse>>>> GetQueue(
        [FromQuery] string? type = null,
        [FromQuery] string status = "pending")
    {
        status = NormalizeStatus(status);
        var types = string.IsNullOrWhiteSpace(type)
            ? new[] { "post", "problem", "problem_bank", "quiz_set" }
            : new[] { NormalizeType(type) };

        var result = new List<ModerationQueueItemResponse>();
        foreach (var itemType in types)
        {
            result.AddRange(await QueryItemsAsync(itemType, status));
        }

        return Ok(ApiResponse<List<ModerationQueueItemResponse>>.Ok(
            result.OrderByDescending(i => i.CreatedAt).ToList()));
    }

    [HttpPost("{type}/{id:guid}/approve")]
    public Task<ActionResult<ApiResponse<object>>> Approve(string type, Guid id, ReviewContentRequest request)
    {
        return ReviewAsync(type, id, "approved", request.Reason);
    }

    [HttpPost("{type}/{id:guid}/reject")]
    public Task<ActionResult<ApiResponse<object>>> Reject(string type, Guid id, ReviewContentRequest request)
    {
        return ReviewAsync(type, id, "rejected", request.Reason);
    }

    private async Task<ActionResult<ApiResponse<object>>> ReviewAsync(string type, Guid id, string status, string? reason)
    {
        type = NormalizeType(type);
        if (!User.TryGetUserId(out var reviewerId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        if (!User.HasPermission(PermissionFor(type)))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        var note = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        switch (type)
        {
            case "post":
                var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == id);
                if (post == null) return NotFound(ApiResponse<object>.Fail("Post not found."));
                post.ReviewStatus = status;
                post.ReviewedBy = reviewerId;
                post.ReviewedAt = DateTime.Now;
                post.ReviewNote = note;
                break;

            case "problem":
                var problem = await _db.Problems.FirstOrDefaultAsync(p => p.Id == id);
                if (problem == null) return NotFound(ApiResponse<object>.Fail("Problem not found."));
                problem.ReviewStatus = status;
                problem.ReviewedBy = reviewerId;
                problem.ReviewedAt = DateTime.Now;
                problem.ReviewNote = note;
                problem.IsActive = status == "approved";
                break;

            case "problem_bank":
                var bank = await _db.ProblemBanks.FirstOrDefaultAsync(b => b.Id == id);
                if (bank == null) return NotFound(ApiResponse<object>.Fail("Problem bank not found."));
                bank.ReviewStatus = status;
                bank.ReviewedBy = reviewerId;
                bank.ReviewedAt = DateTime.Now;
                bank.ReviewNote = note;
                break;

            case "quiz_set":
                var quizSet = await _db.QuizSets.FirstOrDefaultAsync(q => q.Id == id);
                if (quizSet == null) return NotFound(ApiResponse<object>.Fail("Quiz set not found."));
                quizSet.ReviewStatus = status;
                quizSet.ReviewedBy = reviewerId;
                quizSet.ReviewedAt = DateTime.Now;
                quizSet.ReviewNote = note;
                break;
        }

        _db.ModerationLogs.Add(new ModerationLog
        {
            Id = Guid.NewGuid(),
            ModeratorId = reviewerId,
            TargetType = type,
            TargetId = id,
            Action = $"review.{status}",
            Reason = note,
            CreatedAt = DateTime.Now
        });

        await _db.SaveChangesAsync();
        await _audit.LogAsync($"moderation.review.{status}", type, id, note);

        return Ok(ApiResponse<object>.Ok(new { type, id, status }));
    }

    private async Task<List<ModerationQueueItemResponse>> QueryItemsAsync(string type, string status)
    {
        return type switch
        {
            "post" => await _db.Posts.AsNoTracking()
                .Where(p => p.ReviewStatus == status)
                .Select(p => new ModerationQueueItemResponse
                {
                    Type = "post",
                    Id = p.Id,
                    Title = p.Title,
                    ReviewStatus = p.ReviewStatus,
                    AuthorUsername = p.Author.Username,
                    AuthorFullName = p.Author.FullName,
                    CreatedAt = p.CreatedAt,
                    ReviewedBy = p.ReviewedBy,
                    ReviewedAt = p.ReviewedAt,
                    ReviewNote = p.ReviewNote
                }).ToListAsync(),
            "problem" => await _db.Problems.AsNoTracking()
                .Where(p => p.ReviewStatus == status)
                .Select(p => new ModerationQueueItemResponse
                {
                    Type = "problem",
                    Id = p.Id,
                    Title = p.Title,
                    ReviewStatus = p.ReviewStatus,
                    AuthorUsername = p.CreatedByNavigation.Username,
                    AuthorFullName = p.CreatedByNavigation.FullName,
                    CreatedAt = p.CreatedAt,
                    ReviewedBy = p.ReviewedBy,
                    ReviewedAt = p.ReviewedAt,
                    ReviewNote = p.ReviewNote
                }).ToListAsync(),
            "problem_bank" => await _db.ProblemBanks.AsNoTracking()
                .Where(b => b.ReviewStatus == status)
                .Select(b => new ModerationQueueItemResponse
                {
                    Type = "problem_bank",
                    Id = b.Id,
                    Title = b.Title,
                    ReviewStatus = b.ReviewStatus,
                    AuthorUsername = b.CreatedByNavigation.Username,
                    AuthorFullName = b.CreatedByNavigation.FullName,
                    CreatedAt = b.CreatedAt,
                    ReviewedBy = b.ReviewedBy,
                    ReviewedAt = b.ReviewedAt,
                    ReviewNote = b.ReviewNote
                }).ToListAsync(),
            "quiz_set" => await _db.QuizSets.AsNoTracking()
                .Where(q => q.ReviewStatus == status)
                .Select(q => new ModerationQueueItemResponse
                {
                    Type = "quiz_set",
                    Id = q.Id,
                    Title = q.Title,
                    ReviewStatus = q.ReviewStatus,
                    AuthorUsername = q.CreatedByNavigation.Username,
                    AuthorFullName = q.CreatedByNavigation.FullName,
                    CreatedAt = q.CreatedAt,
                    ReviewedBy = q.ReviewedBy,
                    ReviewedAt = q.ReviewedAt,
                    ReviewNote = q.ReviewNote
                }).ToListAsync(),
            _ => new List<ModerationQueueItemResponse>()
        };
    }

    private static string NormalizeType(string type)
    {
        var normalized = type.Trim().ToLowerInvariant();
        if (normalized is "problem-bank" or "problem_bank") return "problem_bank";
        if (normalized is "quiz-set" or "quiz_set") return "quiz_set";
        if (normalized is "post" or "problem") return normalized;
        throw new ArgumentException("Invalid moderation type.");
    }

    private static string NormalizeStatus(string status)
    {
        var normalized = status.Trim().ToLowerInvariant();
        return ValidStatuses.Contains(normalized) ? normalized : "pending";
    }

    private static string PermissionFor(string type)
    {
        return type switch
        {
            "post" => "post:review",
            "problem" => "problem:review",
            "problem_bank" => "problem_bank:review",
            "quiz_set" => "quiz:review",
            _ => "system.full_control"
        };
    }
}
