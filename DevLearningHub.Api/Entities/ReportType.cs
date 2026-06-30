using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class ReportType
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public virtual ICollection<Report> Reports { get; set; } = new List<Report>();
}
