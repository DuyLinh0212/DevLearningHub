using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class Problem
{
    public Guid Id { get; set; }

    public Guid TopicId { get; set; }

    public Guid CreatedBy { get; set; }

    public string Title { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string Difficulty { get; set; } = null!;

    public string? StarterCode { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<Submission> Submissions { get; set; } = new List<Submission>();

    public virtual ICollection<TestCase> TestCases { get; set; } = new List<TestCase>();

    public virtual Topic Topic { get; set; } = null!;

    public virtual ICollection<Tag> Tags { get; set; } = new List<Tag>();
}
