using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Services;

// Computes a user's effective permissions from their roles plus per-user overrides.
public interface IPermissionService
{
    Task<HashSet<string>> GetEffectivePermissionsAsync(Guid userId);

    Task<UserPermissionBreakdown> GetBreakdownAsync(Guid userId);
}

// Detailed view of how a user's effective permissions are derived.
public sealed class UserPermissionBreakdown
{
    public List<string> RolePermissions { get; init; } = new();

    public List<string> Grants { get; init; } = new();

    public List<string> Denies { get; init; } = new();

    public List<string> Effective { get; init; } = new();
}

public sealed class PermissionService : IPermissionService
{
    // Baseline permissions every "User" role member gets implicitly, on top of any
    // raw role_permissions rows. Exposed so role-level effective permission computation
    // (e.g. the admin permission matrix) stays in sync with this single source of truth.
    public static readonly string[] BaselineUserPermissions =
    [
        "quiz:create",
        "comment:create",
        "post:create",
        "post:edit_own",
        "problem:create",
        "problem:edit",
        "roadmap:create",
        "roadmap:edit"
    ];

    private readonly DevLearningHubContext _db;

    public PermissionService(DevLearningHubContext db)
    {
        _db = db;
    }

    public async Task<HashSet<string>> GetEffectivePermissionsAsync(Guid userId)
    {
        var breakdown = await GetBreakdownAsync(userId);
        return breakdown.Effective.ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public async Task<UserPermissionBreakdown> GetBreakdownAsync(Guid userId)
    {
        var roleNames = await _db.UserRoles
            .Where(ur => ur.UserId == userId && ur.Role.IsActive)
            .Select(ur => ur.Role.Name)
            .ToListAsync();

        // Permissions inherited from every active role assigned to the user.
        var rolePermissions = await _db.UserRoles
            .Where(ur => ur.UserId == userId && ur.Role.IsActive)
            .SelectMany(ur => ur.Role.RolePermissions.Select(rp => rp.Permission.Name))
            .Distinct()
            .ToListAsync();

        if (roleNames.Any(role => string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)))
        {
            rolePermissions = await _db.Permissions
                .Select(p => p.Name)
                .Distinct()
                .ToListAsync();
            if (!rolePermissions.Contains(ClaimsPrincipalExtensions.FullControlPermission, StringComparer.OrdinalIgnoreCase))
            {
                rolePermissions.Add(ClaimsPrincipalExtensions.FullControlPermission);
            }
        }
        else if (roleNames.Any(role => string.Equals(role, "User", StringComparison.OrdinalIgnoreCase)))
        {
            foreach (var permission in BaselineUserPermissions)
            {
                if (!rolePermissions.Contains(permission, StringComparer.OrdinalIgnoreCase))
                {
                    rolePermissions.Add(permission);
                }
            }
        }

        // Per-user overrides: IsGranted=true adds, IsGranted=false revokes.
        var overrides = await _db.UserPermissions
            .Where(up => up.UserId == userId)
            .Select(up => new { up.Permission.Name, up.IsGranted })
            .ToListAsync();

        var grants = overrides
            .Where(o => o.IsGranted)
            .Select(o => o.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var denies = overrides
            .Where(o => !o.IsGranted)
            .Select(o => o.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var denySet = denies.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var effective = rolePermissions
            .Concat(grants)
            .Where(name => !denySet.Contains(name))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(name => name)
            .ToList();

        return new UserPermissionBreakdown
        {
            RolePermissions = rolePermissions.OrderBy(name => name).ToList(),
            Grants = grants.OrderBy(name => name).ToList(),
            Denies = denies.OrderBy(name => name).ToList(),
            Effective = effective
        };
    }
}
