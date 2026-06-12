using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace DevLearningHub.Api.Extensions;

// Helpers for extracting user info from JWT claims.
public static class ClaimsPrincipalExtensions
{
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
}
