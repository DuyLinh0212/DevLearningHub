using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace DevLearningHub.Api.Extensions;

// Helpers for extracting user info from JWT claims.
public static class ClaimsPrincipalExtensions
{
    // Claim type carrying a single granted permission name.
    public const string PermissionClaimType = "permission";

    // Wildcard permission that satisfies every permission check.
    public const string FullControlPermission = "system.full_control";

    public static bool TryGetUserId(this ClaimsPrincipal principal, out Guid userId)
    {
        // Support both NameIdentifier and sub claims.
        userId = Guid.Empty;

        var value = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(value))
        {
            value = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
        }

        return Guid.TryParse(value, out userId);
    }

    // True when the user carries the given permission or the full-control wildcard.
    public static bool HasPermission(this ClaimsPrincipal principal, string permission)
    {
        return principal.HasClaim(PermissionClaimType, permission)
            || principal.HasClaim(PermissionClaimType, FullControlPermission);
    }
}
