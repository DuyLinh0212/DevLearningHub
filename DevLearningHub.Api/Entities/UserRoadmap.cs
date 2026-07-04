using System;

namespace DevLearningHub.Api.Entities;

public partial class UserRoadmap
{
    public Guid UserId { get; set; }

    public Guid RoadmapId { get; set; }

    public DateTime StartedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public DateTime? LastActivityAt { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual Roadmap Roadmap { get; set; } = null!;
}
