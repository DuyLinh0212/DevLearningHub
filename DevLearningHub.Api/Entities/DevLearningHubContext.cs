using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Entities;

public partial class DevLearningHubContext : DbContext
{
    public DevLearningHubContext()
    {
    }

    public DevLearningHubContext(DbContextOptions<DevLearningHubContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditLog> AuditLogs { get; set; }

    public virtual DbSet<Comment> Comments { get; set; }

    public virtual DbSet<ModerationLog> ModerationLogs { get; set; }

    public virtual DbSet<Notification> Notifications { get; set; }

    public virtual DbSet<Permission> Permissions { get; set; }

    public virtual DbSet<Post> Posts { get; set; }

    public virtual DbSet<Problem> Problems { get; set; }

    public virtual DbSet<ProgrammingLanguage> ProgrammingLanguages { get; set; }

    public virtual DbSet<Question> Questions { get; set; }

    public virtual DbSet<QuestionOption> QuestionOptions { get; set; }

    public virtual DbSet<QuizAnswer> QuizAnswers { get; set; }

    public virtual DbSet<QuizSession> QuizSessions { get; set; }

    public virtual DbSet<QuizSet> QuizSets { get; set; }

    public virtual DbSet<QuizSetQuestion> QuizSetQuestions { get; set; }

    public virtual DbSet<RefreshToken> RefreshTokens { get; set; }

    public virtual DbSet<Roadmap> Roadmaps { get; set; }

    public virtual DbSet<RoadmapTopic> RoadmapTopics { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<RolePermission> RolePermissions { get; set; }

    public virtual DbSet<Submission> Submissions { get; set; }

    public virtual DbSet<SubmissionTestResult> SubmissionTestResults { get; set; }

    public virtual DbSet<Tag> Tags { get; set; }

    public virtual DbSet<TestCase> TestCases { get; set; }

    public virtual DbSet<Topic> Topics { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<UserPermission> UserPermissions { get; set; }

    public virtual DbSet<UserRole> UserRoles { get; set; }

    public virtual DbSet<UserTopicProgress> UserTopicProgresses { get; set; }

    public virtual DbSet<Vote> Votes { get; set; }

    public virtual DbSet<XpTransaction> XpTransactions { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");

            entity.HasIndex(e => new { e.ActorId, e.CreatedAt }, "idx_audit_logs_actor").IsDescending(false, true);

            entity.HasIndex(e => new { e.TargetType, e.TargetId }, "idx_audit_logs_target");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.Action)
                .HasMaxLength(100)
                .HasColumnName("action");
            entity.Property(e => e.ActorId).HasColumnName("actor_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.Detail).HasColumnName("detail");
            entity.Property(e => e.IpAddress)
                .HasMaxLength(50)
                .HasColumnName("ip_address");
            entity.Property(e => e.TargetId).HasColumnName("target_id");
            entity.Property(e => e.TargetType)
                .HasMaxLength(50)
                .HasColumnName("target_type");

            entity.HasOne(d => d.Actor).WithMany(p => p.AuditLogs)
                .HasForeignKey(d => d.ActorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_audit_logs_actor");
        });

        modelBuilder.Entity<Comment>(entity =>
        {
            entity.ToTable("comments");

            entity.HasIndex(e => e.AuthorId, "idx_comments_author");

            entity.HasIndex(e => new { e.PostId, e.ParentId, e.CreatedAt }, "idx_comments_post");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.AuthorId).HasColumnName("author_id");
            entity.Property(e => e.BodyMarkdown).HasColumnName("body_markdown");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.Downvotes).HasColumnName("downvotes");
            entity.Property(e => e.IsAccepted).HasColumnName("is_accepted");
            entity.Property(e => e.IsHidden).HasColumnName("is_hidden");
            entity.Property(e => e.ParentId).HasColumnName("parent_id");
            entity.Property(e => e.PostId).HasColumnName("post_id");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("updated_at");
            entity.Property(e => e.Upvotes).HasColumnName("upvotes");

            entity.HasOne(d => d.Author).WithMany(p => p.Comments)
                .HasForeignKey(d => d.AuthorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_comments_author");

            entity.HasOne(d => d.Parent).WithMany(p => p.InverseParent)
                .HasForeignKey(d => d.ParentId)
                .HasConstraintName("FK_comments_parent");

            entity.HasOne(d => d.Post).WithMany(p => p.Comments)
                .HasForeignKey(d => d.PostId)
                .HasConstraintName("FK_comments_post");
        });

        modelBuilder.Entity<ModerationLog>(entity =>
        {
            entity.ToTable("moderation_logs");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.Action)
                .HasMaxLength(20)
                .HasColumnName("action");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.ModeratorId).HasColumnName("moderator_id");
            entity.Property(e => e.Reason)
                .HasMaxLength(500)
                .HasColumnName("reason");
            entity.Property(e => e.TargetId).HasColumnName("target_id");
            entity.Property(e => e.TargetType)
                .HasMaxLength(10)
                .HasColumnName("target_type");

            entity.HasOne(d => d.Moderator).WithMany(p => p.ModerationLogs)
                .HasForeignKey(d => d.ModeratorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_moderation_logs_moderator");
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("notifications");

            entity.HasIndex(e => new { e.UserId, e.IsRead, e.CreatedAt }, "idx_notif_user_unread").IsDescending(false, false, true);

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.IsRead).HasColumnName("is_read");
            entity.Property(e => e.Message).HasColumnName("message");
            entity.Property(e => e.RefId).HasColumnName("ref_id");
            entity.Property(e => e.RefType)
                .HasMaxLength(20)
                .HasColumnName("ref_type");
            entity.Property(e => e.Type)
                .HasMaxLength(20)
                .HasColumnName("type");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithMany(p => p.Notifications)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_notifications_user");
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.ToTable("permissions");

            entity.HasIndex(e => e.Name, "UQ_permissions_name").IsUnique();

            entity.HasIndex(e => e.Module, "idx_permissions_module");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.Description)
                .HasMaxLength(255)
                .HasColumnName("description");
            entity.Property(e => e.Module)
                .HasMaxLength(50)
                .HasColumnName("module");
            entity.Property(e => e.Name)
                .HasMaxLength(100)
                .HasColumnName("name");
        });

        modelBuilder.Entity<Post>(entity =>
        {
            entity.ToTable("posts");

            entity.HasIndex(e => new { e.AuthorId, e.CreatedAt }, "idx_posts_author").IsDescending(false, true);

            entity.HasIndex(e => new { e.IsHidden, e.CreatedAt }, "idx_posts_public_feed").IsDescending(false, true);

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.AcceptedCommentId).HasColumnName("accepted_comment_id");
            entity.Property(e => e.AuthorId).HasColumnName("author_id");
            entity.Property(e => e.BodyMarkdown).HasColumnName("body_markdown");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.Downvotes).HasColumnName("downvotes");
            entity.Property(e => e.ImageUrl).HasColumnName("image_url");
            entity.Property(e => e.IsHidden).HasColumnName("is_hidden");
            entity.Property(e => e.Title)
                .HasMaxLength(300)
                .HasColumnName("title");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("updated_at");
            entity.Property(e => e.Upvotes).HasColumnName("upvotes");
            entity.Property(e => e.ViewCount).HasColumnName("view_count");

            entity.HasOne(d => d.AcceptedComment).WithMany(p => p.Posts)
                .HasForeignKey(d => d.AcceptedCommentId)
                .HasConstraintName("FK_posts_accepted_comment");

            entity.HasOne(d => d.Author).WithMany(p => p.Posts)
                .HasForeignKey(d => d.AuthorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_posts_author");

            entity.HasMany(d => d.Tags).WithMany(p => p.Posts)
                .UsingEntity<Dictionary<string, object>>(
                    "PostTag",
                    r => r.HasOne<Tag>().WithMany()
                        .HasForeignKey("TagId")
                        .HasConstraintName("FK_post_tags_tag"),
                    l => l.HasOne<Post>().WithMany()
                        .HasForeignKey("PostId")
                        .HasConstraintName("FK_post_tags_post"),
                    j =>
                    {
                        j.HasKey("PostId", "TagId");
                        j.ToTable("post_tags");
                        j.IndexerProperty<Guid>("PostId").HasColumnName("post_id");
                        j.IndexerProperty<Guid>("TagId").HasColumnName("tag_id");
                    });
        });

        modelBuilder.Entity<Problem>(entity =>
        {
            entity.ToTable("problems");

            entity.HasIndex(e => new { e.TopicId, e.Difficulty }, "idx_problems_topic_diff");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Difficulty)
                .HasMaxLength(10)
                .HasDefaultValue("easy")
                .HasColumnName("difficulty");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.StarterCode).HasColumnName("starter_code");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.TopicId).HasColumnName("topic_id");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Problems)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_problems_user");

            entity.HasOne(d => d.Topic).WithMany(p => p.Problems)
                .HasForeignKey(d => d.TopicId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_problems_topic");

            entity.HasMany(d => d.Tags).WithMany(p => p.Problems)
                .UsingEntity<Dictionary<string, object>>(
                    "ProblemTag",
                    r => r.HasOne<Tag>().WithMany()
                        .HasForeignKey("TagId")
                        .HasConstraintName("FK_problem_tags_tag"),
                    l => l.HasOne<Problem>().WithMany()
                        .HasForeignKey("ProblemId")
                        .HasConstraintName("FK_problem_tags_problem"),
                    j =>
                    {
                        j.HasKey("ProblemId", "TagId");
                        j.ToTable("problem_tags");
                        j.IndexerProperty<Guid>("ProblemId").HasColumnName("problem_id");
                        j.IndexerProperty<Guid>("TagId").HasColumnName("tag_id");
                    });
        });

        modelBuilder.Entity<ProgrammingLanguage>(entity =>
        {
            entity.ToTable("programming_languages");

            entity.HasIndex(e => e.Slug, "UQ_programming_languages_slug").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Judge0LanguageId).HasColumnName("judge0_language_id");
            entity.Property(e => e.Name)
                .HasMaxLength(50)
                .HasColumnName("name");
            entity.Property(e => e.Slug)
                .HasMaxLength(50)
                .HasColumnName("slug");
        });

        modelBuilder.Entity<Question>(entity =>
        {
            entity.ToTable("questions");

            entity.HasIndex(e => new { e.TopicId, e.Level }, "idx_questions_topic_level");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.Content).HasColumnName("content");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.Explanation).HasColumnName("explanation");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Level)
                .HasMaxLength(20)
                .HasDefaultValue("beginner")
                .HasColumnName("level");
            entity.Property(e => e.TopicId).HasColumnName("topic_id");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Questions)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_questions_user");

            entity.HasOne(d => d.Topic).WithMany(p => p.Questions)
                .HasForeignKey(d => d.TopicId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_questions_topic");
        });

        modelBuilder.Entity<QuestionOption>(entity =>
        {
            entity.ToTable("question_options");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.Content).HasColumnName("content");
            entity.Property(e => e.IsCorrect).HasColumnName("is_correct");
            entity.Property(e => e.OrderIndex).HasColumnName("order_index");
            entity.Property(e => e.QuestionId).HasColumnName("question_id");

            entity.HasOne(d => d.Question).WithMany(p => p.QuestionOptions)
                .HasForeignKey(d => d.QuestionId)
                .HasConstraintName("FK_question_options_question");
        });

        modelBuilder.Entity<QuizAnswer>(entity =>
        {
            entity.ToTable("quiz_answers");

            entity.HasIndex(e => e.SessionId, "idx_quiz_answers_session");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.IsCorrect).HasColumnName("is_correct");
            entity.Property(e => e.QuestionId).HasColumnName("question_id");
            entity.Property(e => e.SelectedOptionId).HasColumnName("selected_option_id");
            entity.Property(e => e.SessionId).HasColumnName("session_id");

            entity.HasOne(d => d.Question).WithMany(p => p.QuizAnswers)
                .HasForeignKey(d => d.QuestionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_quiz_answers_question");

            entity.HasOne(d => d.SelectedOption).WithMany(p => p.QuizAnswers)
                .HasForeignKey(d => d.SelectedOptionId)
                .HasConstraintName("FK_quiz_answers_option");

            entity.HasOne(d => d.Session).WithMany(p => p.QuizAnswers)
                .HasForeignKey(d => d.SessionId)
                .HasConstraintName("FK_quiz_answers_session");
        });

        modelBuilder.Entity<QuizSession>(entity =>
        {
            entity.ToTable("quiz_sessions");

            entity.HasIndex(e => new { e.UserId, e.Status }, "idx_sessions_user_status");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.EndedAt).HasColumnName("ended_at");
            entity.Property(e => e.QuizSetId).HasColumnName("quiz_set_id");
            entity.Property(e => e.Score).HasColumnName("score");
            entity.Property(e => e.StartedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("started_at");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("in_progress")
                .HasColumnName("status");
            entity.Property(e => e.TimeTakenSeconds).HasColumnName("time_taken_seconds");
            entity.Property(e => e.TotalQuestions).HasColumnName("total_questions");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.QuizSet).WithMany(p => p.QuizSessions)
                .HasForeignKey(d => d.QuizSetId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_quiz_sessions_quiz_set");

            entity.HasOne(d => d.User).WithMany(p => p.QuizSessions)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_quiz_sessions_user");
        });

        modelBuilder.Entity<QuizSet>(entity =>
        {
            entity.ToTable("quiz_sets");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.AllowedCopy)
                .HasDefaultValue(false)
                .HasColumnName("allowed_copy");
            entity.Property(e => e.IsPublic)
                .HasDefaultValue(true)
                .HasColumnName("is_public");
            entity.Property(e => e.Level)
                .HasMaxLength(20)
                .HasColumnName("level");
            entity.Property(e => e.Mode)
                .HasMaxLength(20)
                .HasDefaultValue("practice")
                .HasColumnName("mode");
            entity.Property(e => e.TimeLimitSeconds).HasColumnName("time_limit_seconds");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.TopicId).HasColumnName("topic_id");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.QuizSets)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_quiz_sets_user");

            entity.HasOne(d => d.Topic).WithMany(p => p.QuizSets)
                .HasForeignKey(d => d.TopicId)
                .HasConstraintName("FK_quiz_sets_topic");
        });

        modelBuilder.Entity<QuizSetQuestion>(entity =>
        {
            entity.HasKey(e => new { e.QuizSetId, e.QuestionId });

            entity.ToTable("quiz_set_questions");

            entity.Property(e => e.QuizSetId).HasColumnName("quiz_set_id");
            entity.Property(e => e.QuestionId).HasColumnName("question_id");
            entity.Property(e => e.OrderIndex).HasColumnName("order_index");

            entity.HasOne(d => d.Question).WithMany(p => p.QuizSetQuestions)
                .HasForeignKey(d => d.QuestionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_qsq_question");

            entity.HasOne(d => d.QuizSet).WithMany(p => p.QuizSetQuestions)
                .HasForeignKey(d => d.QuizSetId)
                .HasConstraintName("FK_qsq_quiz_set");
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");

            entity.HasIndex(e => e.TokenHash, "idx_refresh_tokens_hash");

            entity.HasIndex(e => e.UserId, "idx_refresh_tokens_user");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Property(e => e.TokenHash)
                .HasMaxLength(255)
                .HasColumnName("token_hash");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithMany(p => p.RefreshTokens)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_refresh_tokens_user");
        });

        modelBuilder.Entity<Roadmap>(entity =>
        {
            entity.ToTable("roadmaps");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Level)
                .HasMaxLength(20)
                .HasColumnName("level");
            entity.Property(e => e.OrderIndex).HasColumnName("order_index");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
        });

        modelBuilder.Entity<RoadmapTopic>(entity =>
        {
            entity.HasKey(e => new { e.RoadmapId, e.TopicId });

            entity.ToTable("roadmap_topics");

            entity.Property(e => e.RoadmapId).HasColumnName("roadmap_id");
            entity.Property(e => e.TopicId).HasColumnName("topic_id");
            entity.Property(e => e.OrderIndex).HasColumnName("order_index");

            entity.HasOne(d => d.Roadmap).WithMany(p => p.RoadmapTopics)
                .HasForeignKey(d => d.RoadmapId)
                .HasConstraintName("FK_roadmap_topics_roadmap");

            entity.HasOne(d => d.Topic).WithMany(p => p.RoadmapTopics)
                .HasForeignKey(d => d.TopicId)
                .HasConstraintName("FK_roadmap_topics_topic");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("roles");

            entity.HasIndex(e => e.Name, "UQ_roles_name").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.Description)
                .HasMaxLength(255)
                .HasColumnName("description");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Name)
                .HasMaxLength(50)
                .HasColumnName("name");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.HasKey(e => new { e.RoleId, e.PermissionId });

            entity.ToTable("role_permissions");

            entity.Property(e => e.RoleId).HasColumnName("role_id");
            entity.Property(e => e.PermissionId).HasColumnName("permission_id");
            entity.Property(e => e.GrantedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("granted_at");

            entity.HasOne(d => d.Permission).WithMany(p => p.RolePermissions)
                .HasForeignKey(d => d.PermissionId)
                .HasConstraintName("FK_role_permissions_permission");

            entity.HasOne(d => d.Role).WithMany(p => p.RolePermissions)
                .HasForeignKey(d => d.RoleId)
                .HasConstraintName("FK_role_permissions_role");
        });

        modelBuilder.Entity<Submission>(entity =>
        {
            entity.ToTable("submissions");

            entity.HasIndex(e => new { e.UserId, e.SubmittedAt }, "idx_submissions_recent").IsDescending(false, true);

            entity.HasIndex(e => new { e.UserId, e.ProblemId }, "idx_submissions_user_problem");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.Code).HasColumnName("code");
            entity.Property(e => e.CompileOutput).HasColumnName("compile_output");
            entity.Property(e => e.Judge0Token)
                .HasMaxLength(255)
                .HasColumnName("judge0_token");
            entity.Property(e => e.Language)
                .HasMaxLength(20)
                .HasColumnName("language");
            entity.Property(e => e.LanguageId).HasColumnName("language_id");
            entity.Property(e => e.MemoryKb).HasColumnName("memory_kb");
            entity.Property(e => e.PassedCases).HasColumnName("passed_cases");
            entity.Property(e => e.ProblemId).HasColumnName("problem_id");
            entity.Property(e => e.RuntimeMs).HasColumnName("runtime_ms");
            entity.Property(e => e.Stderr).HasColumnName("stderr");
            entity.Property(e => e.Stdout).HasColumnName("stdout");
            entity.Property(e => e.SubmittedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("submitted_at");
            entity.Property(e => e.TotalCases).HasColumnName("total_cases");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Verdict)
                .HasMaxLength(20)
                .HasDefaultValue("pending")
                .HasColumnName("verdict");

            entity.HasOne(d => d.LanguageNavigation).WithMany(p => p.Submissions)
                .HasForeignKey(d => d.LanguageId)
                .HasConstraintName("FK_submissions_lang");

            entity.HasOne(d => d.Problem).WithMany(p => p.Submissions)
                .HasForeignKey(d => d.ProblemId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_submissions_problem");

            entity.HasOne(d => d.User).WithMany(p => p.Submissions)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_submissions_user");
        });

        modelBuilder.Entity<SubmissionTestResult>(entity =>
        {
            entity.ToTable("submission_test_results");

            entity.HasIndex(e => e.SubmissionId, "idx_str_submission");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.ActualOutput).HasColumnName("actual_output");
            entity.Property(e => e.MemoryKb).HasColumnName("memory_kb");
            entity.Property(e => e.RuntimeMs).HasColumnName("runtime_ms");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasColumnName("status");
            entity.Property(e => e.SubmissionId).HasColumnName("submission_id");
            entity.Property(e => e.TestCaseId).HasColumnName("test_case_id");

            entity.HasOne(d => d.Submission).WithMany(p => p.SubmissionTestResults)
                .HasForeignKey(d => d.SubmissionId)
                .HasConstraintName("FK_str_submission");

            entity.HasOne(d => d.TestCase).WithMany(p => p.SubmissionTestResults)
                .HasForeignKey(d => d.TestCaseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_str_test_case");
        });

        modelBuilder.Entity<Tag>(entity =>
        {
            entity.ToTable("tags");

            entity.HasIndex(e => e.Name, "UQ_tags_name").IsUnique();

            entity.HasIndex(e => e.Slug, "UQ_tags_slug").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.ColorHex)
                .HasMaxLength(7)
                .HasDefaultValue("#6366f1")
                .IsFixedLength()
                .HasColumnName("color_hex");
            entity.Property(e => e.Name)
                .HasMaxLength(50)
                .HasColumnName("name");
            entity.Property(e => e.Slug)
                .HasMaxLength(50)
                .HasColumnName("slug");
        });

        modelBuilder.Entity<TestCase>(entity =>
        {
            entity.ToTable("test_cases");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.ExpectedOutput).HasColumnName("expected_output");
            entity.Property(e => e.Input).HasColumnName("input");
            entity.Property(e => e.IsHidden).HasColumnName("is_hidden");
            entity.Property(e => e.OrderIndex).HasColumnName("order_index");
            entity.Property(e => e.ProblemId).HasColumnName("problem_id");

            entity.HasOne(d => d.Problem).WithMany(p => p.TestCases)
                .HasForeignKey(d => d.ProblemId)
                .HasConstraintName("FK_test_cases_problem");
        });

        modelBuilder.Entity<Topic>(entity =>
        {
            entity.ToTable("topics");

            entity.HasIndex(e => e.Name, "UQ_topics_name").IsUnique();

            entity.HasIndex(e => e.Slug, "UQ_topics_slug").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Icon)
                .HasMaxLength(100)
                .HasColumnName("icon");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Name)
                .HasMaxLength(100)
                .HasColumnName("name");
            entity.Property(e => e.Slug)
                .HasMaxLength(100)
                .HasColumnName("slug");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users", tb => tb.UseSqlOutputClause(false));

            entity.HasIndex(e => e.Email, "UQ_users_email").IsUnique();

            entity.HasIndex(e => e.Username, "UQ_users_username").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.AvatarUrl).HasColumnName("avatar_url");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.Email)
                .HasMaxLength(255)
                .HasColumnName("email");
            entity.Property(e => e.FullName)
                .HasMaxLength(100)
                .HasColumnName("full_name");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.IsLocked).HasColumnName("is_locked");
            entity.Property(e => e.LockedAt).HasColumnName("locked_at");
            entity.Property(e => e.LockedReason)
                .HasMaxLength(500)
                .HasColumnName("locked_reason");
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(255)
                .HasColumnName("password_hash");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("updated_at");
            entity.Property(e => e.Username)
                .HasMaxLength(50)
                .HasColumnName("username");
            entity.Property(e => e.XpPoints).HasColumnName("xp_points");
        });

        modelBuilder.Entity<UserPermission>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.PermissionId });

            entity.ToTable("user_permissions");

            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.PermissionId).HasColumnName("permission_id");
            entity.Property(e => e.GrantedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("granted_at");
            entity.Property(e => e.GrantedBy).HasColumnName("granted_by");
            entity.Property(e => e.IsGranted)
                .HasDefaultValue(true)
                .HasColumnName("is_granted");

            entity.HasOne(d => d.GrantedByNavigation).WithMany(p => p.UserPermissionGrantedByNavigations)
                .HasForeignKey(d => d.GrantedBy)
                .HasConstraintName("FK_user_permissions_granted_by");

            entity.HasOne(d => d.Permission).WithMany(p => p.UserPermissions)
                .HasForeignKey(d => d.PermissionId)
                .HasConstraintName("FK_user_permissions_permission");

            entity.HasOne(d => d.User).WithMany(p => p.UserPermissionUsers)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_user_permissions_user");
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.RoleId });

            entity.ToTable("user_roles");

            entity.HasIndex(e => e.RoleId, "idx_user_roles_role_id");

            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.RoleId).HasColumnName("role_id");
            entity.Property(e => e.AssignedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("assigned_at");
            entity.Property(e => e.AssignedBy).HasColumnName("assigned_by");

            entity.HasOne(d => d.AssignedByNavigation).WithMany(p => p.UserRoleAssignedByNavigations)
                .HasForeignKey(d => d.AssignedBy)
                .HasConstraintName("FK_user_roles_assigned_by");

            entity.HasOne(d => d.Role).WithMany(p => p.UserRoles)
                .HasForeignKey(d => d.RoleId)
                .HasConstraintName("FK_user_roles_role");

            entity.HasOne(d => d.User).WithMany(p => p.UserRoleUsers)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_user_roles_user");
        });

        modelBuilder.Entity<UserTopicProgress>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.TopicId });

            entity.ToTable("user_topic_progress");

            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.TopicId).HasColumnName("topic_id");
            entity.Property(e => e.BestScore).HasColumnName("best_score");
            entity.Property(e => e.CorrectAnswers).HasColumnName("correct_answers");
            entity.Property(e => e.LastPracticedAt).HasColumnName("last_practiced_at");
            entity.Property(e => e.TotalAttempts).HasColumnName("total_attempts");
            entity.Property(e => e.TotalQuestions).HasColumnName("total_questions");

            entity.HasOne(d => d.Topic).WithMany(p => p.UserTopicProgresses)
                .HasForeignKey(d => d.TopicId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_utp_topic");

            entity.HasOne(d => d.User).WithMany(p => p.UserTopicProgresses)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_utp_user");
        });

        modelBuilder.Entity<Vote>(entity =>
        {
            entity.ToTable("votes");

            entity.HasIndex(e => new { e.UserId, e.TargetType, e.TargetId }, "UQ_votes_unique").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.TargetId).HasColumnName("target_id");
            entity.Property(e => e.TargetType)
                .HasMaxLength(10)
                .HasColumnName("target_type");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.VoteType)
                .HasMaxLength(4)
                .HasColumnName("vote_type");

            entity.HasOne(d => d.User).WithMany(p => p.Votes)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_votes_user");
        });

        modelBuilder.Entity<XpTransaction>(entity =>
        {
            entity.ToTable("xp_transactions");

            entity.HasIndex(e => new { e.UserId, e.CreatedAt }, "idx_xp_user_recent").IsDescending(false, true);

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.Amount).HasColumnName("amount");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.Reason)
                .HasMaxLength(100)
                .HasColumnName("reason");
            entity.Property(e => e.RefId).HasColumnName("ref_id");
            entity.Property(e => e.RefType)
                .HasMaxLength(20)
                .HasColumnName("ref_type");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithMany(p => p.XpTransactions)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_xp_transactions_user");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
