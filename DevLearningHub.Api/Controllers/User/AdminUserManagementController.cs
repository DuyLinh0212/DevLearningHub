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
[Route("api/admin/users/{userId:guid}/management")]
[Authorize]
// Single screen that combines role assignment and per-permission checkboxes.
// GET returns everything needed to render the form; PUT saves role + permissions together.
public class AdminUserManagementController : ControllerBase
{
    private readonly DevLearningHubContext _db;
    private readonly IPermissionService _permissionService;
    private readonly IAuditService _audit;

    public AdminUserManagementController(DevLearningHubContext db, IPermissionService permissionService, IAuditService audit)
    {
        _db = db;
        _permissionService = permissionService;
        _audit = audit;
    }

    /// <summary>
    /// Load the user, the selectable roles, and the permission catalog with checked state.
    /// </summary>
    [HttpGet]
    [HasPermission("user:view_all")]
    [ProducesResponseType(typeof(ApiResponse<UserManagementResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<UserManagementResponse>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserManagementResponse>>> Get(Guid userId)
    {
        var user = await _db.Users
            .Include(u => u.UserRoleUsers)
            .ThenInclude(ur => ur.Role)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return NotFound(ApiResponse<UserManagementResponse>.Fail("User not found."));
        }

        var response = await BuildResponseAsync(user);
        return Ok(ApiResponse<UserManagementResponse>.Ok(response));
    }

    /// <summary>
    /// Save the selected role and the checked permissions in one operation.
    /// Checked == permission is in effect; the API reconciles per-user grant/deny overrides
    /// against the chosen role so the effective set matches exactly what was sent.
    /// </summary>
    [HttpPut]
    [HasPermission("user:edit_role")]
    [ProducesResponseType(typeof(ApiResponse<UserManagementResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<UserManagementResponse>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<UserManagementResponse>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserManagementResponse>>> Save(Guid userId, [FromBody] SaveUserManagementRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Role))
        {
            return BadRequest(ApiResponse<UserManagementResponse>.Fail("Role is required."));
        }

        User.TryGetUserId(out var adminId);
        if (adminId == userId)
        {
            return BadRequest(ApiResponse<UserManagementResponse>.Fail("You cannot change your own role and permissions."));
        }

        var user = await _db.Users
            .Include(u => u.UserRoleUsers)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return NotFound(ApiResponse<UserManagementResponse>.Fail("User not found."));
        }

        // Resolve the target role.
        var roleName = request.Role.Trim();
        var role = await _db.Roles
            .Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.IsActive && r.Name == roleName);

        if (role == null)
        {
            return BadRequest(ApiResponse<UserManagementResponse>.Fail("Role not found or inactive."));
        }

        // Validate every requested permission name against the catalog.
        var catalog = await _db.Permissions.ToListAsync();
        var catalogByName = catalog.ToDictionary(p => p.Name, StringComparer.OrdinalIgnoreCase);

        var desired = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var name in request.Permissions)
        {
            var trimmed = name?.Trim();
            if (string.IsNullOrWhiteSpace(trimmed))
            {
                continue;
            }

            if (!catalogByName.ContainsKey(trimmed))
            {
                return BadRequest(ApiResponse<UserManagementResponse>.Fail($"Unknown permission: {name}"));
            }

            desired.Add(catalogByName[trimmed].Name);
        }

        var now = DateTime.Now;
        var adminRef = adminId == Guid.Empty ? (Guid?)null : adminId;

        // 1) Replace the user's roles with the single selected role.
        var currentRoles = await _db.UserRoles.Where(ur => ur.UserId == userId).ToListAsync();
        _db.UserRoles.RemoveRange(currentRoles);
        _db.UserRoles.Add(new UserRole
        {
            UserId = userId,
            RoleId = role.Id,
            AssignedAt = now,
            AssignedBy = adminRef
        });

        // 2) Reconcile per-user overrides so effective == desired, given the new role.
        var rolePermissionNames = role.RolePermissions
            .Select(rp => rp.Permission.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var existingOverrides = await _db.UserPermissions
            .Where(up => up.UserId == userId)
            .ToDictionaryAsync(up => up.PermissionId);

        foreach (var permission in catalog)
        {
            var wantHas = desired.Contains(permission.Name);
            var roleHas = rolePermissionNames.Contains(permission.Name);
            existingOverrides.TryGetValue(permission.Id, out var row);

            if (wantHas == roleHas)
            {
                // Role already matches the desired state: drop any override, inherit from role.
                if (row != null)
                {
                    _db.UserPermissions.Remove(row);
                }
                continue;
            }

            // Need an override: grant when role lacks it, deny when role has it but it should be off.
            var isGranted = wantHas && !roleHas;
            if (row != null)
            {
                row.IsGranted = isGranted;
                row.GrantedAt = now;
                row.GrantedBy = adminRef;
            }
            else
            {
                _db.UserPermissions.Add(new UserPermission
                {
                    UserId = userId,
                    PermissionId = permission.Id,
                    IsGranted = isGranted,
                    GrantedAt = now,
                    GrantedBy = adminRef
                });
            }
        }

        await _db.SaveChangesAsync();
        await _audit.LogAsync("user.management_save", "user", userId, $"role={role.Name}; permissions={desired.Count}");

        // Reload roles for an accurate response.
        var fresh = await _db.Users
            .Include(u => u.UserRoleUsers)
            .ThenInclude(ur => ur.Role)
            .AsNoTracking()
            .FirstAsync(u => u.Id == userId);

        var response = await BuildResponseAsync(fresh);
        return Ok(ApiResponse<UserManagementResponse>.Ok(response, "User role and permissions saved."));
    }
    /// <summary>
    /// Force logout a user by deleting their refresh tokens. Requires user:edit_role permission.
    /// POST /api/admin/users/{userId}/management/logout
    /// </summary>
    [HttpPost("logout")]
    [HasPermission("user:edit_role")]
    public async Task<ActionResult<ApiResponse<object>>> ForceLogout(Guid userId)
    {
        // Delete all refresh tokens for this user so they cannot obtain new access tokens.
        var tokens = await _db.RefreshTokens.Where(rt => rt.UserId == userId).ToListAsync();
        if (tokens.Any())
        {
            _db.RefreshTokens.RemoveRange(tokens);
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<object>.Ok(new { loggedOut = true }));
    }


    private async Task<UserManagementResponse> BuildResponseAsync(User user)
    {
        var breakdown = await _permissionService.GetBreakdownAsync(user.Id);
        var effective = breakdown.Effective.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var fromRole = breakdown.RolePermissions.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var assignedRoleNames = user.UserRoleUsers
            .Where(ur => ur.Role.IsActive)
            .Select(ur => ur.Role.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var roleOptions = await _db.Roles
            .AsNoTracking()
            .Where(r => r.IsActive)
            .OrderBy(r => r.Name)
            .Select(r => new RoleOptionResponse
            {
                Name = r.Name,
                Description = r.Description,
                Selected = assignedRoleNames.Contains(r.Name)
            })
            .ToListAsync();

        var permissions = await _db.Permissions
            .AsNoTracking()
            .OrderBy(p => p.Module)
            .ThenBy(p => p.Name)
            .ToListAsync();

        var modules = permissions
            .GroupBy(p => p.Module ?? "other")
            .Select(g => new PermissionModuleSelectionResponse
            {
                Module = g.Key,
                Permissions = g.Select(p => new PermissionSelectionResponse
                {
                    Name = p.Name,
                    Description = p.Description,
                    Module = p.Module ?? "other",
                    Checked = effective.Contains(p.Name),
                    FromRole = fromRole.Contains(p.Name)
                }).ToList()
            })
            .ToList();

        return new UserManagementResponse
        {
            UserId = user.Id,
            Username = user.Username,
            Email = user.Email,
            FullName = user.FullName,
            AvatarUrl = user.AvatarUrl,
            Roles = roleOptions,
            PermissionModules = modules
        };
    }
}
