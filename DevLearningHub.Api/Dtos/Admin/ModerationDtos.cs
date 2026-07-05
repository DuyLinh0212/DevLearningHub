using System.ComponentModel.DataAnnotations;

namespace DevLearningHub.Api.Dtos.Admin;

public class ModerationQueueItemResponse
{
    public string Type { get; set; } = string.Empty;
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ReviewStatus { get; set; } = string.Empty;
    public string? AuthorUsername { get; set; }
    public string? AuthorFullName { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }
}

public class ReviewContentRequest
{
    [MaxLength(500)]
    public string? Reason { get; set; }
}

public class ModerationLogResponse
{
    public Guid Id { get; set; }
    public Guid ModeratorId { get; set; }
    public string? ModeratorUsername { get; set; }
    public string? ModeratorFullName { get; set; }
    public string TargetType { get; set; } = string.Empty;
    public Guid TargetId { get; set; }
    public string? TargetTitle { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }
}
