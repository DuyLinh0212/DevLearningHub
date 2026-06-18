using Microsoft.AspNetCore.Authorization;

namespace DevLearningHub.Api.Authorization;

// Requires the current user to hold a specific permission.
public sealed class PermissionRequirement : IAuthorizationRequirement
{
    public PermissionRequirement(string permission)
    {
        Permission = permission;
    }

    public string Permission { get; }
}
