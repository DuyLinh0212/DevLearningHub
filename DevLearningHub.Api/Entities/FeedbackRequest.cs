namespace DevLearningHub.Api.Entities;

public class FeedbackRequest
{
    public Guid Id { get; set; }
    public Guid AuthorId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Status { get; set; } = "open";
    public string? AdminResponse { get; set; }
    public Guid? RespondedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public User Author { get; set; } = null!;
    public User? Responder { get; set; }
}
