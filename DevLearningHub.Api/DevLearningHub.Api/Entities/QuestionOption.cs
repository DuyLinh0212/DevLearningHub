using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class QuestionOption
{
    public Guid Id { get; set; }

    public Guid QuestionId { get; set; }

    public string Content { get; set; } = null!;

    public bool IsCorrect { get; set; }

    public byte OrderIndex { get; set; }

    public virtual Question Question { get; set; } = null!;

    public virtual ICollection<QuizAnswer> QuizAnswers { get; set; } = new List<QuizAnswer>();
}
