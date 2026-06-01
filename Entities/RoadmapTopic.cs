using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class RoadmapTopic
{
    public Guid RoadmapId { get; set; }

    public Guid TopicId { get; set; }

    public short OrderIndex { get; set; }

    public virtual Roadmap Roadmap { get; set; } = null!;

    public virtual Topic Topic { get; set; } = null!;
}
