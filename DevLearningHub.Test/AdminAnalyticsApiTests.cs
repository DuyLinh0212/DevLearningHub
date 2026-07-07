using System.Net;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class AdminAnalyticsApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AdminAnalyticsApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetQuizSetStats_WithCompletedAndInProgressSessions_ShouldReturnAggregatedStats()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        var learnerAId = Guid.NewGuid();
        var learnerBId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "analytics_quizstats_admin", "Admin");
        await _factory.EnsureUserAsync(learnerAId, "analytics_quizstats_learner_a");
        await _factory.EnsureUserAsync(learnerBId, "analytics_quizstats_learner_b");

        var quizSetId = await SeedQuizSetAsync(adminId, "Quiz set 9201");
        await SeedQuizSessionAsync(quizSetId, learnerAId, "completed", score: 8, totalQuestions: 10);
        await SeedQuizSessionAsync(quizSetId, learnerBId, "completed", score: 6, totalQuestions: 10);
        await SeedQuizSessionAsync(quizSetId, learnerBId, "in_progress", score: null, totalQuestions: 10);

        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "analytics:view");

        // Act
        var response = await client.GetAsync("/api/admin/analytics/quiz-sets");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var stats = document.RootElement.GetProperty("data").EnumerateArray()
            .Single(item => item.GetProperty("quizSetId").GetGuid() == quizSetId);

        Assert.Equal(3, stats.GetProperty("totalAttempts").GetInt32());
        Assert.Equal(2, stats.GetProperty("completedAttempts").GetInt32());
        Assert.Equal(2, stats.GetProperty("participantCount").GetInt32());
        Assert.Equal(7, stats.GetProperty("averageScore").GetDouble());
    }

    [Fact]
    public async Task GetQuizSetStats_WithoutAnalyticsPermission_ShouldReturnForbidden()
    {
        // Arrange
        var userId = Guid.NewGuid();
        await _factory.EnsureUserAsync(userId, "analytics_quizstats_denied");
        using var client = _factory.CreateAuthenticatedClient(userId, "User");

        // Act
        var response = await client.GetAsync("/api/admin/analytics/quiz-sets");

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetQuizSetParticipants_WithMultipleAttempts_ShouldReturnBestScorePerParticipant()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        var learnerId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "analytics_participants_admin", "Admin");
        await _factory.EnsureUserAsync(learnerId, "analytics_participants_learner");

        var quizSetId = await SeedQuizSetAsync(adminId, "Quiz set 9202");
        await SeedQuizSessionAsync(quizSetId, learnerId, "completed", score: 4, totalQuestions: 10);
        await SeedQuizSessionAsync(quizSetId, learnerId, "completed", score: 9, totalQuestions: 10);

        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "analytics:view");

        // Act
        var response = await client.GetAsync($"/api/admin/analytics/quiz-sets/{quizSetId}/participants");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var participant = document.RootElement.GetProperty("data").EnumerateArray().Single();

        Assert.Equal(learnerId, participant.GetProperty("userId").GetGuid());
        Assert.Equal(2, participant.GetProperty("attemptsCount").GetInt32());
        Assert.Equal(2, participant.GetProperty("completedAttempts").GetInt32());
        Assert.Equal(9, participant.GetProperty("bestScore").GetInt32());
    }

    [Fact]
    public async Task GetQuizSetParticipants_WithUnknownQuizSet_ShouldReturnNotFound()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "analytics_participants_missing_admin", "Admin");
        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "analytics:view");

        // Act
        var response = await client.GetAsync($"/api/admin/analytics/quiz-sets/{Guid.NewGuid()}/participants");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetProblemBankStats_WithSubmissions_ShouldReturnCompletionAndAccuracyPercentages()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        var learnerId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "analytics_bankstats_admin", "Admin");
        await _factory.EnsureUserAsync(learnerId, "analytics_bankstats_learner");

        var (bankId, problemId) = await SeedProblemBankWithProblemAsync(adminId, "Problem bank 9203");
        await SeedSubmissionAsync(learnerId, problemId, "accepted", passedCases: 10, totalCases: 10);

        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "analytics:view");

        // Act
        var response = await client.GetAsync("/api/admin/analytics/problem-banks");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var stats = document.RootElement.GetProperty("data").EnumerateArray()
            .Single(item => item.GetProperty("bankId").GetGuid() == bankId);

        Assert.Equal(1, stats.GetProperty("problemCount").GetInt32());
        Assert.Equal(1, stats.GetProperty("participantCount").GetInt32());
        Assert.Equal(100, stats.GetProperty("averageCompletionPercent").GetDouble());
        Assert.Equal(1, stats.GetProperty("solvedSubmissionCount").GetInt32());
    }

    [Fact]
    public async Task GetModeratorDashboard_ShouldReturnPendingAndTotalCounts()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "analytics_dashboard_admin", "Admin");
        await _factory.EnsureUserAsync(authorId, "analytics_dashboard_author");
        await SeedPostAsync(authorId, "Pending dashboard post 9204", "pending");
        await SeedPostAsync(authorId, "Approved dashboard post 9204", "approved");

        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "analytics:view");

        // Act
        var response = await client.GetAsync("/api/admin/analytics/moderator-dashboard");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var data = document.RootElement.GetProperty("data");

        Assert.True(data.GetProperty("pendingPosts").GetInt32() >= 1);
        Assert.True(data.GetProperty("totalPosts").GetInt32() >= 2);
    }

    private async Task<Guid> SeedPostAsync(Guid authorId, string title, string reviewStatus)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var post = new Post
        {
            Id = Guid.NewGuid(),
            AuthorId = authorId,
            Title = title,
            BodyMarkdown = "Body",
            Upvotes = 0,
            Downvotes = 0,
            ViewCount = 0,
            IsHidden = false,
            ReviewStatus = reviewStatus,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        db.Posts.Add(post);
        await db.SaveChangesAsync();

        return post.Id;
    }

    private async Task<Guid> SeedQuizSetAsync(Guid createdBy, string title)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var quizSet = new QuizSet
        {
            Id = Guid.NewGuid(),
            CreatedBy = createdBy,
            Title = title,
            Mode = "practice",
            IsPublic = true,
            ReviewStatus = "approved",
            CreatedAt = DateTime.Now
        };

        db.QuizSets.Add(quizSet);
        await db.SaveChangesAsync();

        return quizSet.Id;
    }

    private async Task SeedQuizSessionAsync(Guid quizSetId, Guid userId, string status, short? score, short totalQuestions)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        db.QuizSessions.Add(new QuizSession
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            QuizSetId = quizSetId,
            Score = score,
            TotalQuestions = totalQuestions,
            Status = status,
            StartedAt = DateTime.Now,
            EndedAt = status == "completed" ? DateTime.Now : null
        });

        await db.SaveChangesAsync();
    }

    private async Task<(Guid BankId, Guid ProblemId)> SeedProblemBankWithProblemAsync(Guid createdBy, string title)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var topicId = Guid.NewGuid();
        db.Topics.Add(new Topic
        {
            Id = topicId,
            Name = $"Analytics Topic {topicId:N}",
            Slug = $"analytics-topic-{topicId:N}",
            IsActive = true
        });

        var bankId = Guid.NewGuid();
        db.ProblemBanks.Add(new ProblemBank
        {
            Id = bankId,
            CreatedBy = createdBy,
            Title = title,
            IsPublic = true,
            ReviewStatus = "approved",
            TopicId = topicId,
            CreatedAt = DateTime.Now
        });

        var problemId = Guid.NewGuid();
        db.Problems.Add(new Problem
        {
            Id = problemId,
            TopicId = topicId,
            CreatedBy = createdBy,
            Title = "Analytics problem",
            Description = "Description",
            Difficulty = "easy",
            IsActive = true,
            ReviewStatus = "approved",
            CreatedAt = DateTime.Now
        });

        db.ProblemBankItems.Add(new ProblemBankItem
        {
            BankId = bankId,
            ProblemId = problemId,
            AddedAt = DateTime.Now
        });

        await db.SaveChangesAsync();

        return (bankId, problemId);
    }

    private async Task SeedSubmissionAsync(Guid userId, Guid problemId, string verdict, short passedCases, short totalCases)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        db.Submissions.Add(new Submission
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ProblemId = problemId,
            Code = "print('hi')",
            Language = "python",
            Verdict = verdict,
            PassedCases = passedCases,
            TotalCases = totalCases,
            SubmittedAt = DateTime.Now
        });

        await db.SaveChangesAsync();
    }

    private static async Task<JsonDocument> ReadDocumentAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }
}
