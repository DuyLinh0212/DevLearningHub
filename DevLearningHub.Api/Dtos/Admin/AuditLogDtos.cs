namespace DevLearningHub.Api.Dtos.Admin;

// One audit trail row, enriched with the actor's display info.
public class AuditLogResponse
{
    public Guid Id { get; set; }

    public Guid ActorId { get; set; }

    public string? ActorUsername { get; set; }

    public string? ActorFullName { get; set; }

    // What happened, e.g. "auth.login", "user.role_change", "quiz.delete".
    public string Action { get; set; } = string.Empty;

    // The kind of entity affected, e.g. "user", "quiz_set".
    public string? TargetType { get; set; }

    public Guid? TargetId { get; set; }

    // Free-text context about the action.
    public string? Detail { get; set; }

    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; }
}
