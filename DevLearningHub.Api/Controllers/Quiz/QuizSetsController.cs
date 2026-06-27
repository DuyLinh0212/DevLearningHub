using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Quiz;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Quiz;

[ApiController]
[Route("api/quiz-sets")]
// Manage quiz sets and their assigned questions.
public class QuizSetsController : ControllerBase
{
    private readonly DevLearningHubContext _db;
    private readonly IAuditService _audit;
    private readonly IPermissionService _permissions;

    public QuizSetsController(DevLearningHubContext db, IAuditService audit, IPermissionService permissions)
    {
        _db = db;
        _audit = audit;
        _permissions = permissions;
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
            // Quiz managers (quiz:edit) see every set; others only public ones plus their own.
            var canManage = await _permissions.HasPermissionAsync(userId, "quiz:edit");
            if (!canManage)
            {
                query = query.Where(qs => qs.IsPublic || qs.CreatedBy == userId);
            }
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
                CreatedBy = qs.CreatedBy,
                CreatedByFullName = qs.CreatedByNavigation.FullName ?? qs.CreatedByNavigation.Username,
                Title = qs.Title,
                Description = qs.Description,
                Mode = qs.Mode,
                TimeLimitSeconds = qs.TimeLimitSeconds,
                IsPublic = qs.IsPublic,
                AllowedCopy = qs.AllowedCopy,
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
            .Include(qs => qs.CreatedByNavigation)
            .Include(qs => qs.QuizSetQuestions)
            .ThenInclude(qsq => qsq.Question)
            .ThenInclude(q => q.QuestionOptions)
            .AsNoTracking()
            .FirstOrDefaultAsync(qs => qs.Id == id);

        if (quizSet == null)
        {
            return NotFound(ApiResponse<QuizSetDetailResponse>.Fail("Quiz set not found."));
        }

        var isOwner = User.TryGetUserId(out var userId) && quizSet.CreatedBy == userId;
        var canManageAny = await _permissions.HasPermissionAsync(userId, "quiz:edit");
        var canManage = isOwner || canManageAny;
        if (!quizSet.IsPublic && !canManage)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<QuizSetDetailResponse>.Fail("Forbidden."));
        }

        var response = new QuizSetDetailResponse
        {
            Id = quizSet.Id,
            CreatedBy = quizSet.CreatedBy,
            CreatedByFullName = quizSet.CreatedByNavigation.FullName ?? quizSet.CreatedByNavigation.Username,
            Title = quizSet.Title,
            Description = quizSet.Description,
            Mode = quizSet.Mode,
            TimeLimitSeconds = quizSet.TimeLimitSeconds,
            IsPublic = quizSet.IsPublic,
            AllowedCopy = quizSet.AllowedCopy,
            TopicId = quizSet.TopicId,
            Level = quizSet.Level,
            Questions = quizSet.QuizSetQuestions
                .OrderBy(qsq => qsq.OrderIndex)
                .Select(qsq => new QuizSetQuestionResponse
                {
                    QuestionId = qsq.QuestionId,
                    Content = qsq.Question.Content,
                    Level = qsq.Question.Level,
                    Explanation = qsq.Question.Explanation,
                    OrderIndex = qsq.OrderIndex,
                    Options = canManage
                        ? qsq.Question.QuestionOptions
                            .OrderBy(option => option.OrderIndex)
                            .Select(option => new QuestionOptionResponse
                            {
                                Id = option.Id,
                                Content = option.Content,
                                IsCorrect = option.IsCorrect,
                                OrderIndex = option.OrderIndex
                            })
                            .ToList()
                        : new List<QuestionOptionResponse>()
                })
                .ToList()
        };

        return Ok(ApiResponse<QuizSetDetailResponse>.Ok(response));
    }

    [HttpPost]
    [Authorize]
    // Create a new quiz set. Requires quiz:create permission.
    public async Task<ActionResult<ApiResponse<QuizSetResponse>>> CreateQuizSet(CreateQuizSetRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<QuizSetResponse>.Fail("Unauthorized."));
        }

        if (!await IsActiveUserAsync(userId))
        {
            return Unauthorized(ApiResponse<QuizSetResponse>.Fail("Your session is no longer valid. Please sign in again."));
        }

        // Check permission to create quiz sets
        if (!await _permissions.HasPermissionAsync(userId, "quiz:create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<QuizSetResponse>.Fail("Forbidden. Missing permission: quiz:create"));
        }

        var topic = await ResolveOrCreateTopicAsync(request.TopicId, request.Topic);
        if ((request.TopicId.HasValue || !string.IsNullOrWhiteSpace(request.Topic)) && topic == null)
        {
            return BadRequest(ApiResponse<QuizSetResponse>.Fail("Topic not found."));
        }

        var resolvedTopicId = topic?.Id;
        var questionValidationError = await ValidateQuestionsAsync(request.Questions, resolvedTopicId);
        if (questionValidationError != null)
        {
            return BadRequest(ApiResponse<QuizSetResponse>.Fail(questionValidationError));
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
            AllowedCopy = request.AllowedCopy,
            TopicId = resolvedTopicId,
            Level = request.Level?.Trim(),
            CreatedAt = DateTime.Now
        };

        _db.QuizSets.Add(quizSet);
        AddNewQuestionsToQuizSet(quizSet.Id, userId, resolvedTopicId, request.Questions);
        await _db.SaveChangesAsync();

        var response = await MapQuizSetResponseAsync(quizSet, request.Questions?.Count ?? 0);

        return Ok(ApiResponse<QuizSetResponse>.Ok(response));
    }

    [HttpPost("{id:guid}/copy")]
    [Authorize]
    // Copy a quiz set into a new one owned by the caller. Only allowed when the source has AllowedCopy = true.
    public async Task<ActionResult<ApiResponse<QuizSetResponse>>> CopyQuizSet(Guid id, [FromBody] CopyQuizSetRequest? request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<QuizSetResponse>.Fail("Unauthorized."));
        }

        if (!await IsActiveUserAsync(userId))
        {
            return Unauthorized(ApiResponse<QuizSetResponse>.Fail("Your session is no longer valid. Please sign in again."));
        }

        var source = await _db.QuizSets
            .Include(qs => qs.QuizSetQuestions)
            .ThenInclude(qsq => qsq.Question)
            .ThenInclude(q => q.QuestionOptions)
            .AsNoTracking()
            .FirstOrDefaultAsync(qs => qs.Id == id);

        if (source == null)
        {
            return NotFound(ApiResponse<QuizSetResponse>.Fail("Quiz set not found."));
        }

        var isOwner = source.CreatedBy == userId;
        var canManageAny = await _permissions.HasPermissionAsync(userId, "quiz:edit");

        // Hidden quiz sets can only be copied by their owner or a quiz manager (quiz:edit).
        if (!source.IsPublic && !isOwner && !canManageAny)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<QuizSetResponse>.Fail("Forbidden."));
        }

        // The copy gate: only owner/quiz manager bypass it; everyone else needs AllowedCopy = true.
        if (!source.AllowedCopy && !isOwner && !canManageAny)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<QuizSetResponse>.Fail("This quiz set does not allow copying."));
        }

        var now = DateTime.Now;
        var title = string.IsNullOrWhiteSpace(request?.Title)
            ? $"{source.Title} (Copy)"
            : request.Title.Trim();

        var copy = new QuizSet
        {
            Id = Guid.NewGuid(),
            CreatedBy = userId,
            Title = title.Length > 200 ? title[..200] : title,
            Description = source.Description,
            Mode = source.Mode,
            TimeLimitSeconds = source.TimeLimitSeconds,
            IsPublic = false,
            AllowedCopy = false,
            TopicId = source.TopicId,
            Level = source.Level,
            CreatedAt = now
        };

        _db.QuizSets.Add(copy);

        // Deep-copy each question and its options so the copy is independent of the source.
        foreach (var link in source.QuizSetQuestions.OrderBy(qsq => qsq.OrderIndex))
        {
            var sourceQuestion = link.Question;
            var newQuestion = new Question
            {
                Id = Guid.NewGuid(),
                TopicId = sourceQuestion.TopicId,
                CreatedBy = userId,
                Content = sourceQuestion.Content,
                Level = sourceQuestion.Level,
                Explanation = sourceQuestion.Explanation,
                IsActive = true,
                CreatedAt = now
            };

            _db.Questions.Add(newQuestion);
            _db.QuestionOptions.AddRange(sourceQuestion.QuestionOptions
                .OrderBy(option => option.OrderIndex)
                .Select(option => new QuestionOption
                {
                    Id = Guid.NewGuid(),
                    QuestionId = newQuestion.Id,
                    Content = option.Content,
                    IsCorrect = option.IsCorrect,
                    OrderIndex = option.OrderIndex
                }));

            _db.QuizSetQuestions.Add(new QuizSetQuestion
            {
                QuizSetId = copy.Id,
                QuestionId = newQuestion.Id,
                OrderIndex = link.OrderIndex
            });
        }

        await _db.SaveChangesAsync();

        var response = await MapQuizSetResponseAsync(copy, source.QuizSetQuestions.Count);
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

        if (!await IsActiveUserAsync(userId))
        {
            return Unauthorized(ApiResponse<QuizSetResponse>.Fail("Your session is no longer valid. Please sign in again."));
        }

        var quizSet = await _db.QuizSets.FirstOrDefaultAsync(qs => qs.Id == id);
        if (quizSet == null)
        {
            return NotFound(ApiResponse<QuizSetResponse>.Fail("Quiz set not found."));
        }

        if (!await CanManageQuizSetAsync(userId, quizSet))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<QuizSetResponse>.Fail("Forbidden."));
        }

        var topic = await ResolveOrCreateTopicAsync(request.TopicId, request.Topic);
        if ((request.TopicId.HasValue || !string.IsNullOrWhiteSpace(request.Topic)) && topic == null)
        {
            return BadRequest(ApiResponse<QuizSetResponse>.Fail("Topic not found."));
        }

        var resolvedTopicId = topic?.Id;
        var questionValidationError = await ValidateQuestionsAsync(request.Questions, resolvedTopicId);
        if (questionValidationError != null)
        {
            return BadRequest(ApiResponse<QuizSetResponse>.Fail(questionValidationError));
        }

        if (request.Questions != null && await _db.QuizSessions.AnyAsync(session => session.QuizSetId == id))
        {
            return BadRequest(ApiResponse<QuizSetResponse>.Fail("Questions cannot be changed after the quiz set has sessions."));
        }

        quizSet.Title = request.Title.Trim();
        quizSet.Description = request.Description?.Trim();
        quizSet.Mode = string.IsNullOrWhiteSpace(request.Mode) ? quizSet.Mode : request.Mode.Trim();
        quizSet.TimeLimitSeconds = request.TimeLimitSeconds;
        quizSet.IsPublic = request.IsPublic;
        quizSet.AllowedCopy = request.AllowedCopy;
        quizSet.TopicId = resolvedTopicId;
        quizSet.Level = request.Level?.Trim();

        if (request.Questions != null)
        {
            await ReplaceQuizSetQuestionsAsync(quizSet.Id, userId, resolvedTopicId, request.Questions);
        }

        await _db.SaveChangesAsync();

        var questionCount = request.Questions?.Count
            ?? await _db.QuizSetQuestions.CountAsync(qsq => qsq.QuizSetId == quizSet.Id);
        var response = await MapQuizSetResponseAsync(quizSet, questionCount);

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

        if (!await CanManageQuizSetAsync(userId, quizSet))
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
        await _audit.LogAsync("quiz.delete", "quiz_set", id, $"title={quizSet.Title}");

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

        if (!await CanManageQuizSetAsync(userId, quizSet))
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

        if (!await CanManageQuizSetAsync(userId, quizSet))
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

        if (!quizSet.IsPublic)
        {
            var canAccess = false;
            if (User.TryGetUserId(out var userId))
            {
                canAccess = quizSet.CreatedBy == userId || await _permissions.HasPermissionAsync(userId, "quiz:edit");
            }
            if (!canAccess)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<List<QuizSetQuestionResponse>>.Fail("Forbidden."));
            }
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

    private async Task<Topic?> ResolveOrCreateTopicAsync(Guid? topicId, string? topicName)
    {
        if (topicId.HasValue)
        {
            var topicById = await _db.Topics.FirstOrDefaultAsync(topic => topic.Id == topicId.Value && topic.IsActive);
            if (topicById != null)
            {
                return topicById;
            }
        }

        var normalizedName = topicName?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName) || normalizedName.Length > 100)
        {
            return null;
        }

        var existingTopic = await _db.Topics.FirstOrDefaultAsync(topic => topic.Name == normalizedName);
        if (existingTopic != null)
        {
            existingTopic.IsActive = true;
            return existingTopic;
        }

        var newTopic = new Topic
        {
            Id = Guid.NewGuid(),
            Name = normalizedName,
            Slug = $"topic-{Guid.NewGuid():N}",
            Description = $"Created automatically for quiz sets in {normalizedName}.",
            Icon = "bi-journal-check",
            IsActive = true
        };

        _db.Topics.Add(newTopic);
        return newTopic;
    }

    private async Task<bool> IsActiveUserAsync(Guid userId)
    {
        return await _db.Users.AnyAsync(user => user.Id == userId && user.IsActive && !user.IsLocked);
    }

    private async Task<string?> ValidateQuestionsAsync(
        List<QuizSetQuestionWriteRequest>? questions,
        Guid? defaultTopicId)
    {
        if (questions == null)
        {
            return null;
        }

        if (questions.Count > short.MaxValue)
        {
            return "Quiz set contains too many questions.";
        }

        var topicIds = new HashSet<Guid>();

        for (var index = 0; index < questions.Count; index++)
        {
            var question = questions[index];
            var questionNumber = index + 1;
            var topicId = question.TopicId ?? defaultTopicId;

            if (!topicId.HasValue)
            {
                return $"Topic is required for question {questionNumber}.";
            }

            topicIds.Add(topicId.Value);

            if (string.IsNullOrWhiteSpace(question.Content))
            {
                return $"Content is required for question {questionNumber}.";
            }

            if (question.Options == null ||
                question.Options.Count < 2 ||
                question.Options.Count > byte.MaxValue + 1 ||
                question.Options.Any(option => string.IsNullOrWhiteSpace(option.Content)) ||
                !question.Options.Any(option => option.IsCorrect))
            {
                return $"Question {questionNumber} requires at least two non-empty options and one correct answer.";
            }
        }

        var activeTopicIds = await _db.Topics
            .Where(topic => topicIds.Contains(topic.Id) && topic.IsActive)
            .Select(topic => topic.Id)
            .ToListAsync();
        activeTopicIds.AddRange(_db.ChangeTracker
            .Entries<Topic>()
            .Where(entry => entry.State == EntityState.Added && entry.Entity.IsActive && topicIds.Contains(entry.Entity.Id))
            .Select(entry => entry.Entity.Id));

        return activeTopicIds.Distinct().Count() == topicIds.Count ? null : "Topic not found.";
    }

    private void AddNewQuestionsToQuizSet(
        Guid quizSetId,
        Guid userId,
        Guid? defaultTopicId,
        List<QuizSetQuestionWriteRequest>? requests)
    {
        if (requests == null)
        {
            return;
        }

        for (var index = 0; index < requests.Count; index++)
        {
            var request = requests[index];
            var question = BuildQuestion(request, userId, request.TopicId ?? defaultTopicId!.Value);

            _db.Questions.Add(question);
            _db.QuestionOptions.AddRange(BuildOptions(question.Id, request.Options));
            _db.QuizSetQuestions.Add(new QuizSetQuestion
            {
                QuizSetId = quizSetId,
                QuestionId = question.Id,
                OrderIndex = (short)index
            });
        }
    }

    private async Task ReplaceQuizSetQuestionsAsync(
        Guid quizSetId,
        Guid userId,
        Guid? defaultTopicId,
        List<QuizSetQuestionWriteRequest> requests)
    {
        var existingLinks = await _db.QuizSetQuestions
            .Where(link => link.QuizSetId == quizSetId)
            .ToListAsync();
        _db.QuizSetQuestions.RemoveRange(existingLinks);

        var requestedIds = requests
            .Where(request => request.Id.HasValue)
            .Select(request => request.Id!.Value)
            .ToHashSet();
        var existingQuestionQuery = _db.Questions
            .Include(question => question.QuestionOptions)
            .Where(question => requestedIds.Contains(question.Id));

        // Quiz managers (quiz:edit) may reuse any existing question; others only their own.
        if (!await _permissions.HasPermissionAsync(userId, "quiz:edit"))
        {
            existingQuestionQuery = existingQuestionQuery.Where(question => question.CreatedBy == userId);
        }

        var existingQuestions = await existingQuestionQuery.ToDictionaryAsync(question => question.Id);

        for (var index = 0; index < requests.Count; index++)
        {
            var request = requests[index];
            Question question;

            if (request.Id.HasValue && existingQuestions.TryGetValue(request.Id.Value, out var existingQuestion))
            {
                question = existingQuestion;
                question.TopicId = request.TopicId ?? defaultTopicId!.Value;
                question.Content = request.Content.Trim();
                question.Level = string.IsNullOrWhiteSpace(request.Level) ? "beginner" : request.Level.Trim();
                question.Explanation = request.Explanation?.Trim();
                question.IsActive = true;

                _db.QuestionOptions.RemoveRange(question.QuestionOptions);
                _db.QuestionOptions.AddRange(BuildOptions(question.Id, request.Options));
            }
            else
            {
                question = BuildQuestion(request, userId, request.TopicId ?? defaultTopicId!.Value);
                _db.Questions.Add(question);
                _db.QuestionOptions.AddRange(BuildOptions(question.Id, request.Options));
            }

            _db.QuizSetQuestions.Add(new QuizSetQuestion
            {
                QuizSetId = quizSetId,
                QuestionId = question.Id,
                OrderIndex = (short)index
            });
        }
    }

    private static Question BuildQuestion(QuizSetQuestionWriteRequest request, Guid userId, Guid topicId)
    {
        return new Question
        {
            Id = Guid.NewGuid(),
            TopicId = topicId,
            CreatedBy = userId,
            Content = request.Content.Trim(),
            Level = string.IsNullOrWhiteSpace(request.Level) ? "beginner" : request.Level.Trim(),
            Explanation = request.Explanation?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.Now
        };
    }

    private static List<QuestionOption> BuildOptions(Guid questionId, List<QuestionOptionRequest> requests)
    {
        return requests.Select((request, index) => new QuestionOption
        {
            Id = Guid.NewGuid(),
            QuestionId = questionId,
            Content = request.Content.Trim(),
            IsCorrect = request.IsCorrect,
            OrderIndex = request.OrderIndex ?? (byte)index
        }).ToList();
    }

    private async Task<QuizSetResponse> MapQuizSetResponseAsync(QuizSet quizSet, int questionCount)
    {
        var createdByFullName = quizSet.CreatedByNavigation?.FullName ?? quizSet.CreatedByNavigation?.Username;
        if (string.IsNullOrWhiteSpace(createdByFullName))
        {
            createdByFullName = await _db.Users
                .Where(user => user.Id == quizSet.CreatedBy)
                .Select(user => user.FullName ?? user.Username)
                .FirstOrDefaultAsync()
                ?? string.Empty;
        }

        return new QuizSetResponse
        {
            Id = quizSet.Id,
            CreatedBy = quizSet.CreatedBy,
            CreatedByFullName = createdByFullName,
            Title = quizSet.Title,
            Description = quizSet.Description,
            Mode = quizSet.Mode,
            TimeLimitSeconds = quizSet.TimeLimitSeconds,
            IsPublic = quizSet.IsPublic,
            AllowedCopy = quizSet.AllowedCopy,
            TopicId = quizSet.TopicId,
            Level = quizSet.Level,
            QuestionCount = questionCount
        };
    }

    private async Task<bool> CanManageQuizSetAsync(Guid userId, QuizSet quizSet)
    {
        var isOwner = quizSet.CreatedBy == userId;
        var hasCreate = await _permissions.HasPermissionAsync(userId, "quiz:create");
        var hasEdit = await _permissions.HasPermissionAsync(userId, "quiz:edit");
        return hasEdit || (isOwner && hasCreate);
    }
}
