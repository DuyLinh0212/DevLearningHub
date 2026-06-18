using System.ComponentModel.DataAnnotations;

namespace DevLearningHub.Api.Dtos.Admin;

// A single permission in the catalog.
public class PermissionResponse
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? Module { get; set; }
}

// Permissions grouped by their module for catalog display.
public class PermissionModuleResponse
{
    public string Module { get; set; } = string.Empty;

    public List<PermissionResponse> Permissions { get; set; } = new();
}

// A user's effective permissions and how they are derived.
public class UserPermissionsResponse
{
    public Guid UserId { get; set; }

    public List<string> Roles { get; set; } = new();

    // Permissions inherited from the user's roles.
    public List<string> RolePermissions { get; set; } = new();

    // Permissions explicitly granted to the user on top of their roles.
    public List<string> Grants { get; set; } = new();

    // Permissions explicitly revoked from the user despite their roles.
    public List<string> Denies { get; set; } = new();

    // Final permissions in effect = (role + grants) - denies.
    public List<string> Effective { get; set; } = new();
}

// One override instruction for a permission.
public class PermissionOverrideItem
{
    [Required]
    public string Permission { get; set; } = string.Empty;

    // "grant", "deny", or "inherit" (remove the override).
    [Required]
    public string State { get; set; } = string.Empty;
}

// Batch update of a user's permission overrides.
public class SetUserPermissionsRequest
{
    public List<PermissionOverrideItem> Items { get; set; } = new();
}
