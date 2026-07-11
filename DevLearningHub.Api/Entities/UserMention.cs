namespace DevLearningHub.Api.Entities;

public class UserMention
{
    public Guid Id { get; set; }
    public Guid MentionedUserId { get; set; }
    public Guid AuthorId { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public Guid SourceId { get; set; }
    public DateTime CreatedAt { get; set; }
    public User MentionedUser { get; set; } = null!;
    public User Author { get; set; } = null!;
}
