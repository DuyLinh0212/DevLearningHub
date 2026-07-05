using System.ComponentModel.DataAnnotations;

namespace DevLearningHub.Api.Dtos.Admin;

public class RoleResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public bool IsSystem { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<string> Permissions { get; set; } = new();

    // Permissions the role effectively has in force, used to render the permission
    // matrix correctly. For Admin this is the whole catalog (plus system.full_control);
    // for User it adds the baseline user permissions; other roles mirror Permissions.
    public List<string> EffectivePermissions { get; set; } = new();

    public int UserCount { get; set; }
}

public class CreateRoleRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Description { get; set; }

    public List<string> Permissions { get; set; } = new();
}

public class UpdateRoleRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
}

public class SetRolePermissionsRequest
{
    public List<string> Permissions { get; set; } = new();
}
