using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class UserTopicProgress
{
    public Guid UserId { get; set; }

    public Guid TopicId { get; set; }

    public int TotalAttempts { get; set; }

    public int TotalQuestions { get; set; }

    public int CorrectAnswers { get; set; }

    public int? BestScore { get; set; }

    public DateTime? LastPracticedAt { get; set; }

    public virtual Topic Topic { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
