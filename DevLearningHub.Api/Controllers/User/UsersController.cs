using DevLearningHub.Api.Dtos.Auth;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Users;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly DevLearningHubContext _db;
    private readonly IPermissionService _permissionService;

    public UsersController(DevLearningHubContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    /// <summary>
    /// Get the profile of the currently authenticated user.
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponse>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponse>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserProfileResponse>>> GetMe()
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<UserProfileResponse>.Fail("Unauthorized."));
        }

        var user = await _db.Users
            .Include(u => u.UserRoleUsers)
            .ThenInclude(ur => ur.Role)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return NotFound(ApiResponse<UserProfileResponse>.Fail("User not found."));
        }

        var profile = MapProfile(user);
        profile.Roles = user.UserRoleUsers
            .Where(ur => ur.Role.IsActive)
            .Select(ur => ur.Role.Name)
            .OrderBy(name => name)
            .ToList();
        profile.Permissions = (await _permissionService.GetEffectivePermissionsAsync(userId))
            .OrderBy(name => name)
            .ToList();

        return Ok(ApiResponse<UserProfileResponse>.Ok(profile));
    }

    /// <summary>
    /// Update editable profile fields for the currently authenticated user.
    /// </summary>
    [HttpPut("me")]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponse>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponse>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponse>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserProfileResponse>>> UpdateMe([FromBody] UpdateProfileRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<UserProfileResponse>.Fail("Unauthorized."));
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return NotFound(ApiResponse<UserProfileResponse>.Fail("User not found."));
        }

        user.FullName = string.IsNullOrWhiteSpace(request.FullName) ? null : request.FullName.Trim();
        user.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<UserProfileResponse>.Ok(MapProfile(user), "Profile updated."));
    }

    /// <summary>
    /// Upload and save the current user's avatar using Cloudinary.
    /// </summary>
    [HttpPost("me/avatar")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponse>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponse>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponse>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserProfileResponse>>> UploadAvatar(
        IFormFile? file,
        [FromServices] CloudinaryService cloudinaryService)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<UserProfileResponse>.Fail("Unauthorized."));
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(ApiResponse<UserProfileResponse>.Fail("Please choose an image file."));
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return NotFound(ApiResponse<UserProfileResponse>.Fail("User not found."));
        }

        try
        {
            var uploadResult = await cloudinaryService.UploadAvatarAsync(userId, file);
            user.AvatarUrl = uploadResult.Url;
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<UserProfileResponse>.Fail(ex.Message));
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<UserProfileResponse>.Ok(MapProfile(user), "Avatar updated."));
    }

    /// <summary>
    /// Get learning statistics for a user.
    /// </summary>
    [HttpGet("{id:guid}/stats")]
    [ProducesResponseType(typeof(ApiResponse<UserStatsResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<UserStatsResponse>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserStatsResponse>>> GetStats(Guid id)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
        {
            return NotFound(ApiResponse<UserStatsResponse>.Fail("User not found."));
        }

        var completedSessions = _db.QuizSessions
            .AsNoTracking()
            .Where(s => s.UserId == id && s.Status == "completed");

        var totalQuizTaken = await completedSessions.CountAsync();
        var scoreRows = await completedSessions
            .Where(s => s.Score.HasValue && s.TotalQuestions > 0)
            .Select(s => new { Score = s.Score!.Value, s.TotalQuestions })
            .ToListAsync();

        var userXp = scoreRows.Sum(session => CalculateXp(session.Score));
        var userXpRows = await _db.Users
            .AsNoTracking()
            .Where(u => u.IsActive)
            .Select(u => new
            {
                u.Id,
                Xp = _db.QuizSessions
                    .Where(s => s.UserId == u.Id && s.Status == "completed" && s.Score.HasValue)
                    .Sum(s => (int?)s.Score!.Value) ?? 0
            })
            .ToListAsync();
        var rank = userXpRows.Count(row => CalculateXp(row.Xp) > userXp) + 1;
        var avgScore = scoreRows.Count == 0
            ? 0
            : scoreRows.Average(s => (double)s.Score / s.TotalQuestions);

        var stats = new UserStatsResponse
        {
            UserId = user.Id,
            TotalQuizTaken = totalQuizTaken,
            TotalXP = userXp,
            AvgScore = Math.Round(avgScore, 4),
            Rank = rank
        };

        return Ok(ApiResponse<UserStatsResponse>.Ok(stats));
    }

    /// <summary>
    /// Get the XP leaderboard.
    /// </summary>
    [HttpGet("leaderboard")]
    [ProducesResponseType(typeof(ApiResponse<List<LeaderboardEntryResponse>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<LeaderboardEntryResponse>>>> GetLeaderboard([FromQuery] int top = 20)
    {
        top = Math.Clamp(top, 1, 100);

        var users = await _db.Users
            .AsNoTracking()
            .Where(u => u.IsActive)
            .OrderBy(u => u.Username)
            .ToListAsync();

        var userIds = users.Select(user => user.Id).ToList();
        var completedScores = await _db.QuizSessions
            .AsNoTracking()
            .Where(session => userIds.Contains(session.UserId) && session.Status == "completed" && session.Score.HasValue)
            .GroupBy(session => session.UserId)
            .Select(group => new
            {
                UserId = group.Key,
                Score = group.Sum(session => session.Score!.Value)
            })
            .ToDictionaryAsync(row => row.UserId, row => row.Score);

        var entries = users
            .Select(user => new
            {
                User = user,
                XP = CalculateXp(completedScores.GetValueOrDefault(user.Id))
            })
            .OrderByDescending(row => row.XP)
            .ThenBy(row => row.User.Username)
            .Take(top)
            .Select((row, index) => new LeaderboardEntryResponse
            {
                Rank = index + 1,
                UserId = row.User.Id,
                Username = row.User.Username,
                FullName = row.User.FullName ?? row.User.Username,
                AvatarUrl = row.User.AvatarUrl,
                XP = row.XP
            })
            .ToList();

        return Ok(ApiResponse<List<LeaderboardEntryResponse>>.Ok(entries));
    }

    private static UserProfileResponse MapProfile(User user)
    {
        return new UserProfileResponse
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            FullName = user.FullName,
            AvatarUrl = user.AvatarUrl,
            XpPoints = user.XpPoints
        };
    }

    private static int CalculateXp(int correctAnswers)
    {
        return correctAnswers * 50;
    }
}

public class UpdateProfileRequest
{
    public string? FullName { get; set; }

    public string? AvatarUrl { get; set; }
}

public class UserStatsResponse
{
    public Guid UserId { get; set; }

    public int TotalQuizTaken { get; set; }

    public int TotalXP { get; set; }

    public double AvgScore { get; set; }

    public int Rank { get; set; }
}

public class LeaderboardEntryResponse
{
    public int Rank { get; set; }

    public Guid UserId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string? AvatarUrl { get; set; }

    public int XP { get; set; }
}
