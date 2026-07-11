using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace DevLearningHub.Api.Controllers.Community;

[ApiController]
[Route("api/mentions")]
[Authorize]
public class MentionsController : ControllerBase
{
    private static readonly Regex MentionPattern = new("(?<![\\w@])@([A-Za-z0-9_.-]{2,50})", RegexOptions.Compiled);
    private readonly DevLearningHubContext _db;
    private readonly INotificationService _notifications;

    public MentionsController(DevLearningHubContext db, INotificationService notifications)
    {
        _db = db;
        _notifications = notifications;
    }

    [HttpGet("users")]
    public async Task<IActionResult> Users([FromQuery] string? query = null)
    {
        var keyword = (query ?? string.Empty).Trim().ToLower();
        if (keyword.Length < 2) return Ok(Array.Empty<object>());
        var users = await _db.Users.AsNoTracking().Where(u => u.IsActive && u.Username.ToLower().Contains(keyword)).OrderBy(u => u.Username).Take(8)
            .Select(u => new { id = u.Id, username = u.Username, fullName = u.FullName }).ToListAsync();
        return Ok(users);
    }

    [HttpPost("parse")]
    public async Task<IActionResult> Parse([FromBody] MentionParseRequest request)
    {
        if (!User.TryGetUserId(out var authorId)) return Unauthorized();
        var names = MentionPattern.Matches(request.Text ?? string.Empty).Select(m => m.Groups[1].Value).Distinct(StringComparer.OrdinalIgnoreCase).Take(20).ToList();
        var users = await _db.Users.Where(u => u.IsActive && names.Contains(u.Username)).ToListAsync();
        var recipients = users.Where(u => u.Id != authorId).ToList();
        return Ok(recipients.Select(u => new { id = u.Id, username = u.Username, fullName = u.FullName }));
    }

    public class MentionParseRequest { public string Text { get; set; } = string.Empty; }
}
