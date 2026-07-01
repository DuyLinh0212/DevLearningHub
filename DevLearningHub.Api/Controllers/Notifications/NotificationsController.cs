using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Notifications;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Notifications;

[ApiController]
[Route("api/notifications")]
[Authorize]
// Notification history for the signed-in user. Realtime delivery is handled by
// NotificationHub; these endpoints let the client load past notifications and
// manage their read state.
public class NotificationsController : ControllerBase
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    private readonly DevLearningHubContext _db;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(DevLearningHubContext db, ILogger<NotificationsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    // List the current user's notifications, newest first, with the unread count.
    public async Task<ActionResult<ApiResponse<NotificationListResponse>>> GetNotifications(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        [FromQuery] bool unreadOnly = false)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<NotificationListResponse>.Fail("Unauthorized."));
        }

        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > MaxPageSize ? DefaultPageSize : pageSize;

        var query = _db.Notifications.AsNoTracking().Where(n => n.UserId == userId);
        if (unreadOnly)
        {
            query = query.Where(n => !n.IsRead);
        }

        var totalCount = await query.CountAsync();
        var unreadCount = await _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new NotificationResponse
            {
                Id = n.Id,
                Type = n.Type,
                Message = n.Message,
                RefId = n.RefId,
                RefType = n.RefType,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync();

        try
        {
            await EnrichReportNotificationsAsync(items, userId);
        }
        catch (Exception ex)
        {
            // Enrichment must never break the notifications list.
            _logger.LogWarning(ex, "Failed to enrich report notifications for user {UserId}.", userId);
        }

        var result = new NotificationListResponse
        {
            Items = items,
            TotalCount = totalCount,
            UnreadCount = unreadCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        };

        return Ok(ApiResponse<NotificationListResponse>.Ok(result));
    }

    private async Task EnrichReportNotificationsAsync(List<NotificationResponse> items, Guid userId)
    {
        var reportNotifications = items
            .Where(n => n.Type == NotificationTypes.ContentReported && n.RefId.HasValue)
            .ToList();

        if (reportNotifications.Count == 0)
        {
            return;
        }

        var reportIds = reportNotifications
            .Where(n => n.RefType == NotificationRefTypes.Report)
            .Select(n => n.RefId!.Value)
            .ToHashSet();

        var targetIds = reportNotifications
            .Where(n => n.RefType != NotificationRefTypes.Report)
            .Select(n => n.RefId!.Value)
            .ToHashSet();

        var reportDetails = await _db.Reports
            .AsNoTracking()
            .Include(r => r.Reporter)
            .Include(r => r.ReportType)
            .Where(r =>
                reportIds.Contains(r.Id) ||
                (targetIds.Contains(r.TargetId) && r.RecipientId == userId))
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id,
                r.TargetId,
                TypeName = r.ReportType.Name,
                r.Description,
                ReporterName = r.Reporter.FullName ?? r.Reporter.Username
            })
            .ToListAsync();

        foreach (var notification in reportNotifications)
        {
            var report = notification.RefType == NotificationRefTypes.Report
                ? reportDetails.FirstOrDefault(r => r.Id == notification.RefId)
                : reportDetails.FirstOrDefault(r =>
                    r.TargetId == notification.RefId &&
                    ReportTypeMatchesNotificationRef(r.TypeName, notification.RefType));

            if (report == null)
            {
                continue;
            }

            notification.ReporterName = report.ReporterName;
            notification.ReportDescription = report.Description;
        }
    }

    private static bool ReportTypeMatchesNotificationRef(string typeName, string? refType)
    {
        return (typeName, refType) switch
        {
            ("problem", NotificationRefTypes.Problem) => true,
            ("quiz_question", NotificationRefTypes.Question) => true,
            ("post", NotificationRefTypes.Post) => true,
            ("comment", NotificationRefTypes.Comment) => true,
            _ => false
        };
    }

    [HttpGet("unread-count")]
    // Lightweight endpoint to seed the bell badge on page load.
    public async Task<ActionResult<ApiResponse<object>>> GetUnreadCount()
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var unreadCount = await _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);
        return Ok(ApiResponse<object>.Ok(new { unreadCount }));
    }

    [HttpPost("{id:guid}/read")]
    // Mark a single notification as read.
    public async Task<ActionResult<ApiResponse<object>>> MarkAsRead(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var notification = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (notification == null)
        {
            return NotFound(ApiResponse<object>.Fail("Notification not found."));
        }

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            await _db.SaveChangesAsync();
        }

        var unreadCount = await _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);
        return Ok(ApiResponse<object>.Ok(new { id = notification.Id, isRead = true, unreadCount }));
    }

    [HttpPost("read-all")]
    // Mark every unread notification of the current user as read.
    public async Task<ActionResult<ApiResponse<object>>> MarkAllAsRead()
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var unread = await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var n in unread)
        {
            n.IsRead = true;
        }

        if (unread.Count > 0)
        {
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<object>.Ok(new { updated = unread.Count, unreadCount = 0 }));
    }

    [HttpDelete("clear-all")]
    // Remove every notification from the current user's list.
    public async Task<ActionResult<ApiResponse<object>>> ClearAll()
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var notifications = await _db.Notifications
            .Where(n => n.UserId == userId)
            .ToListAsync();

        if (notifications.Count > 0)
        {
            _db.Notifications.RemoveRange(notifications);
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<object>.Ok(new { deleted = notifications.Count, unreadCount = 0 }));
    }

    [HttpDelete("{id:guid}")]
    // Remove a notification from the current user's list.
    public async Task<ActionResult<ApiResponse<object>>> DeleteNotification(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var notification = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (notification == null)
        {
            return NotFound(ApiResponse<object>.Fail("Notification not found."));
        }

        _db.Notifications.Remove(notification);
        await _db.SaveChangesAsync();

        var unreadCount = await _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);
        return Ok(ApiResponse<object>.Ok(new { deleted = true, unreadCount }));
    }
}
