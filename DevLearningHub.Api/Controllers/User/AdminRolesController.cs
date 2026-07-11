using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Admin;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Users;

[ApiController]
[Route("api/admin/roles")]
[Authorize]
public class AdminRolesController : ControllerBase
{
    private static readonly HashSet<string> SystemRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "Admin",
        "Moderator",
        "User"
    };

    private readonly DevLearningHubContext _db;
    private readonly IAuditService _audit;
    private readonly INotificationService _notifications;

    public AdminRolesController(DevLearningHubContext db, IAuditService audit, INotificationService notifications)
    {
        _db = db;
        _audit = audit;
        _notifications = notifications;
    }

    [HttpGet]
    [HasPermission("role:view")]
    public async Task<ActionResult<ApiResponse<List<RoleResponse>>>> GetRoles()
    {
        var roles = await _db.Roles
            .AsNoTracking()
            .Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .Include(r => r.UserRoles)
            .OrderBy(r => r.Name)
            .ToListAsync();

        var catalog = await GetPermissionCatalogAsync();
        return Ok(ApiResponse<List<RoleResponse>>.Ok(roles.Select(r => MapRole(r, catalog)).ToList()));
    }

    [HttpGet("{id:guid}")]
    [HasPermission("role:view")]
    public async Task<ActionResult<ApiResponse<RoleResponse>>> GetRole(Guid id)
    {
        var role = await _db.Roles
            .AsNoTracking()
            .Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .Include(r => r.UserRoles)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role == null)
        {
            return NotFound(ApiResponse<RoleResponse>.Fail("Role not found."));
        }

        var catalog = await GetPermissionCatalogAsync();
        return Ok(ApiResponse<RoleResponse>.Ok(MapRole(role, catalog)));
    }

    [HttpPost]
    [HasPermission("role:create")]
    public async Task<ActionResult<ApiResponse<RoleResponse>>> CreateRole(CreateRoleRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(ApiResponse<RoleResponse>.Fail("Role name is required."));
        }

        if (await _db.Roles.AnyAsync(r => r.Name.ToLower() == name.ToLower()))
        {
            return BadRequest(ApiResponse<RoleResponse>.Fail("Role name already exists."));
        }

        var role = new Role
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = request.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _db.Roles.Add(role);
        try
        {
            await ApplyPermissionsAsync(role, request.Permissions);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<RoleResponse>.Fail(ex.Message));
        }
        await _db.SaveChangesAsync();
        await _audit.LogAsync("role.create", "role", role.Id, $"name={role.Name}");

        return Ok(ApiResponse<RoleResponse>.Ok(await LoadRoleAsync(role.Id), "Role created."));
    }

    [HttpPut("{id:guid}")]
    [HasPermission("role:edit")]
    public async Task<ActionResult<ApiResponse<RoleResponse>>> UpdateRole(Guid id, UpdateRoleRequest request)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Id == id);
        if (role == null)
        {
            return NotFound(ApiResponse<RoleResponse>.Fail("Role not found."));
        }

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(ApiResponse<RoleResponse>.Fail("Role name is required."));
        }

        if (SystemRoles.Contains(role.Name) && !string.Equals(role.Name, name, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse<RoleResponse>.Fail("System roles cannot be renamed."));
        }

        if (await _db.Roles.AnyAsync(r => r.Id != id && r.Name.ToLower() == name.ToLower()))
        {
            return BadRequest(ApiResponse<RoleResponse>.Fail("Role name already exists."));
        }

        role.Name = name;
        role.Description = request.Description?.Trim();
        role.IsActive = request.IsActive || SystemRoles.Contains(role.Name);
        role.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        await _audit.LogAsync("role.update", "role", role.Id, $"name={role.Name}");

        return Ok(ApiResponse<RoleResponse>.Ok(await LoadRoleAsync(role.Id), "Role updated."));
    }

    [HttpDelete("{id:guid}")]
    [HasPermission("role:delete")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteRole(Guid id)
    {
        var role = await _db.Roles.Include(r => r.UserRoles).FirstOrDefaultAsync(r => r.Id == id);
        if (role == null)
        {
            return NotFound(ApiResponse<object>.Fail("Role not found."));
        }

        if (SystemRoles.Contains(role.Name))
        {
            return BadRequest(ApiResponse<object>.Fail("System roles cannot be deleted."));
        }

        var affectedUserIds = role.UserRoles.Select(ur => ur.UserId).Distinct().ToList();
        var fallbackRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name.ToLower() == "user" && r.IsActive && r.Id != id);
        await using var transaction = _db.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"
            ? null
            : await _db.Database.BeginTransactionAsync();
        try
        {
            _db.UserRoles.RemoveRange(role.UserRoles);
            if (fallbackRole != null && affectedUserIds.Count > 0)
            {
                var remaining = await _db.UserRoles
                    .Where(ur => affectedUserIds.Contains(ur.UserId) && ur.RoleId != id)
                    .Select(ur => ur.UserId)
                    .Distinct()
                    .ToListAsync();
                var remainingSet = remaining.ToHashSet();
                foreach (var userId in affectedUserIds.Where(uid => !remainingSet.Contains(uid)))
                {
                    _db.UserRoles.Add(new UserRole
                    {
                        UserId = userId,
                        RoleId = fallbackRole.Id,
                        AssignedAt = DateTime.Now,
                        AssignedBy = User.TryGetUserId(out var adminId) ? adminId : null
                    });
                }
            }

            _db.Roles.Remove(role);
            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();
        }
        catch
        {
            if (transaction != null) await transaction.RollbackAsync();
            throw;
        }

        await _audit.LogAsync("role.delete", "role", id, $"name={role.Name}; affectedUsers={affectedUserIds.Count}");
        foreach (var userId in affectedUserIds)
        {
            await _notifications.NotifyAsync(
                userId,
                NotificationTypes.RoleRemoved,
                $"Vai trò '{role.Name}' đã bị xóa. Tài khoản của bạn đã được cập nhật về quyền mặc định.",
                refType: "role");
        }

        return Ok(ApiResponse<object>.Ok(new { deleted = true, affectedUsers = affectedUserIds.Count }));
    }

    [HttpPut("{id:guid}/permissions")]
    [HasPermission("role:assign_permission")]
    public async Task<ActionResult<ApiResponse<RoleResponse>>> SetPermissions(Guid id, SetRolePermissionsRequest request)
    {
        var role = await _db.Roles
            .Include(r => r.RolePermissions)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role == null)
        {
            return NotFound(ApiResponse<RoleResponse>.Fail("Role not found."));
        }

        try
        {
            await ApplyPermissionsAsync(role, request.Permissions);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<RoleResponse>.Fail(ex.Message));
        }
        role.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("role.permissions", "role", role.Id, $"permissions={request.Permissions.Count}");

        return Ok(ApiResponse<RoleResponse>.Ok(await LoadRoleAsync(role.Id), "Role permissions updated."));
    }

    [HttpPost("~/api/admin/users/{userId:guid}/roles/{roleId:guid}")]
    [HasPermission("user:edit_role")]
    public async Task<ActionResult<ApiResponse<object>>> AssignUserRole(Guid userId, Guid roleId)
    {
        if (User.TryGetUserId(out var adminId) && adminId == userId)
        {
            return BadRequest(ApiResponse<object>.Fail("You cannot change your own role."));
        }

        var userExists = await _db.Users.AnyAsync(u => u.Id == userId);
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Id == roleId && r.IsActive);
        if (!userExists || role == null)
        {
            return NotFound(ApiResponse<object>.Fail("User or role not found."));
        }

        var existing = await _db.UserRoles.Where(ur => ur.UserId == userId).ToListAsync();
        _db.UserRoles.RemoveRange(existing);
        _db.UserRoles.Add(new UserRole
        {
            UserId = userId,
            RoleId = roleId,
            AssignedAt = DateTime.Now,
            AssignedBy = adminId == Guid.Empty ? null : adminId
        });

        await _db.SaveChangesAsync();
        await _audit.LogAsync("user.role_assign", "user", userId, $"role={role.Name}");

        return Ok(ApiResponse<object>.Ok(new { role = role.Name }));
    }

    [HttpDelete("~/api/admin/users/{userId:guid}/roles/{roleId:guid}")]
    [HasPermission("user:edit_role")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveUserRole(Guid userId, Guid roleId)
    {
        if (User.TryGetUserId(out var adminId) && adminId == userId)
        {
            return BadRequest(ApiResponse<object>.Fail("You cannot change your own role."));
        }

        var row = await _db.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == roleId);
        if (row == null)
        {
            return NotFound(ApiResponse<object>.Fail("User role assignment not found."));
        }

        _db.UserRoles.Remove(row);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("user.role_remove", "user", userId, $"roleId={roleId}");

        return Ok(ApiResponse<object>.Ok(new { removed = true }));
    }

    private async Task ApplyPermissionsAsync(Role role, List<string> permissionNames)
    {
        var desired = permissionNames
            .Select(p => p.Trim())
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var permissions = await _db.Permissions
            .Where(p => desired.Contains(p.Name))
            .ToListAsync();

        if (permissions.Count != desired.Count)
        {
            var found = permissions.Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var missing = desired.First(p => !found.Contains(p));
            throw new InvalidOperationException($"Unknown permission: {missing}");
        }

        _db.RolePermissions.RemoveRange(role.RolePermissions);
        foreach (var permission in permissions)
        {
            _db.RolePermissions.Add(new RolePermission
            {
                RoleId = role.Id,
                PermissionId = permission.Id,
                GrantedAt = DateTime.Now
            });
        }
    }

    private async Task<RoleResponse> LoadRoleAsync(Guid id)
    {
        var role = await _db.Roles
            .AsNoTracking()
            .Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .Include(r => r.UserRoles)
            .FirstAsync(r => r.Id == id);
        var catalog = await GetPermissionCatalogAsync();
        return MapRole(role, catalog);
    }

    // Full permission catalog, used to expand Admin's effective permissions.
    private async Task<List<string>> GetPermissionCatalogAsync()
    {
        return await _db.Permissions
            .AsNoTracking()
            .Select(p => p.Name)
            .ToListAsync();
    }

    private static RoleResponse MapRole(Role role, IReadOnlyCollection<string> catalog)
    {
        var rawPermissions = role.RolePermissions
            .Select(rp => rp.Permission.Name)
            .OrderBy(p => p)
            .ToList();

        return new RoleResponse
        {
            Id = role.Id,
            Name = role.Name,
            Description = role.Description,
            IsActive = role.IsActive,
            IsSystem = SystemRoles.Contains(role.Name),
            CreatedAt = role.CreatedAt,
            UpdatedAt = role.UpdatedAt,
            UserCount = role.UserRoles.Count,
            Permissions = rawPermissions,
            EffectivePermissions = ComputeEffectivePermissions(role.Name, rawPermissions, catalog)
        };
    }

    // Mirrors PermissionService role-level rules so the admin matrix renders what a
    // role actually has in force: Admin = full catalog + full_control; User = raw + baseline.
    private static List<string> ComputeEffectivePermissions(
        string roleName,
        IEnumerable<string> rawPermissions,
        IReadOnlyCollection<string> catalog)
    {
        var effective = new HashSet<string>(rawPermissions, StringComparer.OrdinalIgnoreCase);

        if (string.Equals(roleName, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var permission in catalog)
            {
                effective.Add(permission);
            }
            effective.Add(ClaimsPrincipalExtensions.FullControlPermission);
        }
        else if (string.Equals(roleName, "User", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var permission in PermissionService.BaselineUserPermissions)
            {
                effective.Add(permission);
            }
        }

        return effective.OrderBy(p => p).ToList();
    }
}
