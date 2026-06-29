using System;

namespace DevLearningHub.Api.Entities;

// Link row between a problem bank and a code exercise (problems).
public partial class ProblemBankItem
{
    public Guid BankId { get; set; }

    public Guid ProblemId { get; set; }

    public int OrderIndex { get; set; }

    public DateTime AddedAt { get; set; }

    public virtual ProblemBank Bank { get; set; } = null!;

    public virtual Problem Problem { get; set; } = null!;
}
