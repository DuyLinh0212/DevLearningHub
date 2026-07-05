using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Quiz;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Quiz;

[ApiController]
[Route("api/roadmaps")]
public class RoadmapsController : ControllerBase
{
    private readonly DevLearningHubContext _db;
    private readonly IPermissionService _permissions;
    private readonly IAutoApprovalPolicy _autoApproval;

    public RoadmapsController(DevLearningHubContext db, IPermissionService permissions, IAutoApprovalPolicy autoApproval)
    {
        _db = db;
        _permissions = permissions;
        _autoApproval = autoApproval;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<RoadmapResponse>>>> GetRoadmaps()
    {
        User.TryGetUserId(out var userId);
        var canManageAny = userId != Guid.Empty && await CanManageAnyRoadmapAsync(userId);

        var query = _db.Roadmaps
            .Include(r => r.RoadmapTopics)
                .ThenInclude(rt => rt.Topic)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.Topic)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.QuizSet)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.Problem)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.ProblemBank)
            .AsNoTracking()
            .AsQueryable();

        if (!canManageAny)
        {
            query = query.Where(r =>
                (r.IsPublic && r.ReviewStatus == "approved") ||
                (userId != Guid.Empty && r.CreatedBy == userId));
        }

        var roadmaps = await query
            .OrderBy(r => r.OrderIndex)
            .ThenByDescending(r => r.CreatedAt)
            .ToListAsync();

        return Ok(ApiResponse<List<RoadmapResponse>>.Ok(roadmaps.Select(BuildRoadmapResponse).ToList()));
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<RoadmapResponse>>> GetRoadmap(Guid id)
    {
        var roadmap = await _db.Roadmaps
            .Include(r => r.RoadmapTopics)
                .ThenInclude(rt => rt.Topic)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.Topic)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.QuizSet)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.Problem)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.ProblemBank)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id);
        if (roadmap == null)
        {
            return NotFound(ApiResponse<RoadmapResponse>.Fail("Roadmap not found."));
        }

        if (!await CanViewRoadmapAsync(roadmap))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<RoadmapResponse>.Fail("Forbidden."));
        }

        return Ok(ApiResponse<RoadmapResponse>.Ok(BuildRoadmapResponse(roadmap)));
    }

    [HttpPost]
    [HasPermission("roadmap:create")]
    public async Task<ActionResult<ApiResponse<RoadmapResponse>>> CreateRoadmap([FromBody] CreateRoadmapRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ApiResponse<RoadmapResponse>.Fail("Invalid data."));
        }

        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<RoadmapResponse>.Fail("Unauthorized."));
        }

        var maxOrder = await _db.Roadmaps.Select(r => (int?)r.OrderIndex).MaxAsync() ?? 0;
        var reviewStatus = await _autoApproval.EvaluateRoadmapAsync(userId, null, request.Title, request.Description, request.IsPublic);

        var roadmap = new Roadmap
        {
            Id = Guid.NewGuid(),
            CreatedBy = userId,
            Title = request.Title.Trim(),
            Level = request.Level.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsPublic = request.IsPublic,
            ReviewStatus = reviewStatus,
            CreatedAt = DateTime.Now,
            OrderIndex = (short)(maxOrder + 1)
        };

        _db.Roadmaps.Add(roadmap);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<RoadmapResponse>.Ok(BuildRoadmapResponse(roadmap)));
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<RoadmapResponse>>> UpdateRoadmap(Guid id, [FromBody] UpdateRoadmapRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ApiResponse<RoadmapResponse>.Fail("Invalid data."));
        }

        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<RoadmapResponse>.Fail("Unauthorized."));
        }

        var roadmap = await _db.Roadmaps
            .Include(r => r.RoadmapTopics)
                .ThenInclude(rt => rt.Topic)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.Topic)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.QuizSet)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.Problem)
            .Include(r => r.RoadmapItems)
                .ThenInclude(i => i.ProblemBank)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (roadmap == null)
        {
            return NotFound(ApiResponse<RoadmapResponse>.Fail("Roadmap not found."));
        }

        if (!await CanManageRoadmapAsync(roadmap, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<RoadmapResponse>.Fail("Forbidden."));
        }

        roadmap.Title = request.Title.Trim();
        roadmap.Level = request.Level.Trim();
        roadmap.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        roadmap.IsPublic = request.IsPublic;

        var reviewStatus = await _autoApproval.EvaluateRoadmapAsync(roadmap.CreatedBy, roadmap.Id, roadmap.Title, roadmap.Description, roadmap.IsPublic);
        ApplyAutoReview(roadmap, reviewStatus);

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<RoadmapResponse>.Ok(BuildRoadmapResponse(roadmap)));
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<string>>> DeleteRoadmap(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<string>.Fail("Unauthorized."));
        }

        var roadmap = await _db.Roadmaps
            .Include(r => r.RoadmapTopics)
            .Include(r => r.RoadmapItems)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (roadmap == null)
        {
            return NotFound(ApiResponse<string>.Fail("Roadmap not found."));
        }

        if (!await CanDeleteRoadmapAsync(roadmap, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<string>.Fail("Forbidden."));
        }

        _db.RoadmapTopics.RemoveRange(roadmap.RoadmapTopics);
        _db.RoadmapItems.RemoveRange(roadmap.RoadmapItems);
        _db.Roadmaps.Remove(roadmap);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("Deleted successfully."));
    }

    [HttpPost("{roadmapId:guid}/topics")]
    [Authorize]
    public async Task<IActionResult> AddTopicToRoadmap(Guid roadmapId, [FromBody] AddTopicToRoadmapRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<string>.Fail("Unauthorized."));
        }

        var roadmap = await _db.Roadmaps.FirstOrDefaultAsync(r => r.Id == roadmapId);
        if (roadmap == null)
        {
            return NotFound(ApiResponse<string>.Fail("Roadmap not found."));
        }

        if (!await CanEditRoadmapStructureAsync(roadmap, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<string>.Fail("Forbidden."));
        }

        var topic = await _db.Topics.AnyAsync(t => t.Id == request.TopicId);
        if (!topic)
        {
            return NotFound(ApiResponse<string>.Fail("Topic not found."));
        }

        var exists = await _db.RoadmapTopics.AnyAsync(rt => rt.RoadmapId == roadmapId && rt.TopicId == request.TopicId);
        if (exists)
        {
            return BadRequest(ApiResponse<string>.Fail("Topic already assigned to roadmap."));
        }

        _db.RoadmapTopics.Add(new RoadmapTopic
        {
            RoadmapId = roadmapId,
            TopicId = request.TopicId,
            OrderIndex = (short)request.OrderIndex
        });

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<string>.Ok("Topic added successfully."));
    }

    [HttpDelete("{roadmapId:guid}/topics/{topicId:guid}")]
    [Authorize]
    public async Task<IActionResult> RemoveTopicFromRoadmap(Guid roadmapId, Guid topicId)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<string>.Fail("Unauthorized."));
        }

        var roadmap = await _db.Roadmaps.FirstOrDefaultAsync(r => r.Id == roadmapId);
        if (roadmap == null)
        {
            return NotFound(ApiResponse<string>.Fail("Roadmap not found."));
        }

        if (!await CanEditRoadmapStructureAsync(roadmap, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<string>.Fail("Forbidden."));
        }

        var roadmapTopic = await _db.RoadmapTopics
            .FirstOrDefaultAsync(rt => rt.RoadmapId == roadmapId && rt.TopicId == topicId);
        if (roadmapTopic == null)
        {
            return NotFound(ApiResponse<string>.Fail("Topic assignment not found."));
        }

        _db.RoadmapTopics.Remove(roadmapTopic);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("Topic removed successfully."));
    }

    [HttpPost("{roadmapId:guid}/items")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<RoadmapItemResponse>>> AddItem(Guid roadmapId, [FromBody] UpsertRoadmapItemRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<RoadmapItemResponse>.Fail("Unauthorized."));
        }

        var roadmap = await _db.Roadmaps.FirstOrDefaultAsync(r => r.Id == roadmapId);
        if (roadmap == null)
        {
            return NotFound(ApiResponse<RoadmapItemResponse>.Fail("Roadmap not found."));
        }

        if (!await CanEditRoadmapStructureAsync(roadmap, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<RoadmapItemResponse>.Fail("Forbidden."));
        }

        var validationError = await ValidateRoadmapItemAsync(roadmap, request);
        if (validationError != null)
        {
            return BadRequest(ApiResponse<RoadmapItemResponse>.Fail(validationError));
        }

        var item = new RoadmapItem
        {
            Id = Guid.NewGuid(),
            RoadmapId = roadmapId,
            ItemType = NormalizeItemType(request.ItemType),
            TopicId = request.TopicId,
            QuizSetId = request.QuizSetId,
            ProblemId = request.ProblemId,
            ProblemBankId = request.ProblemBankId,
            TitleOverride = request.TitleOverride?.Trim(),
            DescriptionOverride = request.DescriptionOverride?.Trim(),
            OrderIndex = (short)request.OrderIndex,
            IsRequired = request.IsRequired,
            PassThreshold = request.PassThreshold,
            CreatedAt = DateTime.Now
        };

        _db.RoadmapItems.Add(item);
        await _db.SaveChangesAsync();

        var loaded = await LoadRoadmapItemAsync(item.Id);
        return Ok(ApiResponse<RoadmapItemResponse>.Ok(MapRoadmapItem(loaded)));
    }

    [HttpPut("{roadmapId:guid}/items/{itemId:guid}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<RoadmapItemResponse>>> UpdateItem(Guid roadmapId, Guid itemId, [FromBody] UpsertRoadmapItemRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<RoadmapItemResponse>.Fail("Unauthorized."));
        }

        var roadmap = await _db.Roadmaps.FirstOrDefaultAsync(r => r.Id == roadmapId);
        if (roadmap == null)
        {
            return NotFound(ApiResponse<RoadmapItemResponse>.Fail("Roadmap not found."));
        }

        if (!await CanEditRoadmapStructureAsync(roadmap, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<RoadmapItemResponse>.Fail("Forbidden."));
        }

        var item = await _db.RoadmapItems.FirstOrDefaultAsync(i => i.Id == itemId && i.RoadmapId == roadmapId);
        if (item == null)
        {
            return NotFound(ApiResponse<RoadmapItemResponse>.Fail("Roadmap item not found."));
        }

        var validationError = await ValidateRoadmapItemAsync(roadmap, request);
        if (validationError != null)
        {
            return BadRequest(ApiResponse<RoadmapItemResponse>.Fail(validationError));
        }

        item.ItemType = NormalizeItemType(request.ItemType);
        item.TopicId = request.TopicId;
        item.QuizSetId = request.QuizSetId;
        item.ProblemId = request.ProblemId;
        item.ProblemBankId = request.ProblemBankId;
        item.TitleOverride = request.TitleOverride?.Trim();
        item.DescriptionOverride = request.DescriptionOverride?.Trim();
        item.OrderIndex = (short)request.OrderIndex;
        item.IsRequired = request.IsRequired;
        item.PassThreshold = request.PassThreshold;

        await _db.SaveChangesAsync();

        var loaded = await LoadRoadmapItemAsync(item.Id);
        return Ok(ApiResponse<RoadmapItemResponse>.Ok(MapRoadmapItem(loaded)));
    }

    [HttpDelete("{roadmapId:guid}/items/{itemId:guid}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> RemoveItem(Guid roadmapId, Guid itemId)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var roadmap = await _db.Roadmaps.FirstOrDefaultAsync(r => r.Id == roadmapId);
        if (roadmap == null)
        {
            return NotFound(ApiResponse<object>.Fail("Roadmap not found."));
        }

        if (!await CanEditRoadmapStructureAsync(roadmap, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        var item = await _db.RoadmapItems.FirstOrDefaultAsync(i => i.Id == itemId && i.RoadmapId == roadmapId);
        if (item == null)
        {
            return NotFound(ApiResponse<object>.Fail("Roadmap item not found."));
        }

        var completions = await _db.UserRoadmapItemCompletions
            .Where(c => c.RoadmapItemId == itemId)
            .ToListAsync();
        _db.UserRoadmapItemCompletions.RemoveRange(completions);

        _db.RoadmapItems.Remove(item);

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { removed = true }));
    }

    [HttpPost("{id:guid}/start")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<RoadmapProgressResponse>>> StartRoadmap(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<RoadmapProgressResponse>.Fail("Unauthorized."));
        }

        var roadmap = await _db.Roadmaps.FirstOrDefaultAsync(r => r.Id == id);
        if (roadmap == null)
        {
            return NotFound(ApiResponse<RoadmapProgressResponse>.Fail("Roadmap not found."));
        }

        if (!await CanViewRoadmapAsync(roadmap))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<RoadmapProgressResponse>.Fail("Forbidden."));
        }

        var userRoadmap = await _db.UserRoadmaps.FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoadmapId == id);
        if (userRoadmap == null)
        {
            userRoadmap = new UserRoadmap
            {
                UserId = userId,
                RoadmapId = id,
                StartedAt = DateTime.Now,
                LastActivityAt = DateTime.Now
            };
            _db.UserRoadmaps.Add(userRoadmap);
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<RoadmapProgressResponse>.Ok(await BuildProgressAsync(id, userId)));
    }

    [HttpGet("{id:guid}/my-progress")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<RoadmapProgressResponse>>> GetMyProgress(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<RoadmapProgressResponse>.Fail("Unauthorized."));
        }

        var exists = await _db.UserRoadmaps.AnyAsync(ur => ur.UserId == userId && ur.RoadmapId == id);
        if (!exists)
        {
            return NotFound(ApiResponse<RoadmapProgressResponse>.Fail("Roadmap has not been started."));
        }

        return Ok(ApiResponse<RoadmapProgressResponse>.Ok(await BuildProgressAsync(id, userId)));
    }

    [HttpGet("~/api/admin/roadmaps/{id:guid}/participants")]
    [HasPermission("roadmap:view_progress")]
    public async Task<ActionResult<ApiResponse<List<RoadmapParticipantResponse>>>> GetParticipants(Guid id)
    {
        var exists = await _db.Roadmaps.AnyAsync(r => r.Id == id);
        if (!exists)
        {
            return NotFound(ApiResponse<List<RoadmapParticipantResponse>>.Fail("Roadmap not found."));
        }

        var started = await _db.UserRoadmaps
            .AsNoTracking()
            .Where(ur => ur.RoadmapId == id)
            .Include(ur => ur.User)
            .ToListAsync();

        var result = new List<RoadmapParticipantResponse>();
        foreach (var row in started)
        {
            var progress = await BuildProgressAsync(id, row.UserId);
            result.Add(new RoadmapParticipantResponse
            {
                UserId = row.UserId,
                Username = row.User.Username,
                FullName = row.User.FullName,
                StartedAt = row.StartedAt,
                CompletedAt = row.CompletedAt,
                LastActivityAt = row.LastActivityAt,
                TotalItems = progress.TotalItems,
                CompletedItems = progress.CompletedItems,
                CompletionPercent = progress.CompletionPercent
            });
        }

        return Ok(ApiResponse<List<RoadmapParticipantResponse>>.Ok(
            result.OrderByDescending(r => r.LastActivityAt ?? r.StartedAt).ToList()));
    }

    private async Task<bool> CanViewRoadmapAsync(Roadmap roadmap)
    {
        if (roadmap.IsPublic && roadmap.ReviewStatus == "approved")
        {
            return true;
        }

        if (!User.TryGetUserId(out var userId))
        {
            return false;
        }

        return roadmap.CreatedBy == userId || await CanManageAnyRoadmapAsync(userId);
    }

    private async Task<bool> CanManageRoadmapAsync(Roadmap roadmap, Guid userId)
    {
        return await _permissions.HasPermissionAsync(userId, "roadmap:edit")
            || await _permissions.HasPermissionAsync(userId, "roadmap:delete")
            || await _permissions.HasPermissionAsync(userId, "roadmap:review")
            || (roadmap.CreatedBy == userId && await _permissions.HasPermissionAsync(userId, "roadmap:create"));
    }

    private async Task<bool> CanDeleteRoadmapAsync(Roadmap roadmap, Guid userId)
    {
        return await _permissions.HasPermissionAsync(userId, "roadmap:delete")
            || await _permissions.HasPermissionAsync(userId, "roadmap:review")
            || (roadmap.CreatedBy == userId && await _permissions.HasPermissionAsync(userId, "roadmap:create"));
    }

    private async Task<bool> CanEditRoadmapStructureAsync(Roadmap roadmap, Guid userId)
    {
        return await _permissions.HasPermissionAsync(userId, "roadmap:edit")
            || await _permissions.HasPermissionAsync(userId, "roadmap:review")
            || (roadmap.CreatedBy == userId && await _permissions.HasPermissionAsync(userId, "roadmap:create"));
    }

    private async Task<bool> CanManageAnyRoadmapAsync(Guid userId)
    {
        return await _permissions.HasPermissionAsync(userId, "roadmap:edit")
            || await _permissions.HasPermissionAsync(userId, "roadmap:delete")
            || await _permissions.HasPermissionAsync(userId, "roadmap:view_progress")
            || await _permissions.HasPermissionAsync(userId, "roadmap:review");
    }

    private async Task<RoadmapItem> LoadRoadmapItemAsync(Guid id)
    {
        return await _db.RoadmapItems
            .Include(i => i.Topic)
            .Include(i => i.QuizSet)
            .Include(i => i.Problem)
            .Include(i => i.ProblemBank)
            .FirstAsync(i => i.Id == id);
    }

    private async Task<string?> ValidateRoadmapItemAsync(Roadmap roadmap, UpsertRoadmapItemRequest request)
    {
        var type = NormalizeItemType(request.ItemType);
        var targetCount = new[] { request.TopicId, request.QuizSetId, request.ProblemId, request.ProblemBankId }.Count(id => id.HasValue);
        if (targetCount != 1)
        {
            return "Exactly one target id is required.";
        }

        if (type == "topic")
        {
            return !request.TopicId.HasValue
                ? "TopicId is required for topic item."
                : !await _db.Topics.AnyAsync(t => t.Id == request.TopicId.Value)
                    ? "Topic not found."
                    : null;
        }

        if (type == "quiz_set")
        {
            if (!request.QuizSetId.HasValue)
            {
                return "QuizSetId is required for quiz set item.";
            }

            var quizSet = await _db.QuizSets.FirstOrDefaultAsync(q => q.Id == request.QuizSetId.Value);
            return ValidateReferencedModeration(roadmap, quizSet?.CreatedBy, quizSet?.ReviewStatus, "Quiz set");
        }

        if (type == "problem")
        {
            if (!request.ProblemId.HasValue)
            {
                return "ProblemId is required for problem item.";
            }

            var problem = await _db.Problems.FirstOrDefaultAsync(p => p.Id == request.ProblemId.Value);
            return ValidateReferencedModeration(roadmap, problem?.CreatedBy, problem?.ReviewStatus, "Problem");
        }

        if (type == "problem_bank")
        {
            if (!request.ProblemBankId.HasValue)
            {
                return "ProblemBankId is required for problem bank item.";
            }

            var bank = await _db.ProblemBanks.FirstOrDefaultAsync(b => b.Id == request.ProblemBankId.Value);
            return ValidateReferencedModeration(roadmap, bank?.CreatedBy, bank?.ReviewStatus, "Problem bank");
        }

        return null;
    }

    private string? ValidateReferencedModeration(Roadmap roadmap, Guid? ownerId, string? reviewStatus, string label)
    {
        if (ownerId == null)
        {
            return $"{label} not found.";
        }

        if (!roadmap.IsPublic)
        {
            return null;
        }

        if (reviewStatus == "rejected")
        {
            return $"{label} is rejected and cannot be linked to a public roadmap.";
        }

        if (reviewStatus != "approved" && ownerId != roadmap.CreatedBy)
        {
            return $"{label} must be approved before it can be linked to a public roadmap.";
        }

        return null;
    }

    /// <summary>
    /// Explicitly mark a roadmap item as completed for the current user. Completion is scoped
    /// strictly to this roadmap item (not the underlying quiz set/problem globally), so the same
    /// quiz set or problem referenced by a different roadmap is tracked independently.
    /// </summary>
    [HttpPost("{roadmapId:guid}/items/{itemId:guid}/complete")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<RoadmapProgressResponse>>> CompleteItem(Guid roadmapId, Guid itemId)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<RoadmapProgressResponse>.Fail("Unauthorized."));
        }

        var item = await _db.RoadmapItems.FirstOrDefaultAsync(i => i.Id == itemId && i.RoadmapId == roadmapId);
        if (item == null)
        {
            return NotFound(ApiResponse<RoadmapProgressResponse>.Fail("Roadmap item not found."));
        }

        var alreadyCompleted = await _db.UserRoadmapItemCompletions
            .AnyAsync(c => c.UserId == userId && c.RoadmapItemId == itemId);

        if (!alreadyCompleted)
        {
            if (!await MeetsCompletionRequirementAsync(item, userId))
            {
                return BadRequest(ApiResponse<RoadmapProgressResponse>.Fail("Ban chua dat yeu cau de hoan thanh muc hoc nay."));
            }

            var user = await _db.Users.FirstAsync(u => u.Id == userId);
            _db.UserRoadmapItemCompletions.Add(new UserRoadmapItemCompletion
            {
                UserId = userId,
                RoadmapItemId = itemId,
                CompletedAt = DateTime.Now
            });
            user.XpPoints += 200;
            user.UpdatedAt = DateTime.Now;

            var userRoadmap = await _db.UserRoadmaps.FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoadmapId == roadmapId);
            if (userRoadmap == null)
            {
                userRoadmap = new UserRoadmap
                {
                    UserId = userId,
                    RoadmapId = roadmapId,
                    StartedAt = DateTime.Now,
                    LastActivityAt = DateTime.Now
                };
                _db.UserRoadmaps.Add(userRoadmap);
            }
            else
            {
                userRoadmap.LastActivityAt = DateTime.Now;
            }

            await _db.SaveChangesAsync();

            var totalItems = await _db.RoadmapItems.CountAsync(i => i.RoadmapId == roadmapId);
            var completedItems = await _db.UserRoadmapItemCompletions
                .CountAsync(c => c.UserId == userId && c.RoadmapItem.RoadmapId == roadmapId);

            if (totalItems > 0 && completedItems == totalItems && !userRoadmap.CompletedAt.HasValue)
            {
                user.XpPoints += 500;
                userRoadmap.CompletedAt = DateTime.Now;
                await _db.SaveChangesAsync();
            }
        }

        return Ok(ApiResponse<RoadmapProgressResponse>.Ok(await BuildProgressAsync(roadmapId, userId)));
    }

    private async Task<RoadmapProgressResponse> BuildProgressAsync(Guid roadmapId, Guid userId)
    {
        var userRoadmap = await _db.UserRoadmaps.FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoadmapId == roadmapId);
        var items = await _db.RoadmapItems
            .AsNoTracking()
            .Where(i => i.RoadmapId == roadmapId)
            .Include(i => i.Topic)
            .Include(i => i.QuizSet)
            .Include(i => i.Problem)
            .Include(i => i.ProblemBank)
                .ThenInclude(b => b!.Items)
            .OrderBy(i => i.OrderIndex)
            .ToListAsync();

        var itemIds = items.Select(i => i.Id).ToList();
        // Completion is only ever set explicitly via CompleteItem, scoped to this exact
        // RoadmapItem row - never derived from global Submissions/QuizSessions state, so the
        // same quiz set/problem used in a different roadmap does not leak its completion here.
        var completedIds = (await _db.UserRoadmapItemCompletions
            .Where(c => c.UserId == userId && itemIds.Contains(c.RoadmapItemId))
            .Select(c => c.RoadmapItemId)
            .ToListAsync())
            .ToHashSet();

        var responses = new List<RoadmapItemResponse>();
        var previousCompleted = true;
        foreach (var item in items)
        {
            var mapped = MapRoadmapItem(item);
            var isCompleted = completedIds.Contains(item.Id);
            mapped.Completed = isCompleted;
            mapped.Unlocked = previousCompleted;
            responses.Add(mapped);
            previousCompleted = isCompleted;
        }

        var completed = responses.Count(i => i.Completed);
        var isNowFullyCompleted = responses.Count > 0 && completed == responses.Count;

        if (userRoadmap != null)
        {
            userRoadmap.LastActivityAt = DateTime.Now;
            if (isNowFullyCompleted)
            {
                userRoadmap.CompletedAt ??= DateTime.Now;
            }
            else
            {
                userRoadmap.CompletedAt = null;
            }

            await _db.SaveChangesAsync();
        }

        return new RoadmapProgressResponse
        {
            RoadmapId = roadmapId,
            UserId = userId,
            StartedAt = userRoadmap?.StartedAt ?? DateTime.Now,
            CompletedAt = userRoadmap?.CompletedAt,
            TotalItems = responses.Count,
            CompletedItems = completed,
            CompletionPercent = responses.Count == 0 ? 0 : Math.Round(completed * 100.0 / responses.Count, 2),
            Items = responses
        };
    }

    private async Task<bool> MeetsCompletionRequirementAsync(RoadmapItem item, Guid userId)
    {
        return item.ItemType switch
        {
            "topic" when item.TopicId.HasValue => await _db.UserTopicProgresses.AnyAsync(p => p.UserId == userId && p.TopicId == item.TopicId.Value && p.TotalAttempts > 0),
            "quiz_set" when item.QuizSetId.HasValue => await MeetsQuizSetRequirementAsync(item, userId),
            "problem" when item.ProblemId.HasValue => await _db.Submissions.AnyAsync(s => s.UserId == userId && s.ProblemId == item.ProblemId.Value && s.Verdict == "accepted"),
            "problem_bank" when item.ProblemBankId.HasValue => await MeetsProblemBankRequirementAsync(item.ProblemBankId.Value, userId),
            _ => false
        };
    }

    private async Task<bool> MeetsQuizSetRequirementAsync(RoadmapItem item, Guid userId)
    {
        var threshold = item.PassThreshold ?? 90;
        var sessions = await _db.QuizSessions
            .Where(s => s.UserId == userId && s.QuizSetId == item.QuizSetId!.Value && s.Status == "completed" && s.Score.HasValue && s.TotalQuestions > 0)
            .Select(s => new { s.Score, s.TotalQuestions })
            .ToListAsync();

        return sessions.Any(s => (double)s.Score!.Value / s.TotalQuestions * 100 >= threshold);
    }

    private async Task<bool> MeetsProblemBankRequirementAsync(Guid bankId, Guid userId)
    {
        var problemIds = await _db.ProblemBankItems
            .Where(i => i.BankId == bankId)
            .Select(i => i.ProblemId)
            .ToListAsync();

        return problemIds.Count > 0 && await _db.Submissions
            .Where(s => s.UserId == userId && s.Verdict == "accepted" && problemIds.Contains(s.ProblemId))
            .Select(s => s.ProblemId)
            .Distinct()
            .CountAsync() == problemIds.Count;
    }

    private static RoadmapResponse BuildRoadmapResponse(Roadmap roadmap)
    {
        return new RoadmapResponse
        {
            Id = roadmap.Id,
            CreatedBy = roadmap.CreatedBy,
            Title = roadmap.Title,
            Level = roadmap.Level,
            Description = roadmap.Description,
            IsPublic = roadmap.IsPublic,
            ReviewStatus = roadmap.ReviewStatus,
            ReviewedBy = roadmap.ReviewedBy,
            ReviewedAt = roadmap.ReviewedAt,
            ReviewNote = roadmap.ReviewNote,
            CreatedAt = roadmap.CreatedAt,
            OrderIndex = roadmap.OrderIndex,
            TargetRole = "Web Developer",
            Topics = roadmap.RoadmapTopics
                .OrderBy(rt => rt.OrderIndex)
                .Select(rt => new RoadmapTopicResponse
                {
                    TopicId = rt.TopicId,
                    Name = rt.Topic.Name,
                    Slug = rt.Topic.Slug,
                    OrderIndex = rt.OrderIndex
                })
                .ToList(),
            Items = roadmap.RoadmapItems
                .OrderBy(item => item.OrderIndex)
                .Select(MapRoadmapItem)
                .ToList()
        };
    }

    private static RoadmapItemResponse MapRoadmapItem(RoadmapItem item)
    {
        return new RoadmapItemResponse
        {
            Id = item.Id,
            ItemType = item.ItemType,
            TopicId = item.TopicId,
            QuizSetId = item.QuizSetId,
            ProblemId = item.ProblemId,
            ProblemBankId = item.ProblemBankId,
            Title = item.TitleOverride
                ?? item.Topic?.Name
                ?? item.QuizSet?.Title
                ?? item.Problem?.Title
                ?? item.ProblemBank?.Title
                ?? string.Empty,
            Description = item.DescriptionOverride
                ?? item.Topic?.Description
                ?? item.QuizSet?.Description
                ?? item.ProblemBank?.Description,
            OrderIndex = item.OrderIndex,
            IsRequired = item.IsRequired,
            PassThreshold = item.PassThreshold
        };
    }

    private static string NormalizeItemType(string itemType)
    {
        return itemType.Trim().ToLowerInvariant().Replace("-", "_");
    }

    private static void ApplyAutoReview(Roadmap roadmap, string reviewStatus)
    {
        roadmap.ReviewStatus = reviewStatus;
        if (!string.Equals(reviewStatus, "approved", StringComparison.OrdinalIgnoreCase))
        {
            roadmap.ReviewedBy = null;
            roadmap.ReviewedAt = null;
            roadmap.ReviewNote = null;
        }
    }
}
