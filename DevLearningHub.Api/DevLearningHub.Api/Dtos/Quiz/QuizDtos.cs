using System.ComponentModel.DataAnnotations;

namespace DevLearningHub.Api.Dtos.Quiz;

// Topic responses.
public class TopicResponse
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? Icon { get; set; }
}

// Question create/update payloads.
public class QuestionOptionRequest
{
    [Required]
    public string Content { get; set; } = string.Empty;

    public bool IsCorrect { get; set; }

    public byte? OrderIndex { get; set; }
}

public class CreateQuestionRequest
{
    [Required]
    public Guid TopicId { get; set; }

    [Required]
    public string Content { get; set; } = string.Empty;

    public string? Level { get; set; }

    public string? Explanation { get; set; }

    [MinLength(2)]
    public List<QuestionOptionRequest> Options { get; set; } = new();
}

public class UpdateQuestionRequest
{
    [Required]
    public Guid TopicId { get; set; }

    [Required]
    public string Content { get; set; } = string.Empty;

    public string? Level { get; set; }

    public string? Explanation { get; set; }

    public bool IsActive { get; set; } = true;

    [MinLength(2)]
    public List<QuestionOptionRequest> Options { get; set; } = new();
}

// Question response payloads.
public class QuestionOptionResponse
{
    public Guid Id { get; set; }

    public string Content { get; set; } = string.Empty;

    public bool IsCorrect { get; set; }

    public byte OrderIndex { get; set; }
}

public class QuestionResponse
{
    public Guid Id { get; set; }

    public Guid TopicId { get; set; }

    public string Content { get; set; } = string.Empty;

    public string Level { get; set; } = string.Empty;

    public string? Explanation { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<QuestionOptionResponse> Options { get; set; } = new();
}

// Quiz set requests.
public class CreateQuizSetRequest
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? Mode { get; set; }

    public int? TimeLimitSeconds { get; set; }

    public bool IsPublic { get; set; }

    public Guid? TopicId { get; set; }

    public string? Level { get; set; }
}

public class UpdateQuizSetRequest
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? Mode { get; set; }

    public int? TimeLimitSeconds { get; set; }

    public bool IsPublic { get; set; }

    public Guid? TopicId { get; set; }

    public string? Level { get; set; }
}

public class AssignQuestionRequest
{
    [Required]
    public Guid QuestionId { get; set; }

    public short? OrderIndex { get; set; }
}

// Quiz set responses.
public class QuizSetResponse
{
    public Guid Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Mode { get; set; } = string.Empty;

    public int? TimeLimitSeconds { get; set; }

    public bool IsPublic { get; set; }

    public Guid? TopicId { get; set; }

    public string? Level { get; set; }

    public int QuestionCount { get; set; }
}

public class QuizSetQuestionResponse
{
    public Guid QuestionId { get; set; }

    public string Content { get; set; } = string.Empty;

    public string Level { get; set; } = string.Empty;

    public short OrderIndex { get; set; }
}

public class QuizSetDetailResponse
{
    public Guid Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Mode { get; set; } = string.Empty;

    public int? TimeLimitSeconds { get; set; }

    public bool IsPublic { get; set; }

    public Guid? TopicId { get; set; }

    public string? Level { get; set; }

    public List<QuizSetQuestionResponse> Questions { get; set; } = new();
}

// Quiz session requests.
public class StartQuizRequest
{
    [Required]
    public Guid QuizSetId { get; set; }
}

public class QuizQuestionOptionResponse
{
    public Guid Id { get; set; }

    public string Content { get; set; } = string.Empty;

    public byte OrderIndex { get; set; }
}

public class QuizQuestionResponse
{
    public Guid QuestionId { get; set; }

    public string Content { get; set; } = string.Empty;

    public string Level { get; set; } = string.Empty;

    public List<QuizQuestionOptionResponse> Options { get; set; } = new();
}

public class StartQuizResponse
{
    public Guid SessionId { get; set; }

    public Guid QuizSetId { get; set; }

    public string Title { get; set; } = string.Empty;

    public int? TimeLimitSeconds { get; set; }

    public short TotalQuestions { get; set; }

    public DateTime StartedAt { get; set; }

    public List<QuizQuestionResponse> Questions { get; set; } = new();
}

public class SubmitQuizAnswerRequest
{
    [Required]
    public Guid QuestionId { get; set; }

    public Guid? SelectedOptionId { get; set; }
}

public class SubmitQuizRequest
{
    public List<SubmitQuizAnswerRequest> Answers { get; set; } = new();

    public int? TimeTakenSeconds { get; set; }
}

// Quiz result responses.
public class QuizResultAnswerResponse
{
    public Guid QuestionId { get; set; }

    public Guid? SelectedOptionId { get; set; }

    public Guid? CorrectOptionId { get; set; }

    public bool IsCorrect { get; set; }
}

public class QuizResultResponse
{
    public Guid SessionId { get; set; }

    public Guid QuizSetId { get; set; }

    public short Score { get; set; }

    public short TotalQuestions { get; set; }

    public double Accuracy { get; set; }

    public int? TimeTakenSeconds { get; set; }

    public DateTime StartedAt { get; set; }

    public DateTime? EndedAt { get; set; }

    public List<QuizResultAnswerResponse> Answers { get; set; } = new();
}

// User progress and roadmap responses.
public class UserTopicProgressResponse
{
    public Guid TopicId { get; set; }

    public string TopicName { get; set; } = string.Empty;

    public int TotalAttempts { get; set; }

    public int TotalQuestions { get; set; }

    public int CorrectAnswers { get; set; }

    public int? BestScore { get; set; }

    public double Accuracy { get; set; }

    public DateTime? LastPracticedAt { get; set; }
}

public class RoadmapTopicResponse
{
    public Guid TopicId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public short OrderIndex { get; set; }
}

public class RoadmapResponse
{
    public Guid Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Level { get; set; } = string.Empty;

    public string? Description { get; set; }

    public short OrderIndex { get; set; }

    public List<RoadmapTopicResponse> Topics { get; set; } = new();
}

// Bulk import summary.
public class ImportQuestionsResultResponse
{
    public int CreatedCount { get; set; }

    public int SkippedCount { get; set; }

    public List<string> Errors { get; set; } = new();
}
