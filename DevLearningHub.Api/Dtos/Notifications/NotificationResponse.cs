using System;

namespace DevLearningHub.Api.Dtos.Notifications;

// Shape sent to the client over both REST (history) and SignalR (realtime push).
public class NotificationResponse
{
    public Guid Id { get; set; }

    // Machine-readable category, e.g. "comment_reply", "post_deleted".
    public string Type { get; set; } = null!;

    // Human-readable message shown in the bell dropdown.
    public string Message { get; set; } = null!;

    // Optional id of the related entity used by the client to navigate.
    public Guid? RefId { get; set; }

    // Optional kind of the related entity, e.g. "post", "quiz_set", "problem".
    public string? RefType { get; set; }

    public bool IsRead { get; set; }

    public DateTime CreatedAt { get; set; }

    public string? ReporterName { get; set; }

    public string? ReportDescription { get; set; }
}

// Paged list of notifications plus the live unread count for the bell badge.
public class NotificationListResponse
{
    public List<NotificationResponse> Items { get; set; } = new();

    public int TotalCount { get; set; }

    public int UnreadCount { get; set; }

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int TotalPages { get; set; }
}
