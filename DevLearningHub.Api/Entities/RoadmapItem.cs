using System;

namespace DevLearningHub.Api.Entities;

public partial class RoadmapItem
{
    public Guid Id { get; set; }

    public Guid RoadmapId { get; set; }

    public string ItemType { get; set; } = null!;

    public Guid? TopicId { get; set; }

    public Guid? QuizSetId { get; set; }

    public Guid? ProblemId { get; set; }

    public Guid? ProblemBankId { get; set; }

    public string? TitleOverride { get; set; }

    public string? DescriptionOverride { get; set; }

    public short OrderIndex { get; set; }

    public bool IsRequired { get; set; }

    public byte? PassThreshold { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Roadmap Roadmap { get; set; } = null!;

    public virtual Topic? Topic { get; set; }

    public virtual QuizSet? QuizSet { get; set; }

    public virtual Problem? Problem { get; set; }

    public virtual ProblemBank? ProblemBank { get; set; }
}
