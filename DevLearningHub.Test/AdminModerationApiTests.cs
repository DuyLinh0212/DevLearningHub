using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class AdminModerationApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AdminModerationApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetQueue_WithPendingPostsAndType_ShouldReturnOnlyMatchingPendingItems()
    {
        // Arrange
        var moderatorId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        await _factory.EnsureUserAsync(moderatorId, "moderation_queue_mod", "Admin");
        await _factory.EnsureUserAsync(authorId, "moderation_queue_author");
        var pendingPostId = await SeedPostAsync(authorId, "Pending post 9101", "pending");
        await SeedPostAsync(authorId, "Approved post 9101", "approved");
        using var client = _factory.CreateAuthenticatedClient(moderatorId, "Admin");

        // Act
        var response = await client.GetAsync("/api/admin/moderation/queue?type=post&status=pending");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var items = document.RootElement.GetProperty("data").EnumerateArray().ToList();

        Assert.Single(items);
        Assert.Equal(pendingPostId, items[0].GetProperty("id").GetGuid());
        Assert.Equal("post", items[0].GetProperty("type").GetString());
        Assert.Equal("pending", items[0].GetProperty("reviewStatus").GetString());
    }

    [Fact]
    public async Task GetQueue_WithoutModerationPermission_ShouldReturnForbidden()
    {
        // Arrange
        var userId = Guid.NewGuid();
        await _factory.EnsureUserAsync(userId, "moderation_queue_denied");
        using var client = _factory.CreateAuthenticatedClient(userId, "User");

        // Act
        var response = await client.GetAsync("/api/admin/moderation/queue?type=post&status=pending");

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Approve_WithPendingPost_ShouldUpdateReviewStatusAndWriteModerationLog()
    {
        // Arrange
        var moderatorId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        await _factory.EnsureUserAsync(moderatorId, "moderation_approve_mod", "Admin");
        await _factory.EnsureUserAsync(authorId, "moderation_approve_author");
        var postId = await SeedPostAsync(authorId, "Post awaiting approval 9102", "pending");
        using var client = _factory.CreateAuthenticatedClient(moderatorId, "Admin");

        // Act
        var response = await client.PostAsJsonAsync($"/api/admin/moderation/post/{postId}/approve", new
        {
            reason = (string?)null
        });

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var data = document.RootElement.GetProperty("data");
        Assert.Equal("approved", data.GetProperty("status").GetString());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var post = await db.Posts.SingleAsync(p => p.Id == postId);
        Assert.Equal("approved", post.ReviewStatus);
        Assert.Equal(moderatorId, post.ReviewedBy);

        Assert.True(await db.ModerationLogs.AnyAsync(log =>
            log.TargetType == "post" && log.TargetId == postId && log.Action == "approve"));
    }

    [Fact]
    public async Task Reject_WithReason_ShouldUpdateReviewStatusAndPersistReason()
    {
        // Arrange
        var moderatorId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        await _factory.EnsureUserAsync(moderatorId, "moderation_reject_mod", "Admin");
        await _factory.EnsureUserAsync(authorId, "moderation_reject_author");
        var postId = await SeedPostAsync(authorId, "Post awaiting rejection 9103", "pending");
        using var client = _factory.CreateAuthenticatedClient(moderatorId, "Admin");

        // Act
        var response = await client.PostAsJsonAsync($"/api/admin/moderation/post/{postId}/reject", new
        {
            reason = "Violates community guidelines"
        });

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var post = await db.Posts.SingleAsync(p => p.Id == postId);
        Assert.Equal("rejected", post.ReviewStatus);
        Assert.Equal("Violates community guidelines", post.ReviewNote);

        var log = await db.ModerationLogs.SingleAsync(l => l.TargetType == "post" && l.TargetId == postId);
        Assert.Equal("reject", log.Action);
        Assert.Equal("Violates community guidelines", log.Reason);
    }

    [Fact]
    public async Task Approve_WithUnknownType_ShouldReturnInternalServerError()
    {
        // Arrange
        var moderatorId = Guid.NewGuid();
        await _factory.EnsureUserAsync(moderatorId, "moderation_unknown_type_mod", "Admin");
        using var client = _factory.CreateAuthenticatedClient(moderatorId, "Admin");

        // Act
        var response = await client.PostAsJsonAsync($"/api/admin/moderation/comment/{Guid.NewGuid()}/approve", new
        {
            reason = (string?)null
        });

        // Assert
        // NormalizeType throws an uncaught ArgumentException for types outside the known set,
        // which the global exception handler converts to a 500 rather than the switch's dead-code 404 branch.
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    [Fact]
    public async Task Approve_WithUnknownPostId_ShouldReturnNotFound()
    {
        // Arrange
        var moderatorId = Guid.NewGuid();
        await _factory.EnsureUserAsync(moderatorId, "moderation_unknown_id_mod", "Admin");
        using var client = _factory.CreateAuthenticatedClient(moderatorId, "Admin");

        // Act
        var response = await client.PostAsJsonAsync($"/api/admin/moderation/post/{Guid.NewGuid()}/approve", new
        {
            reason = (string?)null
        });

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetLogs_WithTypeFilter_ShouldReturnOnlyMatchingModerationLogs()
    {
        // Arrange
        var moderatorId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        await _factory.EnsureUserAsync(moderatorId, "moderation_logs_mod", "Admin");
        await _factory.EnsureUserAsync(authorId, "moderation_logs_author");
        var postId = await SeedPostAsync(authorId, "Post for logs 9104", "pending");
        var problemId = await SeedProblemAsync(authorId, "Problem for logs 9104", "pending");
        using var client = _factory.CreateAuthenticatedClient(moderatorId, "Admin");

        await client.PostAsJsonAsync($"/api/admin/moderation/post/{postId}/approve", new { reason = (string?)null });
        await client.PostAsJsonAsync($"/api/admin/moderation/problem/{problemId}/reject", new { reason = "needs work" });

        // Act
        var response = await client.GetAsync("/api/admin/moderation/logs?type=post");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var items = document.RootElement.GetProperty("data").GetProperty("items").EnumerateArray().ToList();

        Assert.All(items, item => Assert.Equal("post", item.GetProperty("targetType").GetString()));
        Assert.Contains(items, item => item.GetProperty("targetId").GetGuid() == postId);
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

    private async Task<Guid> SeedProblemAsync(Guid createdBy, string title, string reviewStatus)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var topicId = Guid.NewGuid();
        db.Topics.Add(new Topic
        {
            Id = topicId,
            Name = $"Moderation Topic {topicId:N}",
            Slug = $"moderation-topic-{topicId:N}",
            IsActive = true
        });

        var problem = new Problem
        {
            Id = Guid.NewGuid(),
            TopicId = topicId,
            CreatedBy = createdBy,
            Title = title,
            Description = "Description",
            Difficulty = "easy",
            IsActive = false,
            ReviewStatus = reviewStatus,
            CreatedAt = DateTime.Now
        };

        db.Problems.Add(problem);
        await db.SaveChangesAsync();

        return problem.Id;
    }

    private static async Task<JsonDocument> ReadDocumentAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }
}
