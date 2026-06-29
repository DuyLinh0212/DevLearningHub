using System;

namespace DevLearningHub.Api.Entities;

// A 1-5 star rating (with optional review text) by a user on a problem bank.
// One row per user per bank; updatable.
public partial class ProblemBankRating
{
    public Guid BankId { get; set; }

    public Guid UserId { get; set; }

    public byte Rating { get; set; }

    public string? Comment { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ProblemBank Bank { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
