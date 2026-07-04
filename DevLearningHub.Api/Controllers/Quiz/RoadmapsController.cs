using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Quiz;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Quiz;

[ApiController]
[Route("api/roadmaps")]
// Public roadmaps for learning paths.
public class RoadmapsController : ControllerBase
{
    private readonly DevLearningHubContext _db;

    public RoadmapsController(DevLearningHubContext db)
    {
        _db = db;
    }

    [HttpGet]
    [AllowAnonymous]
    // Return roadmaps with ordered topics.
    public async Task<ActionResult<ApiResponse<List<RoadmapResponse>>>> GetRoadmaps()
    {
        var roadmaps = await _db.Roadmaps
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
            .OrderBy(r => r.OrderIndex)
            .ToListAsync();

        var response = roadmaps.Select(r => new RoadmapResponse
        {
            Id = r.Id,
            Title = r.Title,
            Level = r.Level,
            Description = r.Description,
            OrderIndex = r.OrderIndex,
            TargetRole = "Web Developer",
            Topics = r.RoadmapTopics
                .OrderBy(rt => rt.OrderIndex)
                .Select(rt => new RoadmapTopicResponse
                {
                    TopicId = rt.TopicId,
                    Name = rt.Topic.Name,
                    Slug = rt.Topic.Slug,
                    OrderIndex = rt.OrderIndex
                })
                .ToList(),
            Items = r.RoadmapItems
                .OrderBy(item => item.OrderIndex)
                .Select(MapRoadmapItem)
                .ToList()
        }).ToList();

        return Ok(ApiResponse<List<RoadmapResponse>>.Ok(response));
    }

    [HttpPost]
    [HasPermission("roadmap:create")]
    public async Task<ActionResult<ApiResponse<RoadmapResponse>>> CreateRoadmap([FromBody] CreateRoadmapRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse<RoadmapResponse>.Fail("Invalid data."));

        var maxOrder = await _db.Roadmaps.Select(r => (int?)r.OrderIndex).MaxAsync() ?? 0;

        var roadmap = new Roadmap
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Level = request.Level,
            Description = request.Description,
            OrderIndex = (short)(maxOrder + 1)
        };

        _db.Roadmaps.Add(roadmap);
        await _db.SaveChangesAsync();

        var response = new RoadmapResponse
        {
            Id = roadmap.Id,
            Title = roadmap.Title,
            Level = roadmap.Level,
            Description = roadmap.Description,
            OrderIndex = roadmap.OrderIndex,
            TargetRole = request.TargetRole,
            Topics = new()
        };

        return Ok(ApiResponse<RoadmapResponse>.Ok(response));
    }

    [HttpPut("{id:guid}")]
    [HasPermission("roadmap:edit")]
    public async Task<ActionResult<ApiResponse<RoadmapResponse>>> UpdateRoadmap(Guid id, [FromBody] UpdateRoadmapRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse<RoadmapResponse>.Fail("Invalid data."));

        var roadmap = await _db.Roadmaps.FirstOrDefaultAsync(r => r.Id == id);
        if (roadmap == null) return NotFound(ApiResponse<RoadmapResponse>.Fail("Roadmap not found."));

        roadmap.Title = request.Title;
        roadmap.Level = request.Level;
        roadmap.Description = request.Description;

        await _db.SaveChangesAsync();

        var response = new RoadmapResponse
        {
            Id = roadmap.Id,
            Title = roadmap.Title,
            Level = roadmap.Level,
            Description = roadmap.Description,
            OrderIndex = roadmap.OrderIndex,
            TargetRole = request.TargetRole,
            Topics = new()
        };

        return Ok(ApiResponse<RoadmapResponse>.Ok(response));
    }

    [HttpDelete("{id:guid}")]
    [HasPermission("roadmap:delete")]
    public async Task<ActionResult<ApiResponse<string>>> DeleteRoadmap(Guid id)
    {
        var roadmap = await _db.Roadmaps
            .Include(r => r.RoadmapTopics)
            .Include(r => r.RoadmapItems)
            .FirstOrDefaultAsync(r => r.Id == id);
            
        if (roadmap == null) return NotFound(ApiResponse<string>.Fail("Roadmap not found."));

        _db.RoadmapTopics.RemoveRange(roadmap.RoadmapTopics);
        _db.RoadmapItems.RemoveRange(roadmap.RoadmapItems);
        _db.Roadmaps.Remove(roadmap);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("Deleted successfully."));
    }

    [HttpPost("{roadmapId:guid}/topics")]
    [HasPermission("roadmap:edit")]
    public async Task<IActionResult> AddTopicToRoadmap(Guid roadmapId, [FromBody] AddTopicToRoadmapRequest request)
    {
        var roadmap = await _db.Roadmaps.AnyAsync(r => r.Id == roadmapId);
        if (!roadmap) return NotFound(ApiResponse<string>.Fail("Roadmap not found."));

        var topic = await _db.Topics.AnyAsync(t => t.Id == request.TopicId);
        if (!topic) return NotFound(ApiResponse<string>.Fail("Topic not found."));

        var exists = await _db.RoadmapTopics.AnyAsync(rt => rt.RoadmapId == roadmapId && rt.TopicId == request.TopicId);
        if (exists) return BadRequest(ApiResponse<string>.Fail("Topic already assigned to roadmap."));

        var roadmapTopic = new RoadmapTopic
        {
            RoadmapId = roadmapId,
            TopicId = request.TopicId,
            OrderIndex = (short)request.OrderIndex
        };

        _db.RoadmapTopics.Add(roadmapTopic);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("Topic added successfully."));
    }

    [HttpDelete("{roadmapId:guid}/topics/{topicId:guid}")]
    [HasPermission("roadmap:edit")]
    public async Task<IActionResult> RemoveTopicFromRoadmap(Guid roadmapId, Guid topicId)
    {
        var roadmapTopic = await _db.RoadmapTopics
            .FirstOrDefaultAsync(rt => rt.RoadmapId == roadmapId && rt.TopicId == topicId);

        if (roadmapTopic == null) return NotFound(ApiResponse<string>.Fail("Topic assignment not found."));

        _db.RoadmapTopics.Remove(roadmapTopic);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("Topic removed successfully."));
    }

    [HttpPost("{roadmapId:guid}/items")]
    [HasPermission("roadmap:edit")]
    public async Task<ActionResult<ApiResponse<RoadmapItemResponse>>> AddItem(Guid roadmapId, [FromBody] UpsertRoadmapItemRequest request)
    {
        var roadmap = await _db.Roadmaps.AnyAsync(r => r.Id == roadmapId);
        if (!roadmap) return NotFound(ApiResponse<RoadmapItemResponse>.Fail("Roadmap not found."));

        var validationError = await ValidateRoadmapItemAsync(request);
        if (validationError != null) return BadRequest(ApiResponse<RoadmapItemResponse>.Fail(validationError));

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
            CreatedAt = DateTime.Now
        };

        _db.RoadmapItems.Add(item);
        await _db.SaveChangesAsync();

        var loaded = await LoadRoadmapItemAsync(item.Id);
        return Ok(ApiResponse<RoadmapItemResponse>.Ok(MapRoadmapItem(loaded)));
    }

    [HttpPut("{roadmapId:guid}/items/{itemId:guid}")]
    [HasPermission("roadmap:edit")]
    public async Task<ActionResult<ApiResponse<RoadmapItemResponse>>> UpdateItem(Guid roadmapId, Guid itemId, [FromBody] UpsertRoadmapItemRequest request)
    {
        var item = await _db.RoadmapItems.FirstOrDefaultAsync(i => i.Id == itemId && i.RoadmapId == roadmapId);
        if (item == null) return NotFound(ApiResponse<RoadmapItemResponse>.Fail("Roadmap item not found."));

        var validationError = await ValidateRoadmapItemAsync(request);
        if (validationError != null) return BadRequest(ApiResponse<RoadmapItemResponse>.Fail(validationError));

        item.ItemType = NormalizeItemType(request.ItemType);
        item.TopicId = request.TopicId;
        item.QuizSetId = request.QuizSetId;
        item.ProblemId = request.ProblemId;
        item.ProblemBankId = request.ProblemBankId;
        item.TitleOverride = request.TitleOverride?.Trim();
        item.DescriptionOverride = request.DescriptionOverride?.Trim();
        item.OrderIndex = (short)request.OrderIndex;
        item.IsRequired = request.IsRequired;

        await _db.SaveChangesAsync();

        var loaded = await LoadRoadmapItemAsync(item.Id);
        return Ok(ApiResponse<RoadmapItemResponse>.Ok(MapRoadmapItem(loaded)));
    }

    [HttpDelete("{roadmapId:guid}/items/{itemId:guid}")]
    [HasPermission("roadmap:edit")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveItem(Guid roadmapId, Guid itemId)
    {
        var item = await _db.RoadmapItems.FirstOrDefaultAsync(i => i.Id == itemId && i.RoadmapId == roadmapId);
        if (item == null) return NotFound(ApiResponse<object>.Fail("Roadmap item not found."));

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

        var exists = await _db.Roadmaps.AnyAsync(r => r.Id == id);
        if (!exists) return NotFound(ApiResponse<RoadmapProgressResponse>.Fail("Roadmap not found."));

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
        if (!exists) return NotFound(ApiResponse<RoadmapProgressResponse>.Fail("Roadmap has not been started."));

        return Ok(ApiResponse<RoadmapProgressResponse>.Ok(await BuildProgressAsync(id, userId)));
    }

    [HttpGet("~/api/admin/roadmaps/{id:guid}/participants")]
    [HasPermission("roadmap:view_progress")]
    public async Task<ActionResult<ApiResponse<List<RoadmapParticipantResponse>>>> GetParticipants(Guid id)
    {
        var exists = await _db.Roadmaps.AnyAsync(r => r.Id == id);
        if (!exists) return NotFound(ApiResponse<List<RoadmapParticipantResponse>>.Fail("Roadmap not found."));

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

        return Ok(ApiResponse<List<RoadmapParticipantResponse>>.Ok(result.OrderByDescending(r => r.LastActivityAt ?? r.StartedAt).ToList()));
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

    private async Task<string?> ValidateRoadmapItemAsync(UpsertRoadmapItemRequest request)
    {
        var type = NormalizeItemType(request.ItemType);
        var targetCount = new[] { request.TopicId, request.QuizSetId, request.ProblemId, request.ProblemBankId }.Count(id => id.HasValue);
        if (targetCount != 1) return "Exactly one target id is required.";

        return type switch
        {
            "topic" when !request.TopicId.HasValue => "TopicId is required for topic item.",
            "quiz_set" when !request.QuizSetId.HasValue => "QuizSetId is required for quiz set item.",
            "problem" when !request.ProblemId.HasValue => "ProblemId is required for problem item.",
            "problem_bank" when !request.ProblemBankId.HasValue => "ProblemBankId is required for problem bank item.",
            "topic" when !await _db.Topics.AnyAsync(t => t.Id == request.TopicId.Value) => "Topic not found.",
            "quiz_set" when !await _db.QuizSets.AnyAsync(q => q.Id == request.QuizSetId.Value) => "Quiz set not found.",
            "problem" when !await _db.Problems.AnyAsync(p => p.Id == request.ProblemId.Value) => "Problem not found.",
            "problem_bank" when !await _db.ProblemBanks.AnyAsync(b => b.Id == request.ProblemBankId.Value) => "Problem bank not found.",
            _ => null
        };
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

        var responses = new List<RoadmapItemResponse>();
        foreach (var item in items)
        {
            var mapped = MapRoadmapItem(item);
            mapped.Completed = await IsItemCompletedAsync(item, userId);
            responses.Add(mapped);
        }

        var completed = responses.Count(i => i.Completed);
        if (userRoadmap != null)
        {
            userRoadmap.LastActivityAt = DateTime.Now;
            userRoadmap.CompletedAt = responses.Count > 0 && completed == responses.Count ? DateTime.Now : null;
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

    private async Task<bool> IsItemCompletedAsync(RoadmapItem item, Guid userId)
    {
        return item.ItemType switch
        {
            "topic" when item.TopicId.HasValue => await _db.UserTopicProgresses.AnyAsync(p => p.UserId == userId && p.TopicId == item.TopicId.Value && p.TotalAttempts > 0),
            "quiz_set" when item.QuizSetId.HasValue => await _db.QuizSessions.AnyAsync(s => s.UserId == userId && s.QuizSetId == item.QuizSetId.Value && s.Status == "completed"),
            "problem" when item.ProblemId.HasValue => await _db.Submissions.AnyAsync(s => s.UserId == userId && s.ProblemId == item.ProblemId.Value && s.Verdict == "accepted"),
            "problem_bank" when item.ProblemBankId.HasValue => await IsProblemBankCompletedAsync(item.ProblemBankId.Value, userId),
            _ => false
        };
    }

    private async Task<bool> IsProblemBankCompletedAsync(Guid bankId, Guid userId)
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
            IsRequired = item.IsRequired
        };
    }

    private static string NormalizeItemType(string itemType)
    {
        return itemType.Trim().ToLowerInvariant().Replace("-", "_");
    }
}
