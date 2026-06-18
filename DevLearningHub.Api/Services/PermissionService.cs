using DevLearningHub.Api.Entities;
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
        // Permissions inherited from every active role assigned to the user.
        var rolePermissions = await _db.UserRoles
            .Where(ur => ur.UserId == userId && ur.Role.IsActive)
            .SelectMany(ur => ur.Role.RolePermissions.Select(rp => rp.Permission.Name))
            .Distinct()
            .ToListAsync();

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
