using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Quiz;
using DevLearningHub.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Quiz;

[ApiController]
[Route("api/topics")]
// Public topic catalog.
public class TopicsController : ControllerBase
{
    private readonly DevLearningHubContext _db;

    public TopicsController(DevLearningHubContext db)
    {
        _db = db;
    }

    [HttpGet]
    [AllowAnonymous]
    // Return active topics for filtering quiz content.
    public async Task<ActionResult<ApiResponse<List<TopicResponse>>>> GetTopics()
    {
        var topics = await _db.Topics
            .AsNoTracking()
            .Where(t => t.IsActive)
            .OrderBy(t => t.Name)
            .Select(t => new TopicResponse
            {
                Id = t.Id,
                Name = t.Name,
                Slug = t.Slug,
                Description = t.Description,
                Icon = t.Icon
            })
            .ToListAsync();

        return Ok(ApiResponse<List<TopicResponse>>.Ok(topics));
    }
}
