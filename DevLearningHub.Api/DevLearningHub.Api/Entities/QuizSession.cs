using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class QuizSession
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid QuizSetId { get; set; }

    public short? Score { get; set; }

    public short TotalQuestions { get; set; }

    public int? TimeTakenSeconds { get; set; }

    public string Status { get; set; } = null!;

    public DateTime StartedAt { get; set; }

    public DateTime? EndedAt { get; set; }

    public virtual ICollection<QuizAnswer> QuizAnswers { get; set; } = new List<QuizAnswer>();

    public virtual QuizSet QuizSet { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
