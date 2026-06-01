using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class SubmissionTestResult
{
    public Guid Id { get; set; }

    public Guid SubmissionId { get; set; }

    public Guid TestCaseId { get; set; }

    public string Status { get; set; } = null!;

    public string? ActualOutput { get; set; }

    public int? RuntimeMs { get; set; }

    public int? MemoryKb { get; set; }

    public virtual Submission Submission { get; set; } = null!;

    public virtual TestCase TestCase { get; set; } = null!;
}
