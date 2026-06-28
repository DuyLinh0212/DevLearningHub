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

	[HttpGet("quiz-stats")]
	// Return top 5 quiz sets the user has attempted, with best score and attempt count.
	public async Task<ActionResult<ApiResponse<List<UserQuizStatResponse>>>> GetQuizStats()
	{
		if (!User.TryGetUserId(out var userId))
		{
			return Unauthorized(ApiResponse<List<UserQuizStatResponse>>.Fail("Unauthorized."));
		}

		var stats = await _db.QuizSessions
			.AsNoTracking()
			.Where(s => s.UserId == userId && s.Status == "completed")
			.GroupBy(s => s.QuizSetId)
			.Select(g => new UserQuizStatResponse
			{
				QuizSetId = g.Key,
				AttemptsCount = g.Count(),
				BestScore = g.Max(s => s.Score ?? 0),
				BestTotalQuestions = g.Max(s => s.TotalQuestions),
				AvgAccuracy = g.Average(s => s.TotalQuestions == 0 ? 0 : (double)(s.Score ?? 0) / s.TotalQuestions)
			})
			.OrderByDescending(s => s.AttemptsCount)
			.Take(5)
			.ToListAsync();

		var quizIds = stats.Select(s => s.QuizSetId).ToList();
		var quizMeta = await _db.QuizSets
			.AsNoTracking()
			.Where(q => quizIds.Contains(q.Id))
			.Select(q => new { q.Id, q.Title, q.Level })
			.ToListAsync();

		var metaMap = quizMeta.ToDictionary(q => q.Id);
		foreach (var stat in stats)
		{
			if (metaMap.TryGetValue(stat.QuizSetId, out var meta))
			{
				stat.QuizTitle = meta.Title;
				stat.Level = meta.Level;
			}
		}

		return Ok(ApiResponse<List<UserQuizStatResponse>>.Ok(stats));
	}
}

[ApiController]
[Route("api/quiz-sets")]
[Authorize]
// Quiz session history per quiz set.
public class QuizSessionsHistoryController : ControllerBase
{
	private readonly DevLearningHubContext _db;

	public QuizSessionsHistoryController(DevLearningHubContext db)
	{
		_db = db;
	}

	[HttpGet("{quizSetId:guid}/history")]
	// Return all completed sessions for a specific quiz set (current user).
	public async Task<ActionResult<ApiResponse<List<QuizHistoryItem>>>> GetQuizHistory(Guid quizSetId)
	{
		if (!User.TryGetUserId(out var userId))
		{
			return Unauthorized(ApiResponse<List<QuizHistoryItem>>.Fail("Unauthorized."));
		}

		var history = await _db.QuizSessions
			.AsNoTracking()
			.Where(s => s.UserId == userId && s.QuizSetId == quizSetId && s.Status == "completed")
			.OrderByDescending(s => s.EndedAt)
			.Select(s => new QuizHistoryItem
			{
				SessionId = s.Id,
				Score = s.Score ?? 0,
				TotalQuestions = s.TotalQuestions,
				Accuracy = s.TotalQuestions == 0 ? 0 : (double)(s.Score ?? 0) / s.TotalQuestions,
				TimeTakenSeconds = s.TimeTakenSeconds,
				StartedAt = s.StartedAt,
				EndedAt = s.EndedAt
			})
			.ToListAsync();

		return Ok(ApiResponse<List<QuizHistoryItem>>.Ok(history));
	}
}
