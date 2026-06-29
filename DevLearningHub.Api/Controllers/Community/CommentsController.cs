using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Community;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Hubs;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Community;

[ApiController]
[Route("api/comments")]
// Comment-scoped actions: edit, delete, vote, accept best answer and moderation.
public class CommentsController : ControllerBase
{
    private readonly DevLearningHubContext _db;
    private readonly IHubContext<CommentHub, ICommentHubClient> _commentHub;
    private readonly IPermissionService _permissions;
    private readonly INotificationService _notifications;

    public CommentsController(
        DevLearningHubContext db,
        IHubContext<CommentHub, ICommentHubClient> commentHub,
        IPermissionService permissions,
        INotificationService notifications)
    {
        _db = db;
        _commentHub = commentHub;
        _permissions = permissions;
        _notifications = notifications;
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    // Update a comment. Only the author may edit.
    public async Task<ActionResult<ApiResponse<CommentResponse>>> UpdateComment(Guid id, UpdateCommentRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<CommentResponse>.Fail("Unauthorized."));
        }

        var comment = await _db.Comments
            .Include(c => c.Author)
                .ThenInclude(a => a.UserRoleUsers)
                    .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (comment == null)
        {
            return NotFound(ApiResponse<CommentResponse>.Fail("Comment not found."));
        }

        if (comment.AuthorId != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<CommentResponse>.Fail("Forbidden."));
        }

        var body = request.BodyMarkdown.Trim();
        if (string.IsNullOrWhiteSpace(body))
        {
            return BadRequest(ApiResponse<CommentResponse>.Fail("Comment body is required."));
        }

        comment.BodyMarkdown = body;
        comment.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();

        var response = MapComment(comment, comment.Author);

        // Push the edited body to everyone viewing this post.
        await _commentHub.Clients.Group(CommentHub.PostGroup(comment.PostId)).CommentUpdated(response);

        return Ok(ApiResponse<CommentResponse>.Ok(response));
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    // Delete a comment and its replies. Author can delete own; Moderator/Admin can delete any.
    public async Task<ActionResult<ApiResponse<object>>> DeleteComment(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var comment = await _db.Comments.FirstOrDefaultAsync(c => c.Id == id);
        if (comment == null)
        {
            return NotFound(ApiResponse<object>.Fail("Comment not found."));
        }

        // Author can delete own; anyone with the comment:delete permission (Moderator/Admin
        // via role, or a per-user grant) can delete any comment.
        if (comment.AuthorId != userId && !await _permissions.HasPermissionAsync(userId, "comment:delete"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        // Collect this comment and all nested replies in the same post.
        var postComments = await _db.Comments
            .Where(c => c.PostId == comment.PostId)
            .ToListAsync();

        var toDelete = CollectSubtree(comment.Id, postComments);
        var deleteIds = toDelete.Select(c => c.Id).ToList();

        // Clear the accepted-answer pointer if it targets a deleted comment.
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == comment.PostId);
        if (post != null && post.AcceptedCommentId.HasValue && deleteIds.Contains(post.AcceptedCommentId.Value))
        {
            post.AcceptedCommentId = null;
            await _db.SaveChangesAsync();
        }

        var votes = await _db.Votes
            .Where(v => v.TargetType == CommunityVotes.CommentTarget && deleteIds.Contains(v.TargetId))
            .ToListAsync();
        _db.Votes.RemoveRange(votes);

        _db.Comments.RemoveRange(toDelete);
        await _db.SaveChangesAsync();

        // Tell viewers which comments (root + nested replies) to prune.
        await _commentHub.Clients.Group(CommentHub.PostGroup(comment.PostId)).CommentDeleted(new CommentDeletedEvent
        {
            PostId = comment.PostId,
            CommentId = comment.Id,
            DeletedIds = deleteIds
        });

        // Notify the comment author it was removed (skipped if they deleted it themselves).
        await _notifications.NotifyAsync(
            recipientId: comment.AuthorId,
            type: NotificationTypes.CommentDeleted,
            message: "Một bình luận của bạn đã bị xóa bởi quản trị viên.",
            refId: comment.PostId,
            refType: NotificationRefTypes.Post,
            actorId: userId);

        return Ok(ApiResponse<object>.Ok(new { deleted = true, count = deleteIds.Count }));
    }

    [HttpPost("{id:guid}/vote")]
    [Authorize]
    // Upvote or downvote a comment (toggles on repeat).
    public async Task<ActionResult<ApiResponse<VoteResultResponse>>> VoteComment(Guid id, VoteRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<VoteResultResponse>.Fail("Unauthorized."));
        }

        var voteType = request.VoteType?.Trim().ToLower();
        if (!CommunityVotes.IsValidVoteType(voteType))
        {
            return BadRequest(ApiResponse<VoteResultResponse>.Fail("voteType must be 'up' or 'down'."));
        }

        var comment = await _db.Comments.FirstOrDefaultAsync(c => c.Id == id && !c.IsHidden);
        if (comment == null)
        {
            return NotFound(ApiResponse<VoteResultResponse>.Fail("Comment not found."));
        }

        var result = await CommunityVotes.ApplyAsync(_db, userId, CommunityVotes.CommentTarget, comment.Id, voteType!);

        comment.Upvotes = result.Upvotes;
        comment.Downvotes = result.Downvotes;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<VoteResultResponse>.Ok(result));
    }

    [HttpPost("{id:guid}/accept")]
    [Authorize]
    // Mark a comment as the best answer. Only the post author may accept (toggles).
    public async Task<ActionResult<ApiResponse<object>>> AcceptComment(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var comment = await _db.Comments.FirstOrDefaultAsync(c => c.Id == id && !c.IsHidden);
        if (comment == null)
        {
            return NotFound(ApiResponse<object>.Fail("Comment not found."));
        }

        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == comment.PostId);
        if (post == null)
        {
            return NotFound(ApiResponse<object>.Fail("Post not found."));
        }

        if (post.AuthorId != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Only the post author can accept an answer."));
        }

        var accepted = post.AcceptedCommentId != comment.Id;

        // Clear any previously accepted comment on this post.
        if (post.AcceptedCommentId.HasValue)
        {
            var previous = await _db.Comments.FirstOrDefaultAsync(c => c.Id == post.AcceptedCommentId.Value);
            if (previous != null)
            {
                previous.IsAccepted = false;
            }
        }

        if (accepted)
        {
            comment.IsAccepted = true;
            post.AcceptedCommentId = comment.Id;
        }
        else
        {
            comment.IsAccepted = false;
            post.AcceptedCommentId = null;
        }

        post.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { commentId = comment.Id, isAccepted = accepted }));
    }

    [HttpPost("{id:guid}/moderate")]
    [Authorize]
    // Hide or unhide a comment and record a moderation log entry. Requires the comment:hide permission.
    public async Task<ActionResult<ApiResponse<object>>> ModerateComment(Guid id, ModerateRequest request)
    {
        if (!User.TryGetUserId(out var moderatorId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        if (!await _permissions.HasPermissionAsync(moderatorId, "comment:hide"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        var comment = await _db.Comments.FirstOrDefaultAsync(c => c.Id == id);
        if (comment == null)
        {
            return NotFound(ApiResponse<object>.Fail("Comment not found."));
        }

        comment.IsHidden = request.Hidden;
        comment.UpdatedAt = DateTime.Now;

        // A hidden comment cannot remain the accepted answer.
        if (request.Hidden && comment.IsAccepted)
        {
            comment.IsAccepted = false;
            var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == comment.PostId);
            if (post != null && post.AcceptedCommentId == comment.Id)
            {
                post.AcceptedCommentId = null;
            }
        }

        // Constraint accepts: 'hide', 'delete', 'restore'
        // Use 'hide' when hiding, 'restore' when showing
        var actionValue = request.Hidden ? "hide" : "restore";
        Console.Error.WriteLine($"ModerateComment: Using actionValue={actionValue}, Hidden={request.Hidden}");

        _db.ModerationLogs.Add(new ModerationLog
        {
            Id = Guid.NewGuid(),
            ModeratorId = moderatorId,
            TargetType = CommunityVotes.CommentTarget,
            TargetId = comment.Id,
            Action = actionValue,
            Reason = request.Reason?.Trim(),
            CreatedAt = DateTime.Now
        });

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { id = comment.Id, isHidden = comment.IsHidden }));
    }

    // ----- Helpers -----

    // Gather a comment and all of its nested replies from a flat post comment list.
    private static List<Comment> CollectSubtree(Guid rootId, List<Comment> all)
    {
        var byParent = all
            .Where(c => c.ParentId.HasValue)
            .GroupBy(c => c.ParentId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = new List<Comment>();
        var stack = new Stack<Guid>();
        stack.Push(rootId);

        while (stack.Count > 0)
        {
            var currentId = stack.Pop();
            var current = all.FirstOrDefault(c => c.Id == currentId);
            if (current == null)
            {
                continue;
            }

            result.Add(current);

            if (byParent.TryGetValue(currentId, out var children))
            {
                foreach (var child in children)
                {
                    stack.Push(child.Id);
                }
            }
        }

        return result;
    }

    private static CommentResponse MapComment(Comment comment, User author)
    {
        return new CommentResponse
        {
            Id = comment.Id,
            PostId = comment.PostId,
            ParentId = comment.ParentId,
            Author = new AuthorSummary
            {
                Id = author.Id,
                Username = author.Username,
                FullName = author.FullName,
                AvatarUrl = author.AvatarUrl,
                Roles = (author.UserRoleUsers ?? [])
                    .Where(ur => ur.Role?.IsActive == true)
                    .Select(ur => ur.Role.Name)
                    .ToList()
            },
            BodyMarkdown = comment.BodyMarkdown,
            Upvotes = comment.Upvotes,
            Downvotes = comment.Downvotes,
            IsAccepted = comment.IsAccepted,
            IsHidden = comment.IsHidden,
            CreatedAt = comment.CreatedAt,
            UpdatedAt = comment.UpdatedAt
        };
    }
}
