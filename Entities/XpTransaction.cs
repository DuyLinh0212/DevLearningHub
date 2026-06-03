using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class XpTransaction
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public int Amount { get; set; }

    public string Reason { get; set; } = null!;

    public string? RefType { get; set; }

    public Guid? RefId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
