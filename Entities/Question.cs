using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class Question
{
    public Guid Id { get; set; }

    public Guid TopicId { get; set; }

    public Guid CreatedBy { get; set; }

    public string Content { get; set; } = null!;

    public string Level { get; set; } = null!;

    public string? Explanation { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<QuestionOption> QuestionOptions { get; set; } = new List<QuestionOption>();

    public virtual ICollection<QuizAnswer> QuizAnswers { get; set; } = new List<QuizAnswer>();

    public virtual ICollection<QuizSetQuestion> QuizSetQuestions { get; set; } = new List<QuizSetQuestion>();

    public virtual Topic Topic { get; set; } = null!;
}
