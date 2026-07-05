using System;

namespace DevLearningHub.Api.Entities;

public partial class UserRoadmapItemCompletion
{
    public Guid UserId { get; set; }

    public Guid RoadmapItemId { get; set; }

    public DateTime CompletedAt { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual RoadmapItem RoadmapItem { get; set; } = null!;
}
