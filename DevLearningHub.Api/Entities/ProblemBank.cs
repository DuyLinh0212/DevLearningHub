using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

// A curated collection of code exercises managed centrally by its creator.
public partial class ProblemBank
{
    public Guid Id { get; set; }

    public Guid CreatedBy { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsPublic { get; set; }

    public string ReviewStatus { get; set; } = "pending";

    public Guid? ReviewedBy { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewNote { get; set; }

    public Guid? TopicId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual User? Reviewer { get; set; }

    public virtual Topic? Topic { get; set; }

    public virtual ICollection<ProblemBankItem> Items { get; set; } = new List<ProblemBankItem>();

    public virtual ICollection<ProblemBankLike> Likes { get; set; } = new List<ProblemBankLike>();

    public virtual ICollection<ProblemBankRating> Ratings { get; set; } = new List<ProblemBankRating>();
}
