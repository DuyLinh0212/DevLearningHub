using DevLearningHub.Api.Extensions;
using Microsoft.AspNetCore.Authorization;

namespace DevLearningHub.Api.Authorization;

// Grants access when the JWT carries the required permission (or the full-control wildcard).
public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.User.HasPermission(requirement.Permission))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
