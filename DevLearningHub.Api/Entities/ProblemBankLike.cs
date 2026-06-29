using System;

namespace DevLearningHub.Api.Entities;

// One like by a user on a problem bank (one row per user per bank).
public partial class ProblemBankLike
{
    public Guid BankId { get; set; }

    public Guid UserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ProblemBank Bank { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
