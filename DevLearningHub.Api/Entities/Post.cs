using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class Post
{
    public Guid Id { get; set; }

    public Guid AuthorId { get; set; }

    public string Title { get; set; } = null!;

    public string BodyMarkdown { get; set; } = null!;

    public string? ImageUrl { get; set; }

    public int Upvotes { get; set; }

    public int Downvotes { get; set; }

    public int ViewCount { get; set; }

    public bool IsHidden { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid? AcceptedCommentId { get; set; }

    public virtual Comment? AcceptedComment { get; set; }

    public virtual User Author { get; set; } = null!;

    public virtual ICollection<Comment> Comments { get; set; } = new List<Comment>();

    public virtual ICollection<Tag> Tags { get; set; } = new List<Tag>();
}
