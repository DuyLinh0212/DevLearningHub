using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Entities;

public partial class User
{
    public Guid Id { get; set; }

    public string Username { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string? PasswordHash { get; set; }

    public string? FullName { get; set; }

    public string? AvatarUrl { get; set; }

    public int XpPoints { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public bool IsActive { get; set; }

    public bool IsLocked { get; set; }

    public string? LockedReason { get; set; }

    public DateTime? LockedAt { get; set; }

    public virtual ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();

    public virtual ICollection<Comment> Comments { get; set; } = new List<Comment>();

    public virtual ICollection<ModerationLog> ModerationLogs { get; set; } = new List<ModerationLog>();

    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();

    public virtual ICollection<Post> Posts { get; set; } = new List<Post>();

    public virtual ICollection<Problem> Problems { get; set; } = new List<Problem>();

    public virtual ICollection<Question> Questions { get; set; } = new List<Question>();

    public virtual ICollection<QuizSession> QuizSessions { get; set; } = new List<QuizSession>();

    public virtual ICollection<QuizSet> QuizSets { get; set; } = new List<QuizSet>();

    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

    public virtual ICollection<Submission> Submissions { get; set; } = new List<Submission>();

    public virtual ICollection<UserPermission> UserPermissionGrantedByNavigations { get; set; } = new List<UserPermission>();

    public virtual ICollection<UserPermission> UserPermissionUsers { get; set; } = new List<UserPermission>();

    public virtual ICollection<UserRole> UserRoleAssignedByNavigations { get; set; } = new List<UserRole>();

    public virtual ICollection<UserRole> UserRoleUsers { get; set; } = new List<UserRole>();

    public virtual ICollection<UserTopicProgress> UserTopicProgresses { get; set; } = new List<UserTopicProgress>();

    public virtual ICollection<Vote> Votes { get; set; } = new List<Vote>();

    public virtual ICollection<XpTransaction> XpTransactions { get; set; } = new List<XpTransaction>();
}
