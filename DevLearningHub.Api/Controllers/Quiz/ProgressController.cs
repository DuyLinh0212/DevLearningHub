using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Quiz;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Quiz;

[ApiController]
[Route("api/users/me")]
[Authorize]
// Current user learning progress.
public class ProgressController : ControllerBase
{
    private readonly DevLearningHubContext _db;

    public ProgressController(DevLearningHubContext db)
    {
        _db = db;
    }

    [HttpGet("progress")]
    // Return progress grouped by topic.
    public async Task<ActionResult<ApiResponse<List<UserTopicProgressResponse>>>> GetProgress()
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<List<UserTopicProgressResponse>>.Fail("Unauthorized."));
        }

        var progress = await _db.UserTopicProgresses
            .Include(p => p.Topic)
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.LastPracticedAt)
            .Select(p => new UserTopicProgressResponse
            {
                TopicId = p.TopicId,
                TopicName = p.Topic.Name,
                TotalAttempts = p.TotalAttempts,
                TotalQuestions = p.TotalQuestions,
                CorrectAnswers = p.CorrectAnswers,
                BestScore = p.BestScore,
                Accuracy = p.TotalQuestions == 0 ? 0 : (double)p.CorrectAnswers / p.TotalQuestions,
                LastPracticedAt = p.LastPracticedAt
            })
            .ToListAsync();

        return Ok(ApiResponse<List<UserTopicProgressResponse>>.Ok(progress));
    }
}
