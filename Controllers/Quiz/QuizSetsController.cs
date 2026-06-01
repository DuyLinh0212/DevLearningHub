using API_DEVLEARNINGHUB.Dtos.Common;
using API_DEVLEARNINGHUB.Dtos.Quiz;
using API_DEVLEARNINGHUB.Entities;
using API_DEVLEARNINGHUB.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API_DEVLEARNINGHUB.Controllers.Quiz;

[ApiController]
[Route("api/quiz-sets")]
// Manage quiz sets and their assigned questions.
public class QuizSetsController : ControllerBase
{
    private readonly DevLearningHubContext _db;

    public QuizSetsController(DevLearningHubContext db)
    {
        _db = db;
    }

    [HttpGet]
    [AllowAnonymous]
    // List quiz sets, optionally including private ones for owner.
    public async Task<ActionResult<ApiResponse<List<QuizSetResponse>>>> GetQuizSets(
        [FromQuery] Guid? topicId,
        [FromQuery] bool includePrivate = false)
    {
        var query = _db.QuizSets.AsNoTracking();

        if (topicId.HasValue)
        {
            query = query.Where(qs => qs.TopicId == topicId.Value);
        }

        if (includePrivate && User.TryGetUserId(out var userId))
        {
            query = query.Where(qs => qs.IsPublic || qs.CreatedBy == userId);
        }
        else
        {
            query = query.Where(qs => qs.IsPublic);
        }

        var quizSets = await query
            .OrderByDescending(qs => qs.CreatedAt)
            .Select(qs => new QuizSetResponse
            {
                Id = qs.Id,
                Title = qs.Title,
                Description = qs.Description,
                Mode = qs.Mode,
                TimeLimitSeconds = qs.TimeLimitSeconds,
                IsPublic = qs.IsPublic,
                TopicId = qs.TopicId,
                Level = qs.Level,
                QuestionCount = qs.QuizSetQuestions.Count
            })
            .ToListAsync();

        return Ok(ApiResponse<List<QuizSetResponse>>.Ok(quizSets));
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    // Get quiz set detail with ordered questions.
    public async Task<ActionResult<ApiResponse<QuizSetDetailResponse>>> GetQuizSet(Guid id)
    {
        var quizSet = await _db.QuizSets
            .Include(qs => qs.QuizSetQuestions)
            .ThenInclude(qsq => qsq.Question)
            .AsNoTracking()
            .FirstOrDefaultAsync(qs => qs.Id == id);

        if (quizSet == null)
        {
            return NotFound(ApiResponse<QuizSetDetailResponse>.Fail("Quiz set not found."));
        }

        if (!quizSet.IsPublic && (!User.TryGetUserId(out var userId) || quizSet.CreatedBy != userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<QuizSetDetailResponse>.Fail("Forbidden."));
        }

        var response = new QuizSetDetailResponse
        {
            Id = quizSet.Id,
            Title = quizSet.Title,
            Description = quizSet.Description,
            Mode = quizSet.Mode,
            TimeLimitSeconds = quizSet.TimeLimitSeconds,
            IsPublic = quizSet.IsPublic,
            TopicId = quizSet.TopicId,
            Level = quizSet.Level,
            Questions = quizSet.QuizSetQuestions
                .OrderBy(qsq => qsq.OrderIndex)
                .Select(qsq => new QuizSetQuestionResponse
                {
                    QuestionId = qsq.QuestionId,
                    Content = qsq.Question.Content,
                    Level = qsq.Question.Level,
                    OrderIndex = qsq.OrderIndex
                })
                .ToList()
        };

        return Ok(ApiResponse<QuizSetDetailResponse>.Ok(response));
    }

    [HttpPost]
    [Authorize]
    // Create a new quiz set.
    public async Task<ActionResult<ApiResponse<QuizSetResponse>>> CreateQuizSet(CreateQuizSetRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<QuizSetResponse>.Fail("Unauthorized."));
        }

        if (request.TopicId.HasValue && !await _db.Topics.AnyAsync(t => t.Id == request.TopicId && t.IsActive))
        {
            return BadRequest(ApiResponse<QuizSetResponse>.Fail("Topic not found."));
        }

        var quizSet = new QuizSet
        {
            Id = Guid.NewGuid(),
            CreatedBy = userId,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            Mode = string.IsNullOrWhiteSpace(request.Mode) ? "practice" : request.Mode.Trim(),
            TimeLimitSeconds = request.TimeLimitSeconds,
            IsPublic = request.IsPublic,
            TopicId = request.TopicId,
            Level = request.Level?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.QuizSets.Add(quizSet);
        await _db.SaveChangesAsync();

        var response = new QuizSetResponse
        {
            Id = quizSet.Id,
            Title = quizSet.Title,
            Description = quizSet.Description,
            Mode = quizSet.Mode,
            TimeLimitSeconds = quizSet.TimeLimitSeconds,
            IsPublic = quizSet.IsPublic,
            TopicId = quizSet.TopicId,
            Level = quizSet.Level,
            QuestionCount = 0
        };

        return Ok(ApiResponse<QuizSetResponse>.Ok(response));
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    // Update quiz set settings.
    public async Task<ActionResult<ApiResponse<QuizSetResponse>>> UpdateQuizSet(Guid id, UpdateQuizSetRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<QuizSetResponse>.Fail("Unauthorized."));
        }

        var quizSet = await _db.QuizSets.FirstOrDefaultAsync(qs => qs.Id == id);
        if (quizSet == null)
        {
            return NotFound(ApiResponse<QuizSetResponse>.Fail("Quiz set not found."));
        }

        if (quizSet.CreatedBy != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<QuizSetResponse>.Fail("Forbidden."));
        }

        if (request.TopicId.HasValue && !await _db.Topics.AnyAsync(t => t.Id == request.TopicId && t.IsActive))
        {
            return BadRequest(ApiResponse<QuizSetResponse>.Fail("Topic not found."));
        }

        quizSet.Title = request.Title.Trim();
        quizSet.Description = request.Description?.Trim();
        quizSet.Mode = string.IsNullOrWhiteSpace(request.Mode) ? quizSet.Mode : request.Mode.Trim();
        quizSet.TimeLimitSeconds = request.TimeLimitSeconds;
        quizSet.IsPublic = request.IsPublic;
        quizSet.TopicId = request.TopicId;
        quizSet.Level = request.Level?.Trim();

        await _db.SaveChangesAsync();

        var response = new QuizSetResponse
        {
            Id = quizSet.Id,
            Title = quizSet.Title,
            Description = quizSet.Description,
            Mode = quizSet.Mode,
            TimeLimitSeconds = quizSet.TimeLimitSeconds,
            IsPublic = quizSet.IsPublic,
            TopicId = quizSet.TopicId,
            Level = quizSet.Level,
            QuestionCount = await _db.QuizSetQuestions.CountAsync(qsq => qsq.QuizSetId == quizSet.Id)
        };

        return Ok(ApiResponse<QuizSetResponse>.Ok(response));
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    // Delete quiz set if there are no sessions.
    public async Task<ActionResult<ApiResponse<object>>> DeleteQuizSet(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var quizSet = await _db.QuizSets.FirstOrDefaultAsync(qs => qs.Id == id);
        if (quizSet == null)
        {
            return NotFound(ApiResponse<object>.Fail("Quiz set not found."));
        }

        if (quizSet.CreatedBy != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        var hasSessions = await _db.QuizSessions.AnyAsync(qs => qs.QuizSetId == id);
        if (hasSessions)
        {
            return BadRequest(ApiResponse<object>.Fail("Quiz set has sessions and cannot be deleted."));
        }

        var links = await _db.QuizSetQuestions.Where(qsq => qsq.QuizSetId == id).ToListAsync();
        _db.QuizSetQuestions.RemoveRange(links);
        _db.QuizSets.Remove(quizSet);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    [HttpPost("{id:guid}/questions")]
    [Authorize]
    // Assign a question to a quiz set.
    public async Task<ActionResult<ApiResponse<object>>> AssignQuestion(Guid id, AssignQuestionRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var quizSet = await _db.QuizSets.FirstOrDefaultAsync(qs => qs.Id == id);
        if (quizSet == null)
        {
            return NotFound(ApiResponse<object>.Fail("Quiz set not found."));
        }

        if (quizSet.CreatedBy != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        if (!await _db.Questions.AnyAsync(q => q.Id == request.QuestionId && q.IsActive))
        {
            return BadRequest(ApiResponse<object>.Fail("Question not found."));
        }

        var exists = await _db.QuizSetQuestions.AnyAsync(qsq => qsq.QuizSetId == id && qsq.QuestionId == request.QuestionId);
        if (exists)
        {
            return BadRequest(ApiResponse<object>.Fail("Question already assigned."));
        }

        var currentMax = await _db.QuizSetQuestions
            .Where(qsq => qsq.QuizSetId == id)
            .Select(qsq => (short?)qsq.OrderIndex)
            .MaxAsync();

        var orderIndex = request.OrderIndex ?? (short)((currentMax ?? -1) + 1);

        var link = new QuizSetQuestion
        {
            QuizSetId = id,
            QuestionId = request.QuestionId,
            OrderIndex = orderIndex
        };

        _db.QuizSetQuestions.Add(link);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { assigned = true }));
    }

    [HttpDelete("{id:guid}/questions/{questionId:guid}")]
    [Authorize]
    // Remove a question from a quiz set.
    public async Task<ActionResult<ApiResponse<object>>> RemoveQuestion(Guid id, Guid questionId)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var quizSet = await _db.QuizSets.FirstOrDefaultAsync(qs => qs.Id == id);
        if (quizSet == null)
        {
            return NotFound(ApiResponse<object>.Fail("Quiz set not found."));
        }

        if (quizSet.CreatedBy != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        var link = await _db.QuizSetQuestions.FirstOrDefaultAsync(qsq => qsq.QuizSetId == id && qsq.QuestionId == questionId);
        if (link == null)
        {
            return NotFound(ApiResponse<object>.Fail("Question not assigned."));
        }

        _db.QuizSetQuestions.Remove(link);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { removed = true }));
    }

    [HttpGet("{id:guid}/questions")]
    [AllowAnonymous]
    // List questions for a quiz set in order.
    public async Task<ActionResult<ApiResponse<List<QuizSetQuestionResponse>>>> GetQuizSetQuestions(Guid id)
    {
        var quizSet = await _db.QuizSets
            .Include(qs => qs.QuizSetQuestions)
            .ThenInclude(qsq => qsq.Question)
            .AsNoTracking()
            .FirstOrDefaultAsync(qs => qs.Id == id);

        if (quizSet == null)
        {
            return NotFound(ApiResponse<List<QuizSetQuestionResponse>>.Fail("Quiz set not found."));
        }

        if (!quizSet.IsPublic && (!User.TryGetUserId(out var userId) || quizSet.CreatedBy != userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<List<QuizSetQuestionResponse>>.Fail("Forbidden."));
        }

        var response = quizSet.QuizSetQuestions
            .OrderBy(qsq => qsq.OrderIndex)
            .Select(qsq => new QuizSetQuestionResponse
            {
                QuestionId = qsq.QuestionId,
                Content = qsq.Question.Content,
                Level = qsq.Question.Level,
                OrderIndex = qsq.OrderIndex
            })
            .ToList();

        return Ok(ApiResponse<List<QuizSetQuestionResponse>>.Ok(response));
    }
}
