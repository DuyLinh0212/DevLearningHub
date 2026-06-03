using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class Submission
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid ProblemId { get; set; }

    public string Code { get; set; } = null!;

    public string Language { get; set; } = null!;

    public string Verdict { get; set; } = null!;

    public int? RuntimeMs { get; set; }

    public int? MemoryKb { get; set; }

    public short PassedCases { get; set; }

    public short TotalCases { get; set; }

    public DateTime SubmittedAt { get; set; }

    public string? Stdout { get; set; }

    public string? Stderr { get; set; }

    public string? CompileOutput { get; set; }

    public string? Judge0Token { get; set; }

    public int? LanguageId { get; set; }

    public virtual ProgrammingLanguage? LanguageNavigation { get; set; }

    public virtual Problem Problem { get; set; } = null!;

    public virtual ICollection<SubmissionTestResult> SubmissionTestResults { get; set; } = new List<SubmissionTestResult>();

    public virtual User User { get; set; } = null!;
}
