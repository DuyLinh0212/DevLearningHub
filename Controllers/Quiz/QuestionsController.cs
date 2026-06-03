using API_DEVLEARNINGHUB.Dtos.Common;
using API_DEVLEARNINGHUB.Dtos.Quiz;
using API_DEVLEARNINGHUB.Entities;
using API_DEVLEARNINGHUB.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API_DEVLEARNINGHUB.Controllers.Quiz;

[ApiController]
[Route("api/questions")]
// Manage questions and their options.
public class QuestionsController : ControllerBase
{
    private readonly DevLearningHubContext _db;

    public QuestionsController(DevLearningHubContext db)
    {
        _db = db;
    }

    [HttpGet]
    [AllowAnonymous]
    // List questions with optional filters.
    public async Task<ActionResult<ApiResponse<List<QuestionResponse>>>> GetQuestions(
        [FromQuery] Guid? topicId,
        [FromQuery] string? level,
        [FromQuery] bool includeInactive = false)
    {
        var query = _db.Questions.AsNoTracking();

        if (!includeInactive)
        {
            query = query.Where(q => q.IsActive);
        }

        if (topicId.HasValue)
        {
            query = query.Where(q => q.TopicId == topicId.Value);
        }

        if (!string.IsNullOrWhiteSpace(level))
        {
            query = query.Where(q => q.Level == level);
        }

        var questions = await query
            .Include(q => q.QuestionOptions)
            .OrderByDescending(q => q.CreatedAt)
            .ToListAsync();

        var response = questions.Select(MapQuestionResponse).ToList();

        return Ok(ApiResponse<List<QuestionResponse>>.Ok(response));
    }

    [HttpPost]
    [Authorize]
    // Create a new question with options.
    public async Task<ActionResult<ApiResponse<QuestionResponse>>> CreateQuestion(CreateQuestionRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<QuestionResponse>.Fail("Unauthorized."));
        }

        if (!await _db.Topics.AnyAsync(t => t.Id == request.TopicId && t.IsActive))
        {
            return BadRequest(ApiResponse<QuestionResponse>.Fail("Topic not found."));
        }

        if (request.Options.Count < 2 || !request.Options.Any(o => o.IsCorrect))
        {
            return BadRequest(ApiResponse<QuestionResponse>.Fail("At least two options and one correct answer are required."));
        }

        var question = new Question
        {
            Id = Guid.NewGuid(),
            TopicId = request.TopicId,
            CreatedBy = userId,
            Content = request.Content.Trim(),
            Level = string.IsNullOrWhiteSpace(request.Level) ? "beginner" : request.Level.Trim(),
            Explanation = request.Explanation?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var options = request.Options.Select((option, index) => new QuestionOption
        {
            Id = Guid.NewGuid(),
            QuestionId = question.Id,
            Content = option.Content.Trim(),
            IsCorrect = option.IsCorrect,
            OrderIndex = option.OrderIndex ?? (byte)index
        }).ToList();

        _db.Questions.Add(question);
        _db.QuestionOptions.AddRange(options);
        await _db.SaveChangesAsync();

        var response = MapQuestionResponse(question, options);
        return Ok(ApiResponse<QuestionResponse>.Ok(response));
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    // Update question content and replace options.
    public async Task<ActionResult<ApiResponse<QuestionResponse>>> UpdateQuestion(Guid id, UpdateQuestionRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<QuestionResponse>.Fail("Unauthorized."));
        }

        var question = await _db.Questions.Include(q => q.QuestionOptions).FirstOrDefaultAsync(q => q.Id == id);
        if (question == null)
        {
            return NotFound(ApiResponse<QuestionResponse>.Fail("Question not found."));
        }

        if (question.CreatedBy != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<QuestionResponse>.Fail("Forbidden."));
        }

        if (!await _db.Topics.AnyAsync(t => t.Id == request.TopicId && t.IsActive))
        {
            return BadRequest(ApiResponse<QuestionResponse>.Fail("Topic not found."));
        }

        if (request.Options.Count < 2 || !request.Options.Any(o => o.IsCorrect))
        {
            return BadRequest(ApiResponse<QuestionResponse>.Fail("At least two options and one correct answer are required."));
        }

        question.TopicId = request.TopicId;
        question.Content = request.Content.Trim();
        question.Level = string.IsNullOrWhiteSpace(request.Level) ? question.Level : request.Level.Trim();
        question.Explanation = request.Explanation?.Trim();
        question.IsActive = request.IsActive;

        _db.QuestionOptions.RemoveRange(question.QuestionOptions);
        var options = request.Options.Select((option, index) => new QuestionOption
        {
            Id = Guid.NewGuid(),
            QuestionId = question.Id,
            Content = option.Content.Trim(),
            IsCorrect = option.IsCorrect,
            OrderIndex = option.OrderIndex ?? (byte)index
        }).ToList();

        _db.QuestionOptions.AddRange(options);
        await _db.SaveChangesAsync();

        var response = MapQuestionResponse(question, options);
        return Ok(ApiResponse<QuestionResponse>.Ok(response));
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    // Soft delete question by marking inactive.
    public async Task<ActionResult<ApiResponse<object>>> DeleteQuestion(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var question = await _db.Questions.FirstOrDefaultAsync(q => q.Id == id);
        if (question == null)
        {
            return NotFound(ApiResponse<object>.Fail("Question not found."));
        }

        if (question.CreatedBy != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        question.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    [HttpPost("import")]
    [Authorize]
    // Bulk import questions from a list payload.
    public async Task<ActionResult<ApiResponse<ImportQuestionsResultResponse>>> ImportQuestions([FromBody] List<CreateQuestionRequest> requests)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<ImportQuestionsResultResponse>.Fail("Unauthorized."));
        }

        if (requests == null || requests.Count == 0)
        {
            return BadRequest(ApiResponse<ImportQuestionsResultResponse>.Fail("Import list is empty."));
        }

        var errors = new List<string>();
        var created = 0;

        foreach (var request in requests)
        {
            if (!await _db.Topics.AnyAsync(t => t.Id == request.TopicId && t.IsActive))
            {
                errors.Add($"Topic not found: {request.TopicId}");
                continue;
            }

            if (request.Options.Count < 2 || !request.Options.Any(o => o.IsCorrect))
            {
                errors.Add($"Invalid options for question: {request.Content}");
                continue;
            }

            var question = new Question
            {
                Id = Guid.NewGuid(),
                TopicId = request.TopicId,
                CreatedBy = userId,
                Content = request.Content.Trim(),
                Level = string.IsNullOrWhiteSpace(request.Level) ? "beginner" : request.Level.Trim(),
                Explanation = request.Explanation?.Trim(),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            var options = request.Options.Select((option, index) => new QuestionOption
            {
                Id = Guid.NewGuid(),
                QuestionId = question.Id,
                Content = option.Content.Trim(),
                IsCorrect = option.IsCorrect,
                OrderIndex = option.OrderIndex ?? (byte)index
            }).ToList();

            _db.Questions.Add(question);
            _db.QuestionOptions.AddRange(options);
            created++;
        }

        await _db.SaveChangesAsync();

        var response = new ImportQuestionsResultResponse
        {
            CreatedCount = created,
            SkippedCount = errors.Count,
            Errors = errors
        };

        return Ok(ApiResponse<ImportQuestionsResultResponse>.Ok(response));
    }

    private static QuestionResponse MapQuestionResponse(Question question)
    {
        // Reuse mapping logic for loaded options.
        return MapQuestionResponse(question, question.QuestionOptions);
    }

    private static QuestionResponse MapQuestionResponse(Question question, IEnumerable<QuestionOption> options)
    {
        return new QuestionResponse
        {
            Id = question.Id,
            TopicId = question.TopicId,
            Content = question.Content,
            Level = question.Level,
            Explanation = question.Explanation,
            IsActive = question.IsActive,
            CreatedAt = question.CreatedAt,
            Options = options
                .OrderBy(o => o.OrderIndex)
                .Select(o => new QuestionOptionResponse
                {
                    Id = o.Id,
                    Content = o.Content,
                    IsCorrect = o.IsCorrect,
                    OrderIndex = o.OrderIndex
                })
                .ToList()
        };
    }
}
