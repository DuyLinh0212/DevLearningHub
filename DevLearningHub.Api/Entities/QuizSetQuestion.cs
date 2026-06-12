using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class QuizSetQuestion
{
    public Guid QuizSetId { get; set; }

    public Guid QuestionId { get; set; }

    public short OrderIndex { get; set; }

    public virtual Question Question { get; set; } = null!;

    public virtual QuizSet QuizSet { get; set; } = null!;
}
