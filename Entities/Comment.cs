using System;
using System.Collections.Generic;

namespace API_DEVLEARNINGHUB.Entities;

public partial class Comment
{
    public Guid Id { get; set; }

    public Guid PostId { get; set; }

    public Guid AuthorId { get; set; }

    public Guid? ParentId { get; set; }

    public string BodyMarkdown { get; set; } = null!;

    public int Upvotes { get; set; }

    public int Downvotes { get; set; }

    public bool IsAccepted { get; set; }

    public bool IsHidden { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual User Author { get; set; } = null!;

    public virtual ICollection<Comment> InverseParent { get; set; } = new List<Comment>();

    public virtual Comment? Parent { get; set; }

    public virtual Post Post { get; set; } = null!;

    public virtual ICollection<Post> Posts { get; set; } = new List<Post>();
}
