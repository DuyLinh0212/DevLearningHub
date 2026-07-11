using System.ComponentModel.DataAnnotations;

namespace DevLearningHub.Api.Dtos.Community;

public class CreateFeedbackRequest
{
    [Required, MaxLength(200)] public string Subject { get; set; } = string.Empty;
    [Required, MaxLength(5000)] public string Body { get; set; } = string.Empty;
}

public class UpdateFeedbackRequest
{
    [Required] public string Status { get; set; } = "open";
    [MaxLength(5000)] public string? AdminResponse { get; set; }
}

public class FeedbackResponse
{
    public Guid Id { get; set; }
    public Guid AuthorId { get; set; }
    public string AuthorUsername { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? AdminResponse { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
