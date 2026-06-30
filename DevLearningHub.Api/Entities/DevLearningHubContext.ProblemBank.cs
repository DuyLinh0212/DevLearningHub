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
            entity.Property(e => e.TopicId).HasColumnName("topic_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(d => d.CreatedByNavigation).WithMany()
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_problem_banks_user");

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
    }
}
