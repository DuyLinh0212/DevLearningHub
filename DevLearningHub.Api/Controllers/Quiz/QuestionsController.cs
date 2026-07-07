using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Quiz;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;
using System.Text.Json;

namespace DevLearningHub.Api.Controllers.Quiz;

[ApiController]
[Route("api/questions")]
// Manage questions and their options.
public class QuestionsController : ControllerBase
{
    private readonly DevLearningHubContext _db;
    private readonly IPermissionService _permissions;


    public QuestionsController(DevLearningHubContext db, IPermissionService permissions)
    {
        _db = db;
        _permissions = permissions;
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

        // Check permission to create questions
        if (!await _permissions.HasPermissionAsync(userId, "quiz:create") && !await _permissions.HasPermissionAsync(userId, "quiz:edit"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<QuestionResponse>.Fail("Forbidden. Missing permission: quiz:create"));
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
            CreatedAt = DateTime.Now
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

        var isOwner = question.CreatedBy == userId;
        var canEditOwn = isOwner && (await _permissions.HasPermissionAsync(userId, "quiz:create") || await _permissions.HasPermissionAsync(userId, "quiz:edit"));
        var canEditAny = await _permissions.HasPermissionAsync(userId, "quiz:edit");

        if (!canEditOwn && !canEditAny)
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

        var isOwner = question.CreatedBy == userId;
        var canDeleteOwn = isOwner && (await _permissions.HasPermissionAsync(userId, "quiz:create") || await _permissions.HasPermissionAsync(userId, "quiz:edit"));
        var canDeleteAny = await _permissions.HasPermissionAsync(userId, "quiz:edit");

        if (!canDeleteOwn && !canDeleteAny)
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
    public async Task<ActionResult<ApiResponse<ImportQuestionsResultResponse>>> ImportQuestions([FromBody] List<ImportQuestionRequest> requests)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<ImportQuestionsResultResponse>.Fail("Unauthorized."));
        }

        if (!await _db.Users.AnyAsync(user => user.Id == userId && user.IsActive && !user.IsLocked))
        {
            return Unauthorized(ApiResponse<ImportQuestionsResultResponse>.Fail("Your session is no longer valid. Please sign in again."));
        }

        // Check permission to import questions
        if (!await _permissions.HasPermissionAsync(userId, "quiz:create") && !await _permissions.HasPermissionAsync(userId, "quiz:edit"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<ImportQuestionsResultResponse>.Fail("Forbidden. Missing permission: quiz:create"));
        }

        if (requests == null || requests.Count == 0)
        {
            return BadRequest(ApiResponse<ImportQuestionsResultResponse>.Fail("Import list is empty."));
        }

        var errors = new List<string>();
        var created = 0;
        var createdIds = new List<Guid>();
        var topics = await _db.Topics.ToListAsync();
        var usedSlugs = topics.Select(topic => topic.Slug).ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var request in requests)
        {
            var content = request.Content ?? request.Text;
            if (string.IsNullOrWhiteSpace(content))
            {
                errors.Add("Question content is required.");
                continue;
            }

            if (!string.IsNullOrWhiteSpace(request.Level) && request.Level.Trim().Length > 20)
            {
                errors.Add($"Level is too long for question: {content}");
                continue;
            }

            if (!string.IsNullOrWhiteSpace(request.Topic) && request.Topic.Trim().Length > 100)
            {
                errors.Add($"Topic name is too long for question: {content}");
                continue;
            }

            if (!TryParseImportOptions(request, out var parsedOptions))
            {
                errors.Add($"Invalid options for question: {content}");
                continue;
            }

            var topic = ResolveOrCreateImportTopic(request, topics, usedSlugs);
            if (topic == null)
            {
                errors.Add($"Topic not found for question: {content}");
                continue;
            }

            var question = new Question
            {
                Id = Guid.NewGuid(),
                TopicId = topic.Id,
                CreatedBy = userId,
                Content = content.Trim(),
                Level = string.IsNullOrWhiteSpace(request.Level) ? "beginner" : request.Level.Trim(),
                Explanation = request.Explanation?.Trim(),
                IsActive = true,
                CreatedAt = DateTime.Now
            };

            var options = parsedOptions.Select((option, index) => new QuestionOption
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
            createdIds.Add(question.Id);
        }

        await _db.SaveChangesAsync();

        var response = new ImportQuestionsResultResponse
        {
            CreatedCount = created,
            SkippedCount = errors.Count,
            Errors = errors,
            CreatedQuestionIds = createdIds
        };

        return Ok(ApiResponse<ImportQuestionsResultResponse>.Ok(response));
    }

    private Topic? ResolveOrCreateImportTopic(
        ImportQuestionRequest request,
        List<Topic> topics,
        HashSet<string> usedSlugs)
    {
        if (request.TopicId.HasValue)
        {
            var topicById = topics.FirstOrDefault(topic => topic.Id == request.TopicId.Value && topic.IsActive);
            if (topicById != null)
            {
                return topicById;
            }
        }

        var topicName = request.Topic?.Trim();
        if (string.IsNullOrWhiteSpace(topicName))
        {
            return null;
        }

        var existingTopic = topics.FirstOrDefault(topic =>
            string.Equals(topic.Name, topicName, StringComparison.OrdinalIgnoreCase));

        if (existingTopic != null)
        {
            existingTopic.IsActive = true;
            return existingTopic;
        }

        var topic = new Topic
        {
            Id = Guid.NewGuid(),
            Name = topicName,
            Slug = BuildUniqueTopicSlug(topicName, usedSlugs),
            Description = $"Created automatically when importing questions for {topicName}.",
            Icon = "bi-shield-check",
            IsActive = true
        };

        topics.Add(topic);
        _db.Topics.Add(topic);
        return topic;
    }

    private static bool TryParseImportOptions(
        ImportQuestionRequest request,
        out List<ParsedImportOption> parsedOptions)
    {
        parsedOptions = new List<ParsedImportOption>();

        if (request.Options == null || request.Options.Count > byte.MaxValue + 1)
        {
            return false;
        }

        for (var index = 0; index < request.Options.Count; index++)
        {
            var option = request.Options[index];
            string? content = null;
            var isCorrect = request.CorrectIndex == index;
            byte? orderIndex = (byte)index;

            if (option.ValueKind == JsonValueKind.String)
            {
                content = option.GetString();
            }
            else if (option.ValueKind == JsonValueKind.Object)
            {
                content = GetJsonString(option, "content", "Content");
                isCorrect = GetJsonBoolean(option, "isCorrect", "IsCorrect") ?? isCorrect;
                orderIndex = GetJsonByte(option, "orderIndex", "OrderIndex") ?? orderIndex;
            }

            if (string.IsNullOrWhiteSpace(content))
            {
                parsedOptions.Clear();
                return false;
            }

            parsedOptions.Add(new ParsedImportOption(content, isCorrect, orderIndex));
        }

        return parsedOptions.Count >= 2 && parsedOptions.Any(option => option.IsCorrect);
    }

    private static string? GetJsonString(JsonElement element, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String)
            {
                return value.GetString();
            }
        }

        return null;
    }

    private static bool? GetJsonBoolean(JsonElement element, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (element.TryGetProperty(propertyName, out var value) &&
                (value.ValueKind == JsonValueKind.True || value.ValueKind == JsonValueKind.False))
            {
                return value.GetBoolean();
            }
        }

        return null;
    }

    private static byte? GetJsonByte(JsonElement element, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (element.TryGetProperty(propertyName, out var value) &&
                value.ValueKind == JsonValueKind.Number &&
                value.TryGetByte(out var number))
            {
                return number;
            }
        }

        return null;
    }

    private static string BuildUniqueTopicSlug(string topicName, HashSet<string> usedSlugs)
    {
        var decomposed = topicName.Normalize(NormalizationForm.FormD);
        var slugBuilder = new StringBuilder();

        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(character))
            {
                slugBuilder.Append(char.ToLowerInvariant(character));
            }
            else if (slugBuilder.Length > 0 && slugBuilder[^1] != '-')
            {
                slugBuilder.Append('-');
            }
        }

        var baseSlug = slugBuilder.ToString().Trim('-');
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

    private sealed record ParsedImportOption(string Content, bool IsCorrect, byte? OrderIndex);

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
            CreatedBy = question.CreatedBy,
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
