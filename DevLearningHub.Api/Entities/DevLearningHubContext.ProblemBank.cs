using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Entities;

// Problem Bank feature lives in this partial so the scaffolded context file stays
// untouched. The configuration hooks into OnModelCreatingPartial, which the
// generated OnModelCreating already calls at the end.
public partial class DevLearningHubContext
{
    public virtual DbSet<ProblemBank> ProblemBanks { get; set; } = null!;

    public virtual DbSet<ProblemBankItem> ProblemBankItems { get; set; } = null!;

    public virtual DbSet<ProblemBankLike> ProblemBankLikes { get; set; } = null!;

    public virtual DbSet<ProblemBankRating> ProblemBankRatings { get; set; } = null!;

    public virtual DbSet<RoadmapItem> RoadmapItems { get; set; } = null!;

    public virtual DbSet<UserRoadmap> UserRoadmaps { get; set; } = null!;

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ProblemBank>(entity =>
        {
            entity.ToTable("problem_banks");

            entity.HasIndex(e => e.CreatedBy, "idx_problem_banks_creator");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.IsPublic)
                .HasDefaultValue(true)
                .HasColumnName("is_public");
            entity.Property(e => e.ReviewStatus)
                .HasMaxLength(20)
                .HasDefaultValue("approved")
                .HasColumnName("review_status");
            entity.Property(e => e.ReviewedBy).HasColumnName("reviewed_by");
            entity.Property(e => e.ReviewedAt).HasColumnName("reviewed_at");
            entity.Property(e => e.ReviewNote)
                .HasMaxLength(500)
                .HasColumnName("review_note");
            entity.Property(e => e.TopicId).HasColumnName("topic_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(d => d.CreatedByNavigation).WithMany()
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_problem_banks_user");

            entity.HasOne(d => d.Reviewer).WithMany()
                .HasForeignKey(d => d.ReviewedBy)
                .HasConstraintName("FK_problem_banks_reviewer");

            entity.HasOne(d => d.Topic).WithMany()
                .HasForeignKey(d => d.TopicId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_problem_banks_topic");
        });

        modelBuilder.Entity<ProblemBankItem>(entity =>
        {
            entity.ToTable("problem_bank_items");

            entity.HasKey(e => new { e.BankId, e.ProblemId });

            entity.HasIndex(e => e.ProblemId, "idx_problem_bank_items_problem");

            entity.Property(e => e.BankId).HasColumnName("bank_id");
            entity.Property(e => e.ProblemId).HasColumnName("problem_id");
            entity.Property(e => e.OrderIndex)
                .HasDefaultValue(0)
                .HasColumnName("order_index");
            entity.Property(e => e.AddedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("added_at");

            entity.HasOne(d => d.Bank).WithMany(p => p.Items)
                .HasForeignKey(d => d.BankId)
                .HasConstraintName("FK_problem_bank_items_bank");

            entity.HasOne(d => d.Problem).WithMany()
                .HasForeignKey(d => d.ProblemId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_problem_bank_items_problem");
        });

        modelBuilder.Entity<ProblemBankLike>(entity =>
        {
            entity.ToTable("problem_bank_likes");

            entity.HasKey(e => new { e.BankId, e.UserId });

            entity.Property(e => e.BankId).HasColumnName("bank_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");

            entity.HasOne(d => d.Bank).WithMany(p => p.Likes)
                .HasForeignKey(d => d.BankId)
                .HasConstraintName("FK_problem_bank_likes_bank");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_problem_bank_likes_user");
        });

        modelBuilder.Entity<ProblemBankRating>(entity =>
        {
            entity.ToTable("problem_bank_ratings");

            entity.HasKey(e => new { e.BankId, e.UserId });

            entity.Property(e => e.BankId).HasColumnName("bank_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Rating).HasColumnName("rating");
            entity.Property(e => e.Comment)
                .HasMaxLength(500)
                .HasColumnName("comment");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(d => d.Bank).WithMany(p => p.Ratings)
                .HasForeignKey(d => d.BankId)
                .HasConstraintName("FK_problem_bank_ratings_bank");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_problem_bank_ratings_user");
        });

        modelBuilder.Entity<Post>(entity =>
        {
            entity.Property(e => e.ReviewStatus)
                .HasMaxLength(20)
                .HasDefaultValue("approved")
                .HasColumnName("review_status");
            entity.Property(e => e.ReviewedBy).HasColumnName("reviewed_by");
            entity.Property(e => e.ReviewedAt).HasColumnName("reviewed_at");
            entity.Property(e => e.ReviewNote)
                .HasMaxLength(500)
                .HasColumnName("review_note");

            entity.HasOne(d => d.Reviewer).WithMany()
                .HasForeignKey(d => d.ReviewedBy)
                .HasConstraintName("FK_posts_reviewer");
        });

        modelBuilder.Entity<Problem>(entity =>
        {
            entity.Property(e => e.ReviewStatus)
                .HasMaxLength(20)
                .HasDefaultValue("approved")
                .HasColumnName("review_status");
            entity.Property(e => e.ReviewedBy).HasColumnName("reviewed_by");
            entity.Property(e => e.ReviewedAt).HasColumnName("reviewed_at");
            entity.Property(e => e.ReviewNote)
                .HasMaxLength(500)
                .HasColumnName("review_note");

            entity.HasOne(d => d.Reviewer).WithMany()
                .HasForeignKey(d => d.ReviewedBy)
                .HasConstraintName("FK_problems_reviewer");
        });

        modelBuilder.Entity<QuizSet>(entity =>
        {
            entity.Property(e => e.ReviewStatus)
                .HasMaxLength(20)
                .HasDefaultValue("approved")
                .HasColumnName("review_status");
            entity.Property(e => e.ReviewedBy).HasColumnName("reviewed_by");
            entity.Property(e => e.ReviewedAt).HasColumnName("reviewed_at");
            entity.Property(e => e.ReviewNote)
                .HasMaxLength(500)
                .HasColumnName("review_note");

            entity.HasOne(d => d.Reviewer).WithMany()
                .HasForeignKey(d => d.ReviewedBy)
                .HasConstraintName("FK_quiz_sets_reviewer");
        });

        modelBuilder.Entity<RoadmapItem>(entity =>
        {
            entity.ToTable("roadmap_items");

            entity.HasIndex(e => new { e.RoadmapId, e.OrderIndex }, "idx_roadmap_items_order");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newsequentialid())")
                .HasColumnName("id");
            entity.Property(e => e.RoadmapId).HasColumnName("roadmap_id");
            entity.Property(e => e.ItemType)
                .HasMaxLength(30)
                .HasColumnName("item_type");
            entity.Property(e => e.TopicId).HasColumnName("topic_id");
            entity.Property(e => e.QuizSetId).HasColumnName("quiz_set_id");
            entity.Property(e => e.ProblemId).HasColumnName("problem_id");
            entity.Property(e => e.ProblemBankId).HasColumnName("problem_bank_id");
            entity.Property(e => e.TitleOverride)
                .HasMaxLength(200)
                .HasColumnName("title_override");
            entity.Property(e => e.DescriptionOverride).HasColumnName("description_override");
            entity.Property(e => e.OrderIndex).HasColumnName("order_index");
            entity.Property(e => e.IsRequired)
                .HasDefaultValue(true)
                .HasColumnName("is_required");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");

            entity.HasOne(d => d.Roadmap).WithMany(p => p.RoadmapItems)
                .HasForeignKey(d => d.RoadmapId)
                .HasConstraintName("FK_roadmap_items_roadmap");

            entity.HasOne(d => d.Topic).WithMany()
                .HasForeignKey(d => d.TopicId)
                .HasConstraintName("FK_roadmap_items_topic");

            entity.HasOne(d => d.QuizSet).WithMany()
                .HasForeignKey(d => d.QuizSetId)
                .HasConstraintName("FK_roadmap_items_quiz_set");

            entity.HasOne(d => d.Problem).WithMany()
                .HasForeignKey(d => d.ProblemId)
                .HasConstraintName("FK_roadmap_items_problem");

            entity.HasOne(d => d.ProblemBank).WithMany()
                .HasForeignKey(d => d.ProblemBankId)
                .HasConstraintName("FK_roadmap_items_problem_bank");
        });

        modelBuilder.Entity<UserRoadmap>(entity =>
        {
            entity.ToTable("user_roadmaps");

            entity.HasKey(e => new { e.UserId, e.RoadmapId });

            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.RoadmapId).HasColumnName("roadmap_id");
            entity.Property(e => e.StartedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("started_at");
            entity.Property(e => e.CompletedAt).HasColumnName("completed_at");
            entity.Property(e => e.LastActivityAt).HasColumnName("last_activity_at");

            entity.HasOne(d => d.User).WithMany(p => p.UserRoadmaps)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_user_roadmaps_user");

            entity.HasOne(d => d.Roadmap).WithMany(p => p.UserRoadmaps)
                .HasForeignKey(d => d.RoadmapId)
                .HasConstraintName("FK_user_roadmaps_roadmap");
        });
    }
}
