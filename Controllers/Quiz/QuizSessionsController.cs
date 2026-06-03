using API_DEVLEARNINGHUB.Dtos.Common;
using API_DEVLEARNINGHUB.Dtos.Quiz;
using API_DEVLEARNINGHUB.Entities;
using API_DEVLEARNINGHUB.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API_DEVLEARNINGHUB.Controllers.Quiz;

[ApiController]
[Route("api/quiz-sessions")]
[Authorize]
// Start quiz sessions, submit answers, and get results.
public class QuizSessionsController : ControllerBase
{
    private readonly DevLearningHubContext _db;

    public QuizSessionsController(DevLearningHubContext db)
    {
        _db = db;
    }

    [HttpPost]
    // Create a new quiz session and return ordered questions.
    public async Task<ActionResult<ApiResponse<StartQuizResponse>>> StartQuiz(StartQuizRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<StartQuizResponse>.Fail("Unauthorized."));
        }

        var quizSet = await _db.QuizSets
            .Include(qs => qs.QuizSetQuestions)
            .ThenInclude(qsq => qsq.Question)
            .ThenInclude(q => q.QuestionOptions)
            .FirstOrDefaultAsync(qs => qs.Id == request.QuizSetId);

        if (quizSet == null)
        {
            return NotFound(ApiResponse<StartQuizResponse>.Fail("Quiz set not found."));
        }

        if (!quizSet.IsPublic && quizSet.CreatedBy != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<StartQuizResponse>.Fail("Forbidden."));
        }

        var quizQuestions = quizSet.QuizSetQuestions
            .OrderBy(qsq => qsq.OrderIndex)
            .Select(qsq => qsq.Question)
            .ToList();

        if (quizQuestions.Count == 0)
        {
            return BadRequest(ApiResponse<StartQuizResponse>.Fail("Quiz set has no questions."));
        }

        var session = new QuizSession
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            QuizSetId = quizSet.Id,
            Status = "in_progress",
            TotalQuestions = (short)quizQuestions.Count,
            StartedAt = DateTime.UtcNow
        };

        _db.QuizSessions.Add(session);
        await _db.SaveChangesAsync();

        var response = new StartQuizResponse
        {
            SessionId = session.Id,
            QuizSetId = quizSet.Id,
            Title = quizSet.Title,
            TimeLimitSeconds = quizSet.TimeLimitSeconds,
            TotalQuestions = session.TotalQuestions,
            StartedAt = session.StartedAt,
            Questions = quizQuestions.Select(q => new QuizQuestionResponse
            {
                QuestionId = q.Id,
                Content = q.Content,
                Level = q.Level,
                Options = q.QuestionOptions
                    .OrderBy(o => o.OrderIndex)
                    .Select(o => new QuizQuestionOptionResponse
                    {
                        Id = o.Id,
                        Content = o.Content,
                        OrderIndex = o.OrderIndex
                    })
                    .ToList()
            }).ToList()
        };

        return Ok(ApiResponse<StartQuizResponse>.Ok(response));
    }

    [HttpPost("{id:guid}/submit")]
    // Score submission, save answers, and update progress.
    public async Task<ActionResult<ApiResponse<QuizResultResponse>>> SubmitQuiz(Guid id, SubmitQuizRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<QuizResultResponse>.Fail("Unauthorized."));
        }

        var session = await _db.QuizSessions
            .Include(s => s.QuizSet)
            .ThenInclude(qs => qs.QuizSetQuestions)
            .ThenInclude(qsq => qsq.Question)
            .ThenInclude(q => q.QuestionOptions)
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);

        if (session == null)
        {
            return NotFound(ApiResponse<QuizResultResponse>.Fail("Session not found."));
        }

        if (!string.Equals(session.Status, "in_progress", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse<QuizResultResponse>.Fail("Session already completed."));
        }

        if (request.Answers == null || request.Answers.Count == 0)
        {
            return BadRequest(ApiResponse<QuizResultResponse>.Fail("Answers are required."));
        }

        var questionMap = session.QuizSet.QuizSetQuestions
            .OrderBy(qsq => qsq.OrderIndex)
            .Select(qsq => qsq.Question)
            .ToDictionary(q => q.Id, q => q);

        var answersByQuestion = request.Answers
            .GroupBy(a => a.QuestionId)
            .ToDictionary(g => g.Key, g => g.First());

        var results = new List<QuizAnswer>();
        var score = 0;

        foreach (var question in questionMap.Values)
        {
            answersByQuestion.TryGetValue(question.Id, out var answer);
            var selectedOptionId = answer?.SelectedOptionId;
            if (selectedOptionId.HasValue && question.QuestionOptions.All(o => o.Id != selectedOptionId))
            {
                selectedOptionId = null;
            }

            var isCorrect = selectedOptionId.HasValue && question.QuestionOptions.Any(o => o.Id == selectedOptionId && o.IsCorrect);

            if (isCorrect)
            {
                score++;
            }

            results.Add(new QuizAnswer
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                QuestionId = question.Id,
                SelectedOptionId = selectedOptionId,
                IsCorrect = isCorrect
            });
        }

        session.Score = (short)score;
        session.Status = "completed";
        session.EndedAt = DateTime.UtcNow;
        session.TimeTakenSeconds = request.TimeTakenSeconds ?? (int?)(session.EndedAt.Value - session.StartedAt).TotalSeconds;

        _db.QuizAnswers.AddRange(results);
        await UpdateProgressAsync(userId, session.QuizSet.TopicId, score, session.TotalQuestions);
        await _db.SaveChangesAsync();

        var response = new QuizResultResponse
        {
            SessionId = session.Id,
            QuizSetId = session.QuizSetId,
            Score = session.Score ?? 0,
            TotalQuestions = session.TotalQuestions,
            Accuracy = session.TotalQuestions == 0 ? 0 : (double)score / session.TotalQuestions,
            TimeTakenSeconds = session.TimeTakenSeconds,
            StartedAt = session.StartedAt,
            EndedAt = session.EndedAt,
            Answers = results.Select(a => new QuizResultAnswerResponse
            {
                QuestionId = a.QuestionId,
                SelectedOptionId = a.SelectedOptionId,
                CorrectOptionId = questionMap[a.QuestionId].QuestionOptions.FirstOrDefault(o => o.IsCorrect)?.Id,
                IsCorrect = a.IsCorrect
            }).ToList()
        };

        return Ok(ApiResponse<QuizResultResponse>.Ok(response));
    }

    [HttpGet("{id:guid}/result")]
    // Get stored results for a completed session.
    public async Task<ActionResult<ApiResponse<QuizResultResponse>>> GetResult(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<QuizResultResponse>.Fail("Unauthorized."));
        }

        var session = await _db.QuizSessions
            .Include(s => s.QuizAnswers)
            .Include(s => s.QuizSet)
            .ThenInclude(qs => qs.QuizSetQuestions)
            .ThenInclude(qsq => qsq.Question)
            .ThenInclude(q => q.QuestionOptions)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);

        if (session == null)
        {
            return NotFound(ApiResponse<QuizResultResponse>.Fail("Session not found."));
        }

        var questionMap = session.QuizSet.QuizSetQuestions
            .Select(qsq => qsq.Question)
            .ToDictionary(q => q.Id, q => q);

        var response = new QuizResultResponse
        {
            SessionId = session.Id,
            QuizSetId = session.QuizSetId,
            Score = session.Score ?? 0,
            TotalQuestions = session.TotalQuestions,
            Accuracy = session.TotalQuestions == 0 ? 0 : (double)(session.Score ?? 0) / session.TotalQuestions,
            TimeTakenSeconds = session.TimeTakenSeconds,
            StartedAt = session.StartedAt,
            EndedAt = session.EndedAt,
            Answers = session.QuizAnswers.Select(a => new QuizResultAnswerResponse
            {
                QuestionId = a.QuestionId,
                SelectedOptionId = a.SelectedOptionId,
                CorrectOptionId = questionMap[a.QuestionId].QuestionOptions.FirstOrDefault(o => o.IsCorrect)?.Id,
                IsCorrect = a.IsCorrect
            }).ToList()
        };

        return Ok(ApiResponse<QuizResultResponse>.Ok(response));
    }

    private async Task UpdateProgressAsync(Guid userId, Guid? topicId, int score, int totalQuestions)
    {
        // Update per-topic progress summary for the user.
        if (!topicId.HasValue)
        {
            return;
        }

        var progress = await _db.UserTopicProgresses.FirstOrDefaultAsync(p => p.UserId == userId && p.TopicId == topicId.Value);
        if (progress == null)
        {
            progress = new UserTopicProgress
            {
                UserId = userId,
                TopicId = topicId.Value,
                TotalAttempts = 0,
                TotalQuestions = 0,
                CorrectAnswers = 0
            };

            _db.UserTopicProgresses.Add(progress);
        }

        progress.TotalAttempts += 1;
        progress.TotalQuestions += totalQuestions;
        progress.CorrectAnswers += score;
        progress.BestScore = progress.BestScore.HasValue ? Math.Max(progress.BestScore.Value, score) : score;
        progress.LastPracticedAt = DateTime.UtcNow;
    }
}
