using System.Globalization;
using System.Text;
using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Quiz;
using DevLearningHub.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Quiz;

[ApiController]
[Route("api/topics")]
// Public topic catalog. Writes require Admin.
public class TopicsController : ControllerBase
{
    private readonly DevLearningHubContext _db;

    public TopicsController(DevLearningHubContext db)
    {
        _db = db;
    }

    [HttpGet]
    [AllowAnonymous]
    // Return topics for filtering quiz content. Inactive topics are admin-only.
    public async Task<ActionResult<ApiResponse<List<TopicResponse>>>> GetTopics([FromQuery] bool includeInactive = false)
    {
        var query = _db.Topics.AsNoTracking();

        if (!includeInactive || !(User.IsInRole(AppRoles.Admin) || User.IsInRole(AppRoles.Moderator)))
        {
            query = query.Where(t => t.IsActive);
        }

        var topics = await query
            .OrderBy(t => t.Name)
            .Select(t => MapTopic(t))
            .ToListAsync();

        return Ok(ApiResponse<List<TopicResponse>>.Ok(topics));
    }

    [HttpPost]
    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    // Create a new topic.
    public async Task<ActionResult<ApiResponse<TopicResponse>>> CreateTopic(CreateTopicRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(ApiResponse<TopicResponse>.Fail("Topic name is required."));
        }

        var usedSlugs = await _db.Topics.Select(t => t.Slug).ToListAsync();
        var slug = BuildUniqueSlug(
            string.IsNullOrWhiteSpace(request.Slug) ? name : request.Slug!,
            usedSlugs.ToHashSet(StringComparer.OrdinalIgnoreCase));

        if (await _db.Topics.AnyAsync(t => t.Name == name))
        {
            return Conflict(ApiResponse<TopicResponse>.Fail("A topic with the same name already exists."));
        }

        var topic = new Topic
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = slug,
            Description = request.Description?.Trim(),
            Icon = string.IsNullOrWhiteSpace(request.Icon) ? "bi-journal-check" : request.Icon.Trim(),
            IsActive = true
        };

        _db.Topics.Add(topic);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<TopicResponse>.Ok(MapTopic(topic)));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    // Update an existing topic.
    public async Task<ActionResult<ApiResponse<TopicResponse>>> UpdateTopic(Guid id, UpdateTopicRequest request)
    {
        var topic = await _db.Topics.FirstOrDefaultAsync(t => t.Id == id);
        if (topic == null)
        {
            return NotFound(ApiResponse<TopicResponse>.Fail("Topic not found."));
        }

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(ApiResponse<TopicResponse>.Fail("Topic name is required."));
        }

        if (await _db.Topics.AnyAsync(t => t.Id != id && t.Name == name))
        {
            return Conflict(ApiResponse<TopicResponse>.Fail("A topic with the same name already exists."));
        }

        var usedSlugs = (await _db.Topics
            .Where(t => t.Id != id)
            .Select(t => t.Slug)
            .ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var desiredSlug = string.IsNullOrWhiteSpace(request.Slug) ? name : request.Slug!;
        var normalizedDesired = BuildUniqueSlug(desiredSlug, new HashSet<string>(StringComparer.OrdinalIgnoreCase));
        if (!string.Equals(normalizedDesired, topic.Slug, StringComparison.OrdinalIgnoreCase))
        {
            topic.Slug = BuildUniqueSlug(desiredSlug, usedSlugs);
        }

        topic.Name = name;
        topic.Description = request.Description?.Trim();
        topic.Icon = string.IsNullOrWhiteSpace(request.Icon) ? topic.Icon : request.Icon.Trim();
        topic.IsActive = request.IsActive;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<TopicResponse>.Ok(MapTopic(topic)));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    // Soft delete a topic by marking it inactive to preserve linked content.
    public async Task<ActionResult<ApiResponse<object>>> DeleteTopic(Guid id)
    {
        var topic = await _db.Topics.FirstOrDefaultAsync(t => t.Id == id);
        if (topic == null)
        {
            return NotFound(ApiResponse<object>.Fail("Topic not found."));
        }

        topic.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    private static TopicResponse MapTopic(Topic topic)
    {
        return new TopicResponse
        {
            Id = topic.Id,
            Name = topic.Name,
            Slug = topic.Slug,
            Description = topic.Description,
            Icon = topic.Icon,
            IsActive = topic.IsActive
        };
    }

    // Build a url-friendly, unique slug from a source string.
    private static string BuildUniqueSlug(string source, HashSet<string> usedSlugs)
    {
        var decomposed = source.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder();

        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(character))
            {
                builder.Append(char.ToLowerInvariant(character));
            }
            else if (builder.Length > 0 && builder[^1] != '-')
            {
                builder.Append('-');
            }
        }

        var baseSlug = builder.ToString().Trim('-');
        if (string.IsNullOrWhiteSpace(baseSlug))
        {
            baseSlug = "topic";
        }

        baseSlug = baseSlug.Length > 90 ? baseSlug[..90].TrimEnd('-') : baseSlug;
        var slug = baseSlug;
        var suffix = 2;

        while (!usedSlugs.Add(slug))
        {
            var suffixText = $"-{suffix++}";
            slug = $"{baseSlug[..Math.Min(baseSlug.Length, 100 - suffixText.Length)]}{suffixText}";
        }

        return slug;
    }
}
