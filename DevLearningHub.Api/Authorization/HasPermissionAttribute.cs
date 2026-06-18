using Microsoft.AspNetCore.Authorization;

namespace DevLearningHub.Api.Authorization;

// Restrict an endpoint to users holding the given permission, e.g. [HasPermission("quiz:create")].
public sealed class HasPermissionAttribute : AuthorizeAttribute
{
    public HasPermissionAttribute(string permission)
    {
        Policy = $"{PermissionPolicyProvider.PolicyPrefix}{permission}";
    }
}
