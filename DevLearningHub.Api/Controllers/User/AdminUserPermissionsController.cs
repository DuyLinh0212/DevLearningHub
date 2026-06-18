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
[Route("api/admin/users/{userId:guid}/permissions")]
[Authorize(Policy = AppPolicies.AdminOnly)]
// Grant or revoke individual permissions for a single user, on top of their roles.
public class AdminUserPermissionsController : ControllerBase
{
    private readonly DevLearningHubContext _db;
    private readonly IPermissionService _permissionService;

    public AdminUserPermissionsController(DevLearningHubContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    /// <summary>
    /// Get a user's effective permissions plus the role/grant/deny breakdown.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<UserPermissionsResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<UserPermissionsResponse>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserPermissionsResponse>>> Get(Guid userId)
    {
        var user = await _db.Users
            .Include(u => u.UserRoleUsers)
            .ThenInclude(ur => ur.Role)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return NotFound(ApiResponse<UserPermissionsResponse>.Fail("User not found."));
        }

        return Ok(ApiResponse<UserPermissionsResponse>.Ok(await BuildResponseAsync(user)));
    }

    /// <summary>
    /// Apply a batch of permission overrides. Each item state is grant, deny, or inherit.
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(ApiResponse<UserPermissionsResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<UserPermissionsResponse>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<UserPermissionsResponse>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserPermissionsResponse>>> Set(Guid userId, [FromBody] SetUserPermissionsRequest request)
    {
        var user = await _db.Users
            .Include(u => u.UserRoleUsers)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return NotFound(ApiResponse<UserPermissionsResponse>.Fail("User not found."));
        }

        if (request.Items.Count == 0)
        {
            return BadRequest(ApiResponse<UserPermissionsResponse>.Fail("No permission changes were provided."));
        }

        var catalog = await _db.Permissions.ToDictionaryAsync(p => p.Name, StringComparer.OrdinalIgnoreCase);
        var existing = await _db.UserPermissions
            .Where(up => up.UserId == userId)
            .ToDictionaryAsync(up => up.PermissionId);

        User.TryGetUserId(out var adminId);
        var now = DateTime.Now;

        foreach (var item in request.Items)
        {
            var name = item.Permission?.Trim();
            if (string.IsNullOrWhiteSpace(name) || !catalog.TryGetValue(name, out var permission))
            {
                return BadRequest(ApiResponse<UserPermissionsResponse>.Fail($"Unknown permission: {item.Permission}"));
            }

            var state = item.State?.Trim().ToLowerInvariant();
            var hasOverride = existing.TryGetValue(permission.Id, out var row);

            switch (state)
            {
                case "grant":
                case "deny":
                    var isGranted = state == "grant";
                    if (hasOverride)
                    {
                        row!.IsGranted = isGranted;
                        row.GrantedAt = now;
                        row.GrantedBy = adminId == Guid.Empty ? null : adminId;
                    }
                    else
                    {
                        _db.UserPermissions.Add(new UserPermission
                        {
                            UserId = userId,
                            PermissionId = permission.Id,
                            IsGranted = isGranted,
                            GrantedAt = now,
                            GrantedBy = adminId == Guid.Empty ? null : adminId
                        });
                    }
                    break;

                case "inherit":
                    if (hasOverride)
                    {
                        _db.UserPermissions.Remove(row!);
                    }
                    break;

                default:
                    return BadRequest(ApiResponse<UserPermissionsResponse>.Fail($"Invalid state '{item.State}'. Use grant, deny, or inherit."));
            }
        }

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<UserPermissionsResponse>.Ok(await BuildResponseAsync(user)));
    }

    /// <summary>
    /// Remove a single permission override so the user inherits from their roles again.
    /// </summary>
    [HttpDelete("{permission}")]
    [ProducesResponseType(typeof(ApiResponse<UserPermissionsResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<UserPermissionsResponse>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserPermissionsResponse>>> RemoveOverride(Guid userId, string permission)
    {
        var user = await _db.Users
            .Include(u => u.UserRoleUsers)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return NotFound(ApiResponse<UserPermissionsResponse>.Fail("User not found."));
        }

        var row = await _db.UserPermissions
            .FirstOrDefaultAsync(up => up.UserId == userId && up.Permission.Name == permission);

        if (row != null)
        {
            _db.UserPermissions.Remove(row);
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<UserPermissionsResponse>.Ok(await BuildResponseAsync(user)));
    }

    private async Task<UserPermissionsResponse> BuildResponseAsync(User user)
    {
        var breakdown = await _permissionService.GetBreakdownAsync(user.Id);

        return new UserPermissionsResponse
        {
            UserId = user.Id,
            Roles = user.UserRoleUsers
                .Where(ur => ur.Role.IsActive)
                .Select(ur => ur.Role.Name)
                .OrderBy(name => name)
                .ToList(),
            RolePermissions = breakdown.RolePermissions,
            Grants = breakdown.Grants,
            Denies = breakdown.Denies,
            Effective = breakdown.Effective
        };
    }
}
