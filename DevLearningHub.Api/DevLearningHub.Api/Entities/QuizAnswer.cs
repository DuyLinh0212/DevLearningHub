using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class QuizAnswer
{
    public Guid Id { get; set; }

    public Guid SessionId { get; set; }

    public Guid QuestionId { get; set; }

    public Guid? SelectedOptionId { get; set; }

    public bool IsCorrect { get; set; }

    public virtual Question Question { get; set; } = null!;

    public virtual QuestionOption? SelectedOption { get; set; }

    public virtual QuizSession Session { get; set; } = null!;
}
