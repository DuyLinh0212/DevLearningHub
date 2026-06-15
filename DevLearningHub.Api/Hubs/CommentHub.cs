using DevLearningHub.Api.Dtos.Community;
using Microsoft.AspNetCore.SignalR;

namespace DevLearningHub.Api.Hubs;

// Strongly-typed client contract for comment realtime events.
// Each method name is the event the Angular client subscribes to.
public interface ICommentHubClient
{
    Task CommentCreated(CommentResponse comment);

    Task CommentUpdated(CommentResponse comment);

    Task CommentDeleted(CommentDeletedEvent payload);
}

// Realtime hub for forum comments only (create/edit/delete).
// Reading comments is public, so the hub allows anonymous connections;
// the actual mutations still go through the authenticated REST endpoints.
public class CommentHub : Hub<ICommentHubClient>
{
    // Clients join/leave a per-post group so broadcasts reach only the
    // users currently viewing that post.
    public Task JoinPost(string postId)
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, PostGroup(postId));
    }

    public Task LeavePost(string postId)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, PostGroup(postId));
    }

    // Group name shared with the controllers that broadcast events.
    public static string PostGroup(string postId) => $"post-{postId}";

    public static string PostGroup(Guid postId) => PostGroup(postId.ToString());
}
