using System.ComponentModel.DataAnnotations;

namespace DevLearningHub.Api.Dtos.Admin;

// Everything the admin "Manage User" screen needs in a single payload:
// the user's identity, the selectable roles, and the full permission catalog
// with a checked flag reflecting the user's current effective permissions.
public class UserManagementResponse
{
    public Guid UserId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string? FullName { get; set; }

    public string? AvatarUrl { get; set; }

    // All active roles, with exactly one marked Selected.
    public List<RoleOptionResponse> Roles { get; set; } = new();

    // Full permission catalog grouped by module, each with a Checked flag.
    public List<PermissionModuleSelectionResponse> PermissionModules { get; set; } = new();
}

// One selectable role on the management screen.
public class RoleOptionResponse
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool Selected { get; set; }
}

// A module heading with its permissions, for grouped checkbox display.
public class PermissionModuleSelectionResponse
{
    public string Module { get; set; } = string.Empty;

    public List<PermissionSelectionResponse> Permissions { get; set; } = new();
}

// One permission checkbox.
public class PermissionSelectionResponse
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Module { get; set; } = string.Empty;

    // True when the user currently has this permission in effect.
    public bool Checked { get; set; }

    // True when the currently selected role already grants this permission.
    // The UI can use it to show "inherited from role" hints.
    public bool FromRole { get; set; }
}

// Save payload from the management screen: the chosen role plus every checked permission.
public class SaveUserManagementRequest
{
    [Required]
    public string Role { get; set; } = string.Empty;

    // Names of all permissions that should be in effect (the checked boxes).
    public List<string> Permissions { get; set; } = new();
}
