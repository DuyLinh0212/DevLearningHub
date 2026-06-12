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
}
