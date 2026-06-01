using API_DEVLEARNINGHUB.Dtos.Common;
using API_DEVLEARNINGHUB.Entities;
using API_DEVLEARNINGHUB.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API_DEVLEARNINGHUB.Controllers.Users;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class AdminUsersController : ControllerBase
{
    private readonly DevLearningHubContext _db;

    public AdminUsersController(DevLearningHubContext db)
    {
        _db = db;
    }

    /// <summary>
    /// List users with paging, optional search, and assigned roles.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AdminUserResponse>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<AdminUserResponse>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Users
            .Include(u => u.UserRoleUsers)
            .ThenInclude(ur => ur.Role)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLowerInvariant();
            query = query.Where(u =>
                u.Username.ToLower().Contains(keyword) ||
                u.Email.ToLower().Contains(keyword) ||
                (u.FullName != null && u.FullName.ToLower().Contains(keyword)));
        }

        var totalCount = await query.CountAsync();
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var result = new PagedResult<AdminUserResponse>
        {
            Items = users.Select(MapAdminUser).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };

        return Ok(ApiResponse<PagedResult<AdminUserResponse>>.Ok(result));
    }

    /// <summary>
    /// Get detailed account information for one user.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdminUserDetailResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<AdminUserDetailResponse>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<AdminUserDetailResponse>>> GetById(Guid id)
    {
        var user = await _db.Users
            .Include(u => u.UserRoleUsers)
            .ThenInclude(ur => ur.Role)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
        {
            return NotFound(ApiResponse<AdminUserDetailResponse>.Fail("User not found."));
        }

        var completedSessions = await _db.QuizSessions
            .AsNoTracking()
            .Where(s => s.UserId == id && s.Status == "completed")
            .CountAsync();

        var detail = new AdminUserDetailResponse
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            FullName = user.FullName,
            AvatarUrl = user.AvatarUrl,
            XpPoints = user.XpPoints,
            IsActive = user.IsActive,
            IsLocked = user.IsLocked,
            LockedReason = user.LockedReason,
            LockedAt = user.LockedAt,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            Roles = GetRoleNames(user),
            CompletedQuizCount = completedSessions
        };

        return Ok(ApiResponse<AdminUserDetailResponse>.Ok(detail));
    }

    /// <summary>
    /// Lock an account and prevent login.
    /// </summary>
    [HttpPatch("{id:guid}/lock")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<object>>> Lock(Guid id, [FromBody] LockUserRequest? request)
    {
        if (User.TryGetUserId(out var adminId) && adminId == id)
        {
            return BadRequest(ApiResponse<object>.Fail("You cannot lock your own account."));
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
        {
            return NotFound(ApiResponse<object>.Fail("User not found."));
        }

        user.IsLocked = true;
        user.LockedAt = DateTime.UtcNow;
        user.LockedReason = string.IsNullOrWhiteSpace(request?.Reason) ? "Locked by admin." : request.Reason.Trim();
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { locked = true }, "User locked."));
    }

    /// <summary>
    /// Unlock an account and allow login again.
    /// </summary>
    [HttpPatch("{id:guid}/unlock")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<object>>> Unlock(Guid id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
        {
            return NotFound(ApiResponse<object>.Fail("User not found."));
        }

        user.IsLocked = false;
        user.LockedAt = null;
        user.LockedReason = null;
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { locked = false }, "User unlocked."));
    }

    /// <summary>
    /// Replace the current user roles with a single active role.
    /// </summary>
    [HttpPut("{id:guid}/role")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<object>>> ChangeRole(Guid id, [FromBody] ChangeRoleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Role))
        {
            return BadRequest(ApiResponse<object>.Fail("Role is required."));
        }

        if (User.TryGetUserId(out var adminId) && adminId == id)
        {
            return BadRequest(ApiResponse<object>.Fail("You cannot change your own role."));
        }

        var userExists = await _db.Users.AnyAsync(u => u.Id == id);
        if (!userExists)
        {
            return NotFound(ApiResponse<object>.Fail("User not found."));
        }

        var roleName = request.Role.Trim();
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.IsActive && r.Name == roleName);
        if (role == null)
        {
            return BadRequest(ApiResponse<object>.Fail("Role not found or inactive."));
        }

        // The plan models one role change operation, so replace existing roles atomically.
        var currentRoles = await _db.UserRoles.Where(ur => ur.UserId == id).ToListAsync();
        _db.UserRoles.RemoveRange(currentRoles);
        _db.UserRoles.Add(new UserRole
        {
            UserId = id,
            RoleId = role.Id,
            AssignedAt = DateTime.UtcNow,
            AssignedBy = adminId == Guid.Empty ? null : adminId
        });

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { role = role.Name }, "Role updated."));
    }

    private static AdminUserResponse MapAdminUser(User user)
    {
        return new AdminUserResponse
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            FullName = user.FullName,
            AvatarUrl = user.AvatarUrl,
            XpPoints = user.XpPoints,
            IsActive = user.IsActive,
            IsLocked = user.IsLocked,
            CreatedAt = user.CreatedAt,
            Roles = GetRoleNames(user)
        };
    }

    private static List<string> GetRoleNames(User user)
    {
        return user.UserRoleUsers
            .Where(ur => ur.Role.IsActive)
            .Select(ur => ur.Role.Name)
            .OrderBy(name => name)
            .ToList();
    }
}

public class ChangeRoleRequest
{
    /// <summary>
    /// Name of an active role, for example Admin, Student, or Instructor.
    /// </summary>
    public string Role { get; set; } = string.Empty;
}

public class LockUserRequest
{
    public string? Reason { get; set; }
}

public class AdminUserResponse
{
    public Guid Id { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string? FullName { get; set; }

    public string? AvatarUrl { get; set; }

    public int XpPoints { get; set; }

    public bool IsActive { get; set; }

    public bool IsLocked { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<string> Roles { get; set; } = new();
}

public class AdminUserDetailResponse : AdminUserResponse
{
    public string? LockedReason { get; set; }

    public DateTime? LockedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int CompletedQuizCount { get; set; }
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();

    public int TotalCount { get; set; }

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling((double)TotalCount / PageSize);
}
