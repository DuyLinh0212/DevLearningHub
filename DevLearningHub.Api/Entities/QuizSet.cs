using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class QuizSet
{
    public Guid Id { get; set; }

    public Guid CreatedBy { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string Mode { get; set; } = null!;

    public int? TimeLimitSeconds { get; set; }

    public bool IsPublic { get; set; }

    public DateTime CreatedAt { get; set; }

    public Guid? TopicId { get; set; }

    public string? Level { get; set; }

    public bool AllowedCopy { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<QuizSession> QuizSessions { get; set; } = new List<QuizSession>();

    public virtual ICollection<QuizSetQuestion> QuizSetQuestions { get; set; } = new List<QuizSetQuestion>();

    public virtual Topic? Topic { get; set; }
}
