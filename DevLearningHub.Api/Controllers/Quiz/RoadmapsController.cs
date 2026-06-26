using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Quiz;
using DevLearningHub.Api.Entities;
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
                .ToList()
        }).ToList();

        return Ok(ApiResponse<List<RoadmapResponse>>.Ok(response));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
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
    [Authorize(Roles = "Admin")]
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
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<string>>> DeleteRoadmap(Guid id)
    {
        var roadmap = await _db.Roadmaps
            .Include(r => r.RoadmapTopics)
            .FirstOrDefaultAsync(r => r.Id == id);
            
        if (roadmap == null) return NotFound(ApiResponse<string>.Fail("Roadmap not found."));

        _db.RoadmapTopics.RemoveRange(roadmap.RoadmapTopics);
        _db.Roadmaps.Remove(roadmap);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("Deleted successfully."));
    }

    [HttpPost("{roadmapId:guid}/topics")]
    [Authorize(Roles = "Admin")]
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
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveTopicFromRoadmap(Guid roadmapId, Guid topicId)
    {
        var roadmapTopic = await _db.RoadmapTopics
            .FirstOrDefaultAsync(rt => rt.RoadmapId == roadmapId && rt.TopicId == topicId);

        if (roadmapTopic == null) return NotFound(ApiResponse<string>.Fail("Topic assignment not found."));

        _db.RoadmapTopics.Remove(roadmapTopic);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("Topic removed successfully."));
    }
}
