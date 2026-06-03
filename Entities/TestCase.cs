using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class TestCase
{
    public Guid Id { get; set; }

    public Guid ProblemId { get; set; }

    public string Input { get; set; } = null!;

    public string ExpectedOutput { get; set; } = null!;

    public bool IsHidden { get; set; }

    public short OrderIndex { get; set; }

    public virtual Problem Problem { get; set; } = null!;

    public virtual ICollection<SubmissionTestResult> SubmissionTestResults { get; set; } = new List<SubmissionTestResult>();
}
