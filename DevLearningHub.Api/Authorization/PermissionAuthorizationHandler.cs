using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;

namespace DevLearningHub.Api.Authorization;

// Resolves permissions from the live database so newly granted permissions take
// effect immediately without requiring the user to sign in again.
public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IPermissionService _permissions;

    public PermissionAuthorizationHandler(IPermissionService permissions)
    {
        _permissions = permissions;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.User.HasPermission(requirement.Permission))
        {
            context.Succeed(requirement);
            return;
        }

        if (!context.User.TryGetUserId(out var userId))
        {
            return;
        }

        if (await _permissions.HasPermissionAsync(userId, requirement.Permission))
        {
            context.Succeed(requirement);
        }
    }
}
