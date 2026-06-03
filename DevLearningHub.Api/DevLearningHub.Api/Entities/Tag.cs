using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class Tag
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;

    public string Slug { get; set; } = null!;

    public string ColorHex { get; set; } = null!;

    public virtual ICollection<Post> Posts { get; set; } = new List<Post>();

    public virtual ICollection<Problem> Problems { get; set; } = new List<Problem>();
}
