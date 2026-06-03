using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class UserRole
{
    public Guid UserId { get; set; }

    public Guid RoleId { get; set; }

    public DateTime AssignedAt { get; set; }

    public Guid? AssignedBy { get; set; }

    public virtual User? AssignedByNavigation { get; set; }

    public virtual Role Role { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
