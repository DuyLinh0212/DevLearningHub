using System.ComponentModel.DataAnnotations;

namespace DevLearningHub.Api.Dtos.Community;

// Generic paged result wrapper for community listings.
public class PagedResponse<T>
{
    public List<T> Items { get; set; } = new();

    public int TotalCount { get; set; }

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int TotalPages { get; set; }
}

// Tag responses and payloads.
public class TagResponse
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public string ColorHex { get; set; } = string.Empty;
}

public class CreateTagRequest
{
    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    // Optional hex color like #6366f1. Defaults applied when empty.
    [MaxLength(7)]
    public string? ColorHex { get; set; }
}

public class UpdateTagRequest
{
    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(7)]
    public string? ColorHex { get; set; }
}

// Author summary embedded in post/comment responses.
public class AuthorSummary
{
    public Guid Id { get; set; }

    public string Username { get; set; } = string.Empty;

    public string? FullName { get; set; }

    public string? AvatarUrl { get; set; }
}

// Post responses and payloads.
public class PostSummaryResponse
{
    public Guid Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public AuthorSummary Author { get; set; } = new();

    public int Upvotes { get; set; }

    public int Downvotes { get; set; }

    public int ViewCount { get; set; }

    public int CommentCount { get; set; }

    public bool IsHidden { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public List<TagResponse> Tags { get; set; } = new();
}

public class PostDetailResponse : PostSummaryResponse
{
    public string BodyMarkdown { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public Guid? AcceptedCommentId { get; set; }

    public string? MyVote { get; set; }
}

public class CreatePostRequest
{
    [Required]
    [MaxLength(300)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string BodyMarkdown { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public List<Guid>? TagIds { get; set; }
}

public class UpdatePostRequest
{
    [Required]
    [MaxLength(300)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string BodyMarkdown { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    // When provided, replaces the post's tag set. Null leaves tags unchanged.
    public List<Guid>? TagIds { get; set; }
}

// Comment responses and payloads.
public class CommentResponse
{
    public Guid Id { get; set; }

    public Guid PostId { get; set; }

    public Guid? ParentId { get; set; }

    public AuthorSummary Author { get; set; } = new();

    public string BodyMarkdown { get; set; } = string.Empty;

    public int Upvotes { get; set; }

    public int Downvotes { get; set; }

    public bool IsAccepted { get; set; }

    public bool IsHidden { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public List<CommentResponse> Replies { get; set; } = new();
}

public class CreateCommentRequest
{
    [Required]
    public string BodyMarkdown { get; set; } = string.Empty;

    // Set to reply to an existing comment in the same post.
    public Guid? ParentId { get; set; }
}

public class UpdateCommentRequest
{
    [Required]
    public string BodyMarkdown { get; set; } = string.Empty;
}

// Voting payloads and results.
public class VoteRequest
{
    // "up" or "down".
    [Required]
    public string VoteType { get; set; } = string.Empty;
}

public class VoteResultResponse
{
    public int Upvotes { get; set; }

    public int Downvotes { get; set; }

    // Current user's vote after the action: "up", "down", or null when cleared.
    public string? MyVote { get; set; }
}

// Moderation payload for hiding/unhiding content.
public class ModerateRequest
{
    [MaxLength(500)]
    public string? Reason { get; set; }

    // Defaults to true (hide). Set false to unhide.
    public bool Hidden { get; set; } = true;
}
