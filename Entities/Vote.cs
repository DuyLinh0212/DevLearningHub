using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class Vote
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string TargetType { get; set; } = null!;

    public Guid TargetId { get; set; }

    public string VoteType { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
