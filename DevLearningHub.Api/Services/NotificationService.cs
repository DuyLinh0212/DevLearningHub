using DevLearningHub.Api.Dtos.Notifications;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Services;

// Well-known notification type/ref values. The `type` and `ref_type` columns are
// nvarchar(20), so every constant here must stay within 20 characters.
public static class NotificationTypes
{
    public const string CommentReply = "comment_reply";
    public const string PostDeleted = "post_deleted";
    public const string CommentDeleted = "comment_deleted";
    public const string QuizDeleted = "quiz_deleted";
    public const string ProblemDeleted = "problem_deleted";
}

public static class NotificationRefTypes
{
    public const string Post = "post";
    public const string Comment = "comment";
    public const string QuizSet = "quiz_set";
    public const string Problem = "problem";
}

// Creates a notification: persists it (so offline users still see it later) and
// pushes it in realtime to every active connection of the recipient.
public interface INotificationService
{
    /// <summary>
    /// Notify <paramref name="recipientId"/>. When <paramref name="actorId"/> equals the
    /// recipient the call is skipped — users are never notified about their own actions.
    /// Best-effort: a failure here never breaks the user-facing request.
    /// </summary>
    Task NotifyAsync(
        Guid recipientId,
        string type,
        string message,
        Guid? refId = null,
        string? refType = null,
        Guid? actorId = null);
}

public sealed class NotificationService : INotificationService
{
    // notifications.type and notifications.ref_type are nvarchar(20).
    private const int TypeMaxLength = 20;
    private const int RefTypeMaxLength = 20;

    private readonly DevLearningHubContext _db;
    private readonly IHubContext<NotificationHub, INotificationClient> _hub;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        DevLearningHubContext db,
        IHubContext<NotificationHub, INotificationClient> hub,
        ILogger<NotificationService> logger)
    {
        _db = db;
        _hub = hub;
        _logger = logger;
    }

    public async Task NotifyAsync(
        Guid recipientId,
        string type,
        string message,
        Guid? refId = null,
        string? refType = null,
        Guid? actorId = null)
    {
        if (recipientId == Guid.Empty)
        {
            return;
        }

        // Don't notify a user about their own action (e.g. deleting their own post).
        if (actorId.HasValue && actorId.Value == recipientId)
        {
            return;
        }

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = recipientId,
            Type = Truncate(type, TypeMaxLength) ?? string.Empty,
            Message = message ?? string.Empty,
            RefId = refId,
            RefType = Truncate(refType, RefTypeMaxLength),
            IsRead = false,
            CreatedAt = DateTime.Now
        };

        try
        {
            _db.Notifications.Add(notification);
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Persistence failure must not break the main operation.
            _logger.LogError(ex, "Failed to persist notification {Type} for user {UserId}.", type, recipientId);
            return;
        }

        var payload = new NotificationResponse
        {
            Id = notification.Id,
            Type = notification.Type,
            Message = notification.Message,
            RefId = notification.RefId,
            RefType = notification.RefType,
            IsRead = notification.IsRead,
            CreatedAt = notification.CreatedAt
        };

        try
        {
            var userKey = recipientId.ToString();
            await _hub.Clients.User(userKey).ReceiveNotification(payload);

            // Keep the bell badge in sync without an extra round-trip from the client.
            var unread = await _db.Notifications.CountAsync(n => n.UserId == recipientId && !n.IsRead);
            await _hub.Clients.User(userKey).UnreadCountChanged(unread);
        }
        catch (Exception ex)
        {
            // The row is saved; only the realtime push failed. The client will still
            // pick it up on next fetch, so we swallow the error.
            _logger.LogWarning(ex, "Failed to push realtime notification {Id} to user {UserId}.", notification.Id, recipientId);
        }
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return value;
        }

        return value[..maxLength];
    }
}
