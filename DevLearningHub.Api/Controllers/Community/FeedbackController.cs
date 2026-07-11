using DevLearningHub.Api.Dtos.Community;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Community;

[ApiController]
[Route("api/feedback")]
[Authorize]
public class FeedbackController : ControllerBase
{
    private static readonly string[] Statuses = ["open", "in_progress", "resolved", "closed"];
    private readonly DevLearningHubContext _db;
    private readonly INotificationService _notifications;
    private readonly IAuditService _audit;

    public FeedbackController(DevLearningHubContext db, INotificationService notifications, IAuditService audit)
    {
        _db = db;
        _notifications = notifications;
        _audit = audit;
    }

    [HttpPost]
    public async Task<ActionResult<FeedbackResponse>> Create(CreateFeedbackRequest request)
    {
        if (!User.TryGetUserId(out var authorId)) return Unauthorized();
        var item = new FeedbackRequest
        {
            Id = Guid.NewGuid(), AuthorId = authorId, Subject = request.Subject.Trim(), Body = request.Body.Trim(),
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        _db.FeedbackRequests.Add(item);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("feedback.create", "feedback", item.Id, item.Subject);
        var adminIds = await _db.UserRoles.Where(ur => ur.Role.Name == "Admin" || ur.Role.Name == "Moderator").Select(ur => ur.UserId).Distinct().ToListAsync();
        foreach (var adminId in adminIds)
            await _notifications.NotifyAsync(adminId, "feedback_new", $"Yêu cầu mới: {item.Subject}", item.Id, "feedback", authorId);
        return Ok(await Map(item));
    }

    [HttpGet("mine")]
    public async Task<ActionResult<List<FeedbackResponse>>> Mine()
    {
        if (!User.TryGetUserId(out var userId)) return Unauthorized();
        return Ok(await _db.FeedbackRequests.Include(x => x.Author).Where(x => x.AuthorId == userId).OrderByDescending(x => x.CreatedAt).Select(MapExpression).ToListAsync());
    }

    [HttpGet("admin")]
    public async Task<ActionResult<List<FeedbackResponse>>> Admin([FromQuery] string? status = null)
    {
        if (!IsStaff()) return Forbid();
        var query = _db.FeedbackRequests.Include(x => x.Author).AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        return Ok(await query.OrderByDescending(x => x.CreatedAt).Select(MapExpression).ToListAsync());
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<FeedbackResponse>> Update(Guid id, UpdateFeedbackRequest request)
    {
        if (!IsStaff()) return Forbid();
        if (!Statuses.Contains(request.Status)) return BadRequest("Invalid status.");
        var item = await _db.FeedbackRequests.Include(x => x.Author).FirstOrDefaultAsync(x => x.Id == id);
        if (item == null) return NotFound();
        User.TryGetUserId(out var actorId);
        item.Status = request.Status; item.AdminResponse = request.AdminResponse?.Trim(); item.RespondedBy = actorId; item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("feedback.update", "feedback", id, $"status={item.Status}");
        await _notifications.NotifyAsync(item.AuthorId, "feedback_update", $"Yêu cầu '{item.Subject}' đã cập nhật: {item.Status}.", item.Id, "feedback", actorId);
        return Ok(await Map(item));
    }

    private bool IsStaff() => User.IsInRole("Admin") || User.IsInRole("Moderator") || User.HasPermission("system.full_control");
    private async Task<FeedbackResponse> Map(FeedbackRequest item) => await _db.FeedbackRequests.Include(x => x.Author).Where(x => x.Id == item.Id).Select(MapExpression).FirstAsync();
    private static readonly System.Linq.Expressions.Expression<Func<FeedbackRequest, FeedbackResponse>> MapExpression = x => new FeedbackResponse
    {
        Id = x.Id, AuthorId = x.AuthorId, AuthorUsername = x.Author.Username, Subject = x.Subject, Body = x.Body,
        Status = x.Status, AdminResponse = x.AdminResponse, CreatedAt = x.CreatedAt, UpdatedAt = x.UpdatedAt
    };
}
