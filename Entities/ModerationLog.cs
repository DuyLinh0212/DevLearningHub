using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class ModerationLog
{
    public Guid Id { get; set; }

    public Guid ModeratorId { get; set; }

    public string TargetType { get; set; } = null!;

    public Guid TargetId { get; set; }

    public string Action { get; set; } = null!;

    public string? Reason { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User Moderator { get; set; } = null!;
}
