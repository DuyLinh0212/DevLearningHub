using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class Report
{
    public Guid Id { get; set; }

    public Guid ReportTypeId { get; set; }

    public Guid ReporterId { get; set; }

    public Guid TargetId { get; set; }

    public string? Description { get; set; }

    public string Status { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public Guid? ResolvedBy { get; set; }

    public virtual ReportType ReportType { get; set; } = null!;

    public virtual User Reporter { get; set; } = null!;

    public virtual User? Resolver { get; set; }
}
