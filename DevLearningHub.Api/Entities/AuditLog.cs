using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class AuditLog
{
    public Guid Id { get; set; }

    public Guid ActorId { get; set; }

    public string Action { get; set; } = null!;

    public string? TargetType { get; set; }

    public Guid? TargetId { get; set; }

    public string? Detail { get; set; }

    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User Actor { get; set; } = null!;
}
