using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class ProgrammingLanguage
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string Slug { get; set; } = null!;

    public int Judge0LanguageId { get; set; }

    public bool IsActive { get; set; }

    public virtual ICollection<Submission> Submissions { get; set; } = new List<Submission>();
}
