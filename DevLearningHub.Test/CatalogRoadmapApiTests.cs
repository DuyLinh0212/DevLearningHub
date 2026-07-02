using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class CatalogRoadmapApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public CatalogRoadmapApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task TagsCrud_WithModeratorRole_ShouldCreateUpdateAndDeleteTag()
    {
        // Arrange
        var moderatorId = Guid.NewGuid();
        await _factory.EnsureUserAsync(moderatorId, "tag_moderator", "Moderator");
        using var client = _factory.CreateAuthenticatedClient(moderatorId, "Moderator");

        // Act
        var createResponse = await client.PostAsJsonAsync("/api/tags", new
        {
            name = $"Tag Test {Guid.NewGuid():N}",
            colorHex = "22c55e"
        });

        // Assert
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        using var createDocument = await ReadDocumentAsync(createResponse);
        var tagId = createDocument.RootElement.GetProperty("data").GetProperty("id").GetGuid();
        Assert.Equal("#22c55e", createDocument.RootElement.GetProperty("data").GetProperty("colorHex").GetString());

        // Act
        var updateResponse = await client.PutAsJsonAsync($"/api/tags/{tagId}", new
        {
            name = $"Tag Updated {Guid.NewGuid():N}",
            colorHex = "#ef4444"
        });
        var deleteResponse = await client.DeleteAsync($"/api/tags/{tagId}");

        // Assert
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task CreateTag_WithNormalUser_ShouldReturnForbidden()
    {
        // Arrange
        var userId = Guid.NewGuid();
        await _factory.EnsureUserAsync(userId, "tag_normal_user");
        using var client = _factory.CreateAuthenticatedClient(userId, "User");

        // Act
        var response = await client.PostAsJsonAsync("/api/tags", new
        {
            name = "Forbidden Tag",
            colorHex = "#6366f1"
        });

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task TopicsCrud_WithAdminRole_ShouldCreateUpdateSoftDeleteAndIncludeInactiveForAdmin()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "topic_admin", "Admin");
        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin");

        // Act
        var createResponse = await client.PostAsJsonAsync("/api/topics", new
        {
            name = $"Topic Test {Guid.NewGuid():N}",
            description = "Topic created by test",
            icon = "code"
        });

        // Assert
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        using var createDocument = await ReadDocumentAsync(createResponse);
        var topicId = createDocument.RootElement.GetProperty("data").GetProperty("id").GetGuid();

        // Act
        var updateResponse = await client.PutAsJsonAsync($"/api/topics/{topicId}", new
        {
            name = $"Topic Updated {Guid.NewGuid():N}",
            slug = "topic-updated-by-test",
            description = "Updated topic",
            icon = "updated",
            isActive = true
        });
        var deleteResponse = await client.DeleteAsync($"/api/topics/{topicId}");
        var includeInactiveResponse = await client.GetAsync("/api/topics?includeInactive=true");

        // Assert
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, includeInactiveResponse.StatusCode);
        using var includeDocument = await ReadDocumentAsync(includeInactiveResponse);
        Assert.Contains(includeDocument.RootElement.GetProperty("data").EnumerateArray(),
            topic => topic.GetProperty("id").GetGuid() == topicId && !topic.GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task RoadmapCrud_WithAdminRole_ShouldManageRoadmapTopics()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "roadmap_admin", "Admin");
        var topicId = await SeedTopicAsync();
        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin");

        // Act
        var createResponse = await client.PostAsJsonAsync("/api/roadmaps", new
        {
            title = $"Roadmap Test {Guid.NewGuid():N}",
            level = "beginner",
            description = "Roadmap created by test",
            targetRole = "Tester"
        });

        // Assert
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        using var createDocument = await ReadDocumentAsync(createResponse);
        var roadmapId = createDocument.RootElement.GetProperty("data").GetProperty("id").GetGuid();

        // Act
        var addTopicResponse = await client.PostAsJsonAsync($"/api/roadmaps/{roadmapId}/topics", new
        {
            topicId,
            orderIndex = 1
        });
        var duplicateResponse = await client.PostAsJsonAsync($"/api/roadmaps/{roadmapId}/topics", new
        {
            topicId,
            orderIndex = 2
        });
        var removeTopicResponse = await client.DeleteAsync($"/api/roadmaps/{roadmapId}/topics/{topicId}");
        var deleteResponse = await client.DeleteAsync($"/api/roadmaps/{roadmapId}");

        // Assert
        Assert.Equal(HttpStatusCode.OK, addTopicResponse.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, removeTopicResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
    }

    private async Task<Guid> SeedTopicAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var topic = new Topic
        {
            Id = Guid.NewGuid(),
            Name = $"Roadmap Topic {Guid.NewGuid():N}",
            Slug = $"roadmap-topic-{Guid.NewGuid():N}",
            Description = "Topic for roadmap tests",
            Icon = "roadmap",
            IsActive = true
        };

        db.Topics.Add(topic);
        await db.SaveChangesAsync();
        return topic.Id;
    }

    private static async Task<JsonDocument> ReadDocumentAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }
}
