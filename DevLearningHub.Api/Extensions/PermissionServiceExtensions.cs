using DevLearningHub.Api.Services;

namespace DevLearningHub.Api.Extensions;

// Live permission checks resolved from the database (role permissions + per-user
// overrides). Unlike ClaimsPrincipal.HasPermission, which reads the JWT issued at
// login, these reflect grants made after the user signed in — so newly granted
// permissions take effect immediately, without requiring a re-login.
public static class PermissionServiceExtensions
{
    public static async Task<bool> HasPermissionAsync(this IPermissionService service, Guid userId, string permission)
    {
        if (userId == Guid.Empty)
        {
            return false;
        }

        var effective = await service.GetEffectivePermissionsAsync(userId);
        return effective.Contains(permission)
            || effective.Contains(ClaimsPrincipalExtensions.FullControlPermission);
    }
}
