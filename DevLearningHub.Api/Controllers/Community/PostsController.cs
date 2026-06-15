using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Community;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Community;

[ApiController]
[Route("api/posts")]
// Forum posts: feed, detail, CRUD, voting, comments and moderation.
public class PostsController : ControllerBase
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    private readonly DevLearningHubContext _db;

    public PostsController(DevLearningHubContext db)
    {
        _db = db;
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

        var query = _db.Posts.AsNoTracking().Where(p => !p.IsHidden);

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
                    AvatarUrl = p.Author.AvatarUrl
                },
                Upvotes = p.Upvotes,
                Downvotes = p.Downvotes,
                ViewCount = p.ViewCount,
                CommentCount = p.Comments.Count(c => !c.IsHidden),
                IsHidden = p.IsHidden,
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
            .Include(p => p.Tags)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (post == null)
        {
            return NotFound(ApiResponse<PostDetailResponse>.Fail("Post not found."));
        }

        var isOwner = User.TryGetUserId(out var userId) && post.AuthorId == userId;
        if (post.IsHidden && !isOwner && !IsModerator())
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<PostDetailResponse>.Fail("Post is hidden."));
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
    // Create a new post.
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

        var now = DateTime.UtcNow;
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
            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var tag in tags)
        {
            post.Tags.Add(tag);
        }

        _db.Posts.Add(post);
        await _db.SaveChangesAsync();

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
            .FirstOrDefaultAsync(p => p.Id == id);

        if (post == null)
        {
            return NotFound(ApiResponse<PostDetailResponse>.Fail("Post not found."));
        }

        if (post.AuthorId != userId)
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
        post.UpdatedAt = DateTime.UtcNow;

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
            .FirstOrDefaultAsync(p => p.Id == id);

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

        post.UpdatedAt = DateTime.UtcNow;
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
            .FirstOrDefaultAsync(p => p.Id == id);

        if (post == null)
        {
            return NotFound(ApiResponse<object>.Fail("Post not found."));
        }

        if (post.AuthorId != userId && !IsModerator())
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        // Break the self-reference before removing comments.
        post.AcceptedCommentId = null;
        await _db.SaveChangesAsync();

        var commentIds = post.Comments.Select(c => c.Id).ToList();
        await DeleteVotesAsync(CommunityVotes.PostTarget, new List<Guid> { post.Id });
        await DeleteVotesAsync(CommunityVotes.CommentTarget, commentIds);

        post.Tags.Clear();
        _db.Comments.RemoveRange(post.Comments);
        _db.Posts.Remove(post);
        await _db.SaveChangesAsync();

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

        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == id && !p.IsHidden);
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
        var postExists = await _db.Posts.AnyAsync(p => p.Id == id);
        if (!postExists)
        {
            return NotFound(ApiResponse<List<CommentResponse>>.Fail("Post not found."));
        }

        var comments = await _db.Comments
            .AsNoTracking()
            .Where(c => c.PostId == id && !c.IsHidden)
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
                    AvatarUrl = c.Author.AvatarUrl
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
    // Add a comment or reply to a post.
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

        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == id && !p.IsHidden);
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

        var now = DateTime.UtcNow;
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

        var author = await _db.Users.FirstAsync(u => u.Id == userId);

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

        return Ok(ApiResponse<CommentResponse>.Ok(response));
    }

    [HttpPost("{id:guid}/moderate")]
    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    // Hide or unhide a post and record a moderation log entry.
    public async Task<ActionResult<ApiResponse<object>>> ModeratePost(Guid id, ModerateRequest request)
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

        post.IsHidden = request.Hidden;
        post.UpdatedAt = DateTime.UtcNow;

        _db.ModerationLogs.Add(new ModerationLog
        {
            Id = Guid.NewGuid(),
            ModeratorId = moderatorId,
            TargetType = CommunityVotes.PostTarget,
            TargetId = post.Id,
            Action = request.Hidden ? "hide" : "unhide",
            Reason = request.Reason?.Trim(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { id = post.Id, isHidden = post.IsHidden }));
    }

    // ----- Helpers -----

    private bool IsModerator()
    {
        return User.IsInRole(AppRoles.Moderator) || User.IsInRole(AppRoles.Admin);
    }

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
            AvatarUrl = user.AvatarUrl
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
}
