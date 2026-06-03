using DevLearningHub.Api.Dtos.Auth;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
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

    public UsersController(DevLearningHubContext db)
    {
        _db = db;
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

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return NotFound(ApiResponse<UserProfileResponse>.Fail("User not found."));
        }

        return Ok(ApiResponse<UserProfileResponse>.Ok(MapProfile(user)));
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

        // Rank is calculated from the current XP snapshot on users.xp_points.
        var rank = await _db.Users.CountAsync(u => u.XpPoints > user.XpPoints) + 1;
        var avgScore = scoreRows.Count == 0
            ? 0
            : scoreRows.Average(s => (double)s.Score / s.TotalQuestions);

        var stats = new UserStatsResponse
        {
            UserId = user.Id,
            TotalQuizTaken = totalQuizTaken,
            TotalXP = user.XpPoints,
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
            .OrderByDescending(u => u.XpPoints)
            .ThenBy(u => u.Username)
            .Take(top)
            .ToListAsync();

        var entries = users.Select((user, index) => new LeaderboardEntryResponse
        {
            Rank = index + 1,
            UserId = user.Id,
            Username = user.Username,
            FullName = user.FullName ?? user.Username,
            AvatarUrl = user.AvatarUrl,
            XP = user.XpPoints
        }).ToList();

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
