using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class Topic
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;

    public string Slug { get; set; } = null!;

    public string? Description { get; set; }

    public string? Icon { get; set; }

    public bool IsActive { get; set; }

    public virtual ICollection<Problem> Problems { get; set; } = new List<Problem>();

    public virtual ICollection<Question> Questions { get; set; } = new List<Question>();

    public virtual ICollection<QuizSet> QuizSets { get; set; } = new List<QuizSet>();

    public virtual ICollection<RoadmapTopic> RoadmapTopics { get; set; } = new List<RoadmapTopic>();

    public virtual ICollection<UserTopicProgress> UserTopicProgresses { get; set; } = new List<UserTopicProgress>();
}
