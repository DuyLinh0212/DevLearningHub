using DevLearningHub.Api.Dtos.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DevLearningHub.Api.Hubs;

// Strongly-typed client contract for per-user realtime notifications.
// Each method name is the event the Angular client subscribes to.
public interface INotificationClient
{
    // Pushed whenever a new notification is created for the connected user.
    Task ReceiveNotification(NotificationResponse notification);

    // Pushed with the current unread count so the bell badge stays in sync.
    Task UnreadCountChanged(int unreadCount);

    // Pushed whenever a moderation queue item changes state (created/approved/rejected),
    // so open moderation queue views can refresh instantly instead of waiting on their poll.
    Task ModerationQueueChanged(string type);
}

// Realtime hub for user notifications (replies, moderation deletes, ...).
// Unlike CommentHub, this hub requires authentication: notifications are
// private and routed to a single user via Clients.User(userId).
//
// SignalR's default IUserIdProvider reads ClaimTypes.NameIdentifier, which the
// JWT already carries (see TokenService), so Clients.User(userId.ToString())
// reaches every active connection of that user with no extra wiring.
[Authorize]
public class NotificationHub : Hub<INotificationClient>
{
}
