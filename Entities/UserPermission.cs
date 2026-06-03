using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class UserPermission
{
    public Guid UserId { get; set; }

    public Guid PermissionId { get; set; }

    public bool IsGranted { get; set; }

    public DateTime GrantedAt { get; set; }

    public Guid? GrantedBy { get; set; }

    public virtual User? GrantedByNavigation { get; set; }

    public virtual Permission Permission { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
