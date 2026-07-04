using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class Roadmap
{
    public Guid Id { get; set; }

    public string Title { get; set; } = null!;

    public string Level { get; set; } = null!;

    public string? Description { get; set; }

    public short OrderIndex { get; set; }

    public virtual ICollection<RoadmapTopic> RoadmapTopics { get; set; } = new List<RoadmapTopic>();

    public virtual ICollection<RoadmapItem> RoadmapItems { get; set; } = new List<RoadmapItem>();

    public virtual ICollection<UserRoadmap> UserRoadmaps { get; set; } = new List<UserRoadmap>();
}
