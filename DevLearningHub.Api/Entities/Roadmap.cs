using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class Roadmap
{
    public Guid Id { get; set; }

    public Guid CreatedBy { get; set; }

    public string Title { get; set; } = null!;

    public string Level { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsPublic { get; set; } = true;

    public string ReviewStatus { get; set; } = "pending";

    public Guid? ReviewedBy { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewNote { get; set; }

    public DateTime CreatedAt { get; set; }

    public short OrderIndex { get; set; }

    // Soft delete: roadmap_items rows referenced by a roadmap can already have
    // user_roadmap_item_completions rows (FK_user_roadmap_item_completions_item), so hard-deleting
    // a roadmap once any learner has completed a step violates that FK. Deleting a roadmap instead
    // flips this flag and the roadmap is hidden from every listing/detail query, preserving history
    // and already-awarded XP.
    public bool IsDeleted { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual User? Reviewer { get; set; }

    public virtual ICollection<RoadmapTopic> RoadmapTopics { get; set; } = new List<RoadmapTopic>();

    public virtual ICollection<RoadmapItem> RoadmapItems { get; set; } = new List<RoadmapItem>();

    public virtual ICollection<UserRoadmap> UserRoadmaps { get; set; } = new List<UserRoadmap>();
}
