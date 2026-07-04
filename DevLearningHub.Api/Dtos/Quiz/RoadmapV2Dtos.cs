namespace DevLearningHub.Api.Dtos.Quiz;

public class RoadmapItemResponse
{
    public Guid Id { get; set; }
    public string ItemType { get; set; } = string.Empty;
    public Guid? TopicId { get; set; }
    public Guid? QuizSetId { get; set; }
    public Guid? ProblemId { get; set; }
    public Guid? ProblemBankId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public short OrderIndex { get; set; }
    public bool IsRequired { get; set; }
    public bool Completed { get; set; }
}

public class UpsertRoadmapItemRequest
{
    public string ItemType { get; set; } = string.Empty;
    public Guid? TopicId { get; set; }
    public Guid? QuizSetId { get; set; }
    public Guid? ProblemId { get; set; }
    public Guid? ProblemBankId { get; set; }
    public string? TitleOverride { get; set; }
    public string? DescriptionOverride { get; set; }
    public int OrderIndex { get; set; }
    public bool IsRequired { get; set; } = true;
}

public class RoadmapProgressResponse
{
    public Guid RoadmapId { get; set; }
    public Guid UserId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int TotalItems { get; set; }
    public int CompletedItems { get; set; }
    public double CompletionPercent { get; set; }
    public List<RoadmapItemResponse> Items { get; set; } = new();
}

public class RoadmapParticipantResponse
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? LastActivityAt { get; set; }
    public int TotalItems { get; set; }
    public int CompletedItems { get; set; }
    public double CompletionPercent { get; set; }
}
