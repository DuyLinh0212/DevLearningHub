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
using System.Text.RegularExpressions;

namespace DevLearningHub.Api.Controllers.Community;

[ApiController]
[Route("api/posts")]
// Forum posts: feed, detail, CRUD, voting, comments and moderation.
public class PostsController : ControllerBase
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    private readonly DevLearningHubContext _db;
    private readonly IHubContext<CommentHub, ICommentHubClient> _commentHub;
    private readonly IHubContext<NotificationHub, INotificationClient> _notificationHub;
    private readonly IPermissionService _permissions;
    private readonly INotificationService _notifications;
    private readonly IAutoApprovalPolicy _autoApproval;

    public PostsController(
        DevLearningHubContext db,
        IHubContext<CommentHub, ICommentHubClient> commentHub,
        IHubContext<NotificationHub, INotificationClient> notificationHub,
        IPermissionService permissions,
        INotificationService notifications,
        IAutoApprovalPolicy autoApproval)
    {
        _db = db;
        _commentHub = commentHub;
        _notificationHub = notificationHub;
        _permissions = permissions;
        _notifications = notifications;
        _autoApproval = autoApproval;
    }

    [HttpGet]
    [AllowAnonymous]
    // List posts with pagination, optional search and tag filter.
    public async Task<ActionResult<ApiResponse<PagedResponse<PostSummaryResponse>>>> GetPosts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        [FromQuery] string? search = null,
        [FromQuery] string? tag = null,
        [FromQuery] Guid? authorId = null)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > MaxPageSize ? DefaultPageSize : pageSize;

        // Users who can hide posts (post:hide_any) also see hidden posts in the list; everyone else only sees visible ones.
        var includeHidden = User.TryGetUserId(out var viewerId)
            && await _permissions.HasPermissionAsync(viewerId, "post:hide_any");
        var canReview = viewerId != Guid.Empty && await _permissions.HasPermissionAsync(viewerId, "post:review");
        var query = _db.Posts.AsNoTracking().Where(p =>
            !p.IsDeleted &&
            (includeHidden || !p.IsHidden) &&
            (includeHidden
                || canReview
                || p.AuthorId == viewerId
                || p.ReviewStatus == "approved"
                || p.ReviewStatus == null
                || p.ReviewStatus == string.Empty));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(p => p.Title.Contains(term) || p.BodyMarkdown.Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(tag))
        {
            var slug = tag.Trim().ToLower();
            query = query.Where(p => p.Tags.Any(t => t.Slug == slug));
        }

        if (authorId.HasValue)
        {
            query = query.Where(p => p.AuthorId == authorId.Value);
        }

        var totalCount = await query.CountAsync();

        var posts = await query
            .Include(p => p.Author)
            .Include(p => p.Tags)
            .Include(p => p.Comments)
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PostSummaryResponse
            {
                Id = p.Id,
                Title = p.Title,
                Author = new AuthorSummary
                {
                    Id = p.Author.Id,
                    Username = p.Author.Username,
                    FullName = p.Author.FullName,
                    AvatarUrl = p.Author.AvatarUrl,
                    Roles = p.Author.UserRoleUsers.Select(ur => ur.Role.Name).ToList()
                },
                Upvotes = p.Upvotes,
                Downvotes = p.Downvotes,
                ViewCount = p.ViewCount,
                CommentCount = p.Comments.Count(c => !c.IsHidden),
                IsHidden = p.IsHidden,
                ReviewStatus = p.ReviewStatus,
                ReviewNote = p.ReviewNote,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                Tags = p.Tags
                    .OrderBy(t => t.Name)
                    .Select(t => new TagResponse
                    {
                        Id = t.Id,
                        Name = t.Name,
                        Slug = t.Slug,
                        ColorHex = t.ColorHex.Trim()
                    })
                    .ToList()
            })
            .ToListAsync();

        var result = new PagedResponse<PostSummaryResponse>
        {
            Items = posts,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        };

        return Ok(ApiResponse<PagedResponse<PostSummaryResponse>>.Ok(result));
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    // Get a single post and increment its view count.
    public async Task<ActionResult<ApiResponse<PostDetailResponse>>> GetPost(Guid id)
    {
        var post = await _db.Posts
            .Include(p => p.Author)
                .ThenInclude(a => a.UserRoleUsers)
                    .ThenInclude(ur => ur.Role)
            .Include(p => p.Tags)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);


        if (post == null)
        {
            return NotFound(ApiResponse<PostDetailResponse>.Fail("Post not found."));
        }

        var isOwner = User.TryGetUserId(out var userId) && post.AuthorId == userId;
        var canViewHidden = userId != Guid.Empty && await _permissions.HasPermissionAsync(userId, "post:hide_any");
        var canReview = userId != Guid.Empty && await _permissions.HasPermissionAsync(userId, "post:review");
        if (post.IsHidden && !isOwner && !canViewHidden)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<PostDetailResponse>.Fail("Post is hidden."));
        }
        if (post.ReviewStatus != "approved" && !string.IsNullOrWhiteSpace(post.ReviewStatus) && !isOwner && !canReview)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<PostDetailResponse>.Fail("Post is waiting for review."));
        }

        // Count this read as a view.
        post.ViewCount += 1;
        await _db.SaveChangesAsync();

        string? myVote = null;
        if (User.TryGetUserId(out var voterId))
        {
            myVote = await CommunityVotes.GetMyVoteAsync(_db, voterId, CommunityVotes.PostTarget, post.Id);
        }

        var response = new PostDetailResponse
        {
            Id = post.Id,
            Title = post.Title,
            BodyMarkdown = post.BodyMarkdown,
            ImageUrl = post.ImageUrl,
            Author = MapAuthor(post.Author),
            Upvotes = post.Upvotes,
            Downvotes = post.Downvotes,
            ViewCount = post.ViewCount,
            CommentCount = await _db.Comments.CountAsync(c => c.PostId == post.Id && !c.IsHidden),
            IsHidden = post.IsHidden,
            ReviewStatus = post.ReviewStatus,
            ReviewNote = post.ReviewNote,
            AcceptedCommentId = post.AcceptedCommentId,
            CreatedAt = post.CreatedAt,
            UpdatedAt = post.UpdatedAt,
            MyVote = myVote,
            Tags = post.Tags
                .OrderBy(t => t.Name)
                .Select(MapTag)
                .ToList()
        };

        return Ok(ApiResponse<PostDetailResponse>.Ok(response));
    }

    [HttpPost]
    [Authorize]
    // Create a new post. Requires post:create permission.
    public async Task<ActionResult<ApiResponse<PostDetailResponse>>> CreatePost(CreatePostRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<PostDetailResponse>.Fail("Unauthorized."));
        }

        if (!await IsActiveUserAsync(userId))
        {
            return Unauthorized(ApiResponse<PostDetailResponse>.Fail("Your session is no longer valid. Please sign in again."));
        }

        // Check permission to create posts
        if (!await _permissions.HasPermissionAsync(userId, "post:create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<PostDetailResponse>.Fail("Forbidden. Missing permission: post:create"));
        }

        var title = request.Title.Trim();
        var body = request.BodyMarkdown.Trim();
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(body))
        {
            return BadRequest(ApiResponse<PostDetailResponse>.Fail("Title and body are required."));
        }

        var tags = await ResolveTagsAsync(request.TagIds);
        if (tags == null)
        {
            return BadRequest(ApiResponse<PostDetailResponse>.Fail("One or more tags do not exist."));
        }

        var now = DateTime.Now;
        var post = new Post
        {
            Id = Guid.NewGuid(),
            AuthorId = userId,
            Title = title,
            BodyMarkdown = body,
            ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim(),
            Upvotes = 0,
            Downvotes = 0,
            ViewCount = 0,
            IsHidden = false,
            ReviewStatus = await _autoApproval.EvaluatePostAsync(userId, title, body, isPublic: true),
            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var tag in tags)
        {
            post.Tags.Add(tag);
        }

        _db.Posts.Add(post);
        await _db.SaveChangesAsync();
        await SaveMentionsAsync(userId, "post", post.Id, body);

        if (post.ReviewStatus == "pending")
        {
            await _notificationHub.Clients.All.ModerationQueueChanged("post");
        }

        var author = await _db.Users.FirstAsync(u => u.Id == userId);

        return Ok(ApiResponse<PostDetailResponse>.Ok(MapPostDetail(post, author, 0, null)));
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    // Update a post. Only the author may edit.
    public async Task<ActionResult<ApiResponse<PostDetailResponse>>> UpdatePost(Guid id, UpdatePostRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<PostDetailResponse>.Fail("Unauthorized."));
        }

        var post = await _db.Posts
            .Include(p => p.Author)
            .Include(p => p.Tags)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

        if (post == null)
        {
            return NotFound(ApiResponse<PostDetailResponse>.Fail("Post not found."));
        }

        // Author can edit own; anyone with post:edit_any (e.g. Admin or a per-user grant) can edit any post.
        if (post.AuthorId != userId && !await _permissions.HasPermissionAsync(userId, "post:edit_any"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<PostDetailResponse>.Fail("Forbidden."));
        }

        var title = request.Title.Trim();
        var body = request.BodyMarkdown.Trim();
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(body))
        {
            return BadRequest(ApiResponse<PostDetailResponse>.Fail("Title and body are required."));
        }

        post.Title = title;
        post.BodyMarkdown = body;
        post.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();
        post.UpdatedAt = DateTime.Now;
        ApplyAutoReview(post, await _autoApproval.EvaluatePostAsync(post.AuthorId, title, body, isPublic: !post.IsHidden));

        if (request.TagIds != null)
        {
            var tags = await ResolveTagsAsync(request.TagIds);
            if (tags == null)
            {
                return BadRequest(ApiResponse<PostDetailResponse>.Fail("One or more tags do not exist."));
            }

            post.Tags.Clear();
            foreach (var tag in tags)
            {
                post.Tags.Add(tag);
            }
        }

        await _db.SaveChangesAsync();

        var commentCount = await _db.Comments.CountAsync(c => c.PostId == post.Id && !c.IsHidden);
        var myVote = await CommunityVotes.GetMyVoteAsync(_db, userId, CommunityVotes.PostTarget, post.Id);

        return Ok(ApiResponse<PostDetailResponse>.Ok(MapPostDetail(post, post.Author, commentCount, myVote)));
    }

    [HttpPost("{id:guid}/image")]
    [Consumes("multipart/form-data")]
    [Authorize]
    // Upload a cover image for a post and save it to Cloudinary.
    public async Task<ActionResult<ApiResponse<PostDetailResponse>>> UploadPostImage(
        Guid id,
        IFormFile? file,
        [FromServices] CloudinaryService cloudinaryService)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<PostDetailResponse>.Fail("Unauthorized."));
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(ApiResponse<PostDetailResponse>.Fail("Please choose an image file."));
        }

        var post = await _db.Posts
            .Include(p => p.Author)
            .Include(p => p.Tags)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

        if (post == null)
        {
            return NotFound(ApiResponse<PostDetailResponse>.Fail("Post not found."));
        }

        if (post.AuthorId != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<PostDetailResponse>.Fail("Forbidden."));
        }

        try
        {
            var uploadResult = await cloudinaryService.UploadPostImageAsync(id, file);
            post.ImageUrl = uploadResult.Url;
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<PostDetailResponse>.Fail(ex.Message));
        }

        post.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();

        var commentCount = await _db.Comments.CountAsync(c => c.PostId == post.Id && !c.IsHidden);
        var myVote = await CommunityVotes.GetMyVoteAsync(_db, userId, CommunityVotes.PostTarget, post.Id);

        return Ok(ApiResponse<PostDetailResponse>.Ok(MapPostDetail(post, post.Author, commentCount, myVote), "Post image updated."));
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    // Delete a post. Author can delete own; Moderator/Admin can delete any.
    public async Task<ActionResult<ApiResponse<object>>> DeletePost(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var post = await _db.Posts
            .Include(p => p.Comments)
            .Include(p => p.Tags)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

        if (post == null)
        {
            return NotFound(ApiResponse<object>.Fail("Post not found."));
        }

        // Author can delete own; anyone with post:delete_any (Moderator/Admin via role, or a
        // per-user grant) can delete any post.
        if (post.AuthorId != userId && !await _permissions.HasPermissionAsync(userId, "post:delete_any"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        var postAuthorId = post.AuthorId;
        var postTitle = post.Title;
        post.IsDeleted = true;
        post.DeletedAt = DateTime.UtcNow;
        post.DeletedBy = userId;
        post.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Tell the author their post was removed (skipped if they deleted it themselves).
        await _notifications.NotifyAsync(
            recipientId: postAuthorId,
            type: NotificationTypes.PostDeleted,
            message: $"Bài viết \"{postTitle}\" của bạn đã bị xóa bởi quản trị viên.",
            refId: id,
            refType: NotificationRefTypes.Post,
            actorId: userId);

        return Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    [HttpPost("{id:guid}/vote")]
    [Authorize]
    // Upvote or downvote a post (toggles on repeat).
    public async Task<ActionResult<ApiResponse<VoteResultResponse>>> VotePost(Guid id, VoteRequest request)
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

        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == id && !p.IsHidden && !p.IsDeleted);
        if (post == null)
        {
            return NotFound(ApiResponse<VoteResultResponse>.Fail("Post not found."));
        }

        var result = await CommunityVotes.ApplyAsync(_db, userId, CommunityVotes.PostTarget, post.Id, voteType!);

        post.Upvotes = result.Upvotes;
        post.Downvotes = result.Downvotes;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<VoteResultResponse>.Ok(result));
    }

    [HttpGet("{id:guid}/comments")]
    [AllowAnonymous]
    // Get nested comments for a post.
    public async Task<ActionResult<ApiResponse<List<CommentResponse>>>> GetComments(Guid id)
    {
        var postExists = await _db.Posts.AnyAsync(p => p.Id == id && !p.IsDeleted);
        if (!postExists)
        {
            return NotFound(ApiResponse<List<CommentResponse>>.Fail("Post not found."));
        }

        // Users who can hide comments (comment:hide) also see hidden comments; everyone else only sees visible ones.
        var includeHidden = User.TryGetUserId(out var viewerId)
            && await _permissions.HasPermissionAsync(viewerId, "comment:hide");
        var comments = await _db.Comments
            .AsNoTracking()
            .Where(c => c.PostId == id && (includeHidden || !c.IsHidden))
            .OrderBy(c => c.CreatedAt)
            .Select(c => new CommentResponse
            {
                Id = c.Id,
                PostId = c.PostId,
                ParentId = c.ParentId,
                Author = new AuthorSummary
                {
                    Id = c.Author.Id,
                    Username = c.Author.Username,
                    FullName = c.Author.FullName,
                    AvatarUrl = c.Author.AvatarUrl,
                    Roles = c.Author.UserRoleUsers
                        .Where(ur => ur.Role.IsActive)
                        .Select(ur => ur.Role.Name)
                        .ToList()
                },
                BodyMarkdown = c.BodyMarkdown,
                Upvotes = c.Upvotes,
                Downvotes = c.Downvotes,
                IsAccepted = c.IsAccepted,
                IsHidden = c.IsHidden,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            })
            .ToListAsync();

        var tree = BuildCommentTree(comments);

        return Ok(ApiResponse<List<CommentResponse>>.Ok(tree));
    }

    [HttpPost("{id:guid}/comments")]
    [Authorize]
    // Add a comment or reply to a post. Requires comment:create permission.
    public async Task<ActionResult<ApiResponse<CommentResponse>>> AddComment(Guid id, CreateCommentRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<CommentResponse>.Fail("Unauthorized."));
        }

        if (!await IsActiveUserAsync(userId))
        {
            return Unauthorized(ApiResponse<CommentResponse>.Fail("Your session is no longer valid. Please sign in again."));
        }

        // Check permission to create comments
        if (!await _permissions.HasPermissionAsync(userId, "comment:create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<CommentResponse>.Fail("Forbidden. Missing permission: comment:create"));
        }

        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == id && !p.IsHidden && !p.IsDeleted);
        if (post == null)
        {
            return NotFound(ApiResponse<CommentResponse>.Fail("Post not found."));
        }

        var body = request.BodyMarkdown.Trim();
        if (string.IsNullOrWhiteSpace(body))
        {
            return BadRequest(ApiResponse<CommentResponse>.Fail("Comment body is required."));
        }

        if (request.ParentId.HasValue)
        {
            var parentValid = await _db.Comments.AnyAsync(c =>
                c.Id == request.ParentId.Value && c.PostId == id && !c.IsHidden);
            if (!parentValid)
            {
                return BadRequest(ApiResponse<CommentResponse>.Fail("Parent comment not found in this post."));
            }
        }

        var now = DateTime.Now;
        var comment = new Comment
        {
            Id = Guid.NewGuid(),
            PostId = id,
            AuthorId = userId,
            ParentId = request.ParentId,
            BodyMarkdown = body,
            Upvotes = 0,
            Downvotes = 0,
            IsAccepted = false,
            IsHidden = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Comments.Add(comment);
        await _db.SaveChangesAsync();
        await SaveMentionsAsync(userId, "comment", comment.Id, body);

        var author = await _db.Users
            .Include(u => u.UserRoleUsers)
                .ThenInclude(ur => ur.Role)
            .FirstAsync(u => u.Id == userId);


        var response = new CommentResponse
        {
            Id = comment.Id,
            PostId = comment.PostId,
            ParentId = comment.ParentId,
            Author = MapAuthor(author),
            BodyMarkdown = comment.BodyMarkdown,
            Upvotes = comment.Upvotes,
            Downvotes = comment.Downvotes,
            IsAccepted = comment.IsAccepted,
            IsHidden = comment.IsHidden,
            CreatedAt = comment.CreatedAt,
            UpdatedAt = comment.UpdatedAt
        };

        // Notify everyone viewing this post that a new comment/reply arrived.
        await _commentHub.Clients.Group(CommentHub.PostGroup(comment.PostId)).CommentCreated(response);

        // Notify the people directly affected by the new comment/reply. NotifyAsync
        // skips self-notifications, and the HashSet prevents duplicate recipients.
        var notifiedUserIds = new HashSet<Guid>();

        if (comment.ParentId.HasValue)
        {
            var parentAuthorId = await _db.Comments
                .Where(c => c.Id == comment.ParentId.Value)
                .Select(c => (Guid?)c.AuthorId)
                .FirstOrDefaultAsync();

            if (parentAuthorId.HasValue)
            {
                await _notifications.NotifyAsync(
                    recipientId: parentAuthorId.Value,
                    type: NotificationTypes.CommentReply,
                    message: $"{author.FullName ?? author.Username} đã trả lời bình luận của bạn.",
                    refId: comment.PostId,
                    refType: NotificationRefTypes.Post,
                    actorId: userId);
                notifiedUserIds.Add(parentAuthorId.Value);
            }
        }

        if (notifiedUserIds.Add(post.AuthorId))
        {
            var message = comment.ParentId.HasValue
                ? $"{author.FullName ?? author.Username} đã trả lời trong bài viết của bạn."
                : $"{author.FullName ?? author.Username} đã bình luận trên bài viết của bạn.";

            await _notifications.NotifyAsync(
                recipientId: post.AuthorId,
                type: NotificationTypes.PostComment,
                message: message,
                refId: comment.PostId,
                refType: NotificationRefTypes.Post,
                actorId: userId);
        }

        return Ok(ApiResponse<CommentResponse>.Ok(response));
    }

    [HttpPost("{id:guid}/moderate")]
    [Authorize]
    // Hide or unhide a post.
    // - Post author needs the post:hide permission to hide/unhide their own post.
    // - To hide/unhide someone else's post requires the post:hide_any permission (Moderator/Admin).
    public async Task<ActionResult<ApiResponse<object>>> ModeratePost(Guid id, ModerateRequest request)
    {
        try
        {
            if (!User.TryGetUserId(out var moderatorId))
            {
                return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
            }

            var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == id);
            if (post == null)
            {
                return NotFound(ApiResponse<object>.Fail("Post not found."));
            }

            var isOwner = post.AuthorId == moderatorId;
            // NOTE: the permission catalog only ever seeds "post:hide" (see migrations), never
            // "post:hide_own" — that key was renamed once but this check wasn't updated, which
            // made the "Ẩn" checkbox in role-management a no-op (always 403). Check "post:hide".
            var canHideOwn = isOwner && await _permissions.HasPermissionAsync(moderatorId, "post:hide");
            var canHideAny = await _permissions.HasPermissionAsync(moderatorId, "post:hide_any");

            // Owner can hide/unhide their own post (requires post:hide); Moderator/Admin can hide/unhide any post (requires post:hide_any).
            if (!canHideOwn && !canHideAny)
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    ApiResponse<object>.Fail("Forbidden. You don't have permission to hide/unhide this post."));
            }

            post.IsHidden = request.Hidden;
            post.UpdatedAt = DateTime.Now;

            var actionValue = request.Hidden ? "hide" : "restore";
            _db.ModerationLogs.Add(new ModerationLog
            {
                Id = Guid.NewGuid(),
                ModeratorId = moderatorId,
                TargetType = CommunityVotes.PostTarget,
                TargetId = post.Id,
                Action = actionValue,
                Reason = request.Reason?.Trim(),
                CreatedAt = DateTime.Now
            });

            await _db.SaveChangesAsync();

            return Ok(ApiResponse<object>.Ok(new { id = post.Id, isHidden = post.IsHidden }));
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"ModeratePost EXCEPTION: {ex.GetType().Name}: {ex.Message}");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail($"Internal error: {ex.Message}"));
        }
    }

    // ----- Helpers -----

    private async Task<bool> IsActiveUserAsync(Guid userId)
    {
        return await _db.Users.AnyAsync(u => u.Id == userId && u.IsActive && !u.IsLocked);
    }

    private async Task<List<Tag>?> ResolveTagsAsync(List<Guid>? tagIds)
    {
        if (tagIds == null || tagIds.Count == 0)
        {
            return new List<Tag>();
        }

        var distinct = tagIds.Distinct().ToList();
        var tags = await _db.Tags.Where(t => distinct.Contains(t.Id)).ToListAsync();

        return tags.Count == distinct.Count ? tags : null;
    }

    private async Task DeleteVotesAsync(string targetType, List<Guid> targetIds)
    {
        if (targetIds.Count == 0)
        {
            return;
        }

        var votes = await _db.Votes
            .Where(v => v.TargetType == targetType && targetIds.Contains(v.TargetId))
            .ToListAsync();
        _db.Votes.RemoveRange(votes);
    }

    // Assemble a flat list of comments into a nested reply tree.
    private static List<CommentResponse> BuildCommentTree(List<CommentResponse> comments)
    {
        var byId = comments.ToDictionary(c => c.Id);
        var roots = new List<CommentResponse>();

        foreach (var comment in comments)
        {
            if (comment.ParentId.HasValue && byId.TryGetValue(comment.ParentId.Value, out var parent))
            {
                parent.Replies.Add(comment);
            }
            else
            {
                roots.Add(comment);
            }
        }

        return roots;
    }

    private static AuthorSummary MapAuthor(User user)
    {
        return new AuthorSummary
        {
            Id = user.Id,
            Username = user.Username,
            FullName = user.FullName,
            AvatarUrl = user.AvatarUrl,
            Roles = (user.UserRoleUsers ?? (ICollection<UserRole>)[])
                .Where(ur => ur.Role?.IsActive == true)
                .Select(ur => ur.Role.Name)
                .ToList()
        };
    }

    private static TagResponse MapTag(Tag tag)
    {
        return new TagResponse
        {
            Id = tag.Id,
            Name = tag.Name,
            Slug = tag.Slug,
            ColorHex = tag.ColorHex.Trim()
        };
    }

    private static PostDetailResponse MapPostDetail(Post post, User author, int commentCount, string? myVote)
    {
        return new PostDetailResponse
        {
            Id = post.Id,
            Title = post.Title,
            BodyMarkdown = post.BodyMarkdown,
            ImageUrl = post.ImageUrl,
            Author = MapAuthor(author),
            Upvotes = post.Upvotes,
            Downvotes = post.Downvotes,
            ViewCount = post.ViewCount,
            CommentCount = commentCount,
            IsHidden = post.IsHidden,
            ReviewStatus = post.ReviewStatus,
            ReviewNote = post.ReviewNote,
            AcceptedCommentId = post.AcceptedCommentId,
            CreatedAt = post.CreatedAt,
            UpdatedAt = post.UpdatedAt,
            MyVote = myVote,
            Tags = post.Tags
                .OrderBy(t => t.Name)
                .Select(MapTag)
                .ToList()
        };
    }

    private static void ApplyAutoReview(Post post, string reviewStatus)
    {
        post.ReviewStatus = reviewStatus;
        if (!string.Equals(reviewStatus, "approved", StringComparison.OrdinalIgnoreCase))
        {
            post.ReviewedBy = null;
            post.ReviewedAt = null;
            post.ReviewNote = null;
        }
    }

    private async Task SaveMentionsAsync(Guid authorId, string sourceType, Guid sourceId, string text)
    {
        var names = Regex.Matches(text ?? string.Empty, "(?<![\\w@])@([A-Za-z0-9_.-]{2,50})")
            .Select(m => m.Groups[1].Value).Distinct(StringComparer.OrdinalIgnoreCase).Take(20).ToList();
        if (names.Count == 0) return;
        var users = await _db.Users.Where(u => u.IsActive && names.Contains(u.Username) && u.Id != authorId).ToListAsync();
        foreach (var user in users)
        {
            _db.UserMentions.Add(new UserMention { Id = Guid.NewGuid(), AuthorId = authorId, MentionedUserId = user.Id, SourceType = sourceType, SourceId = sourceId, CreatedAt = DateTime.UtcNow });
            await _notifications.NotifyAsync(user.Id, "user_mention", $"Bạn được nhắc đến trong {sourceType}.", sourceId, sourceType, authorId);
        }
        await _db.SaveChangesAsync();
    }
}
