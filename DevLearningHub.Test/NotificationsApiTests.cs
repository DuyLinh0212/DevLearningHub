using System.Net;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class NotificationsApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public NotificationsApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetNotifications_WithUnreadOnly_ShouldReturnCurrentUserUnreadItems()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        await _factory.EnsureUserAsync(userId, "notification_user");
        await _factory.EnsureUserAsync(otherUserId, "notification_other");
        var unreadId = await SeedNotificationAsync(userId, "Unread message", isRead: false);
        await SeedNotificationAsync(userId, "Read message", isRead: true);
        await SeedNotificationAsync(otherUserId, "Other user message", isRead: false);
        using var client = _factory.CreateAuthenticatedClient(userId);

        // Act
        var response = await client.GetAsync("/api/notifications?unreadOnly=true&page=1&pageSize=10");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var data = document.RootElement.GetProperty("data");
        var items = data.GetProperty("items").EnumerateArray().ToList();

        Assert.Equal(1, data.GetProperty("totalCount").GetInt32());
        Assert.Equal(1, data.GetProperty("unreadCount").GetInt32());
        Assert.Single(items);
        Assert.Equal(unreadId, items[0].GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task MarkAsRead_ThenUnreadCount_ShouldUpdateNotificationState()
    {
        // Arrange
        var userId = Guid.NewGuid();
        await _factory.EnsureUserAsync(userId, "notification_reader");
        var notificationId = await SeedNotificationAsync(userId, "Needs reading", isRead: false);
        using var client = _factory.CreateAuthenticatedClient(userId);

        // Act
        var readResponse = await client.PostAsync($"/api/notifications/{notificationId}/read", null);
        var countResponse = await client.GetAsync("/api/notifications/unread-count");

        // Assert
        Assert.Equal(HttpStatusCode.OK, readResponse.StatusCode);
        using var readDocument = await ReadDocumentAsync(readResponse);
        Assert.True(readDocument.RootElement.GetProperty("data").GetProperty("isRead").GetBoolean());
        Assert.Equal(0, readDocument.RootElement.GetProperty("data").GetProperty("unreadCount").GetInt32());

        Assert.Equal(HttpStatusCode.OK, countResponse.StatusCode);
        using var countDocument = await ReadDocumentAsync(countResponse);
        Assert.Equal(0, countDocument.RootElement.GetProperty("data").GetProperty("unreadCount").GetInt32());
    }

    [Fact]
    public async Task MarkAsRead_WithOtherUsersNotification_ShouldReturnNotFound()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        await _factory.EnsureUserAsync(userId, "notification_owner_a");
        await _factory.EnsureUserAsync(otherUserId, "notification_owner_b");
        var otherNotificationId = await SeedNotificationAsync(otherUserId, "Private notification", isRead: false);
        using var client = _factory.CreateAuthenticatedClient(userId);

        // Act
        var response = await client.PostAsync($"/api/notifications/{otherNotificationId}/read", null);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ReadAllAndClearAll_ShouldUpdateOnlyCurrentUsersNotifications()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        await _factory.EnsureUserAsync(userId, "notification_bulk_user");
        await _factory.EnsureUserAsync(otherUserId, "notification_bulk_other");
        await SeedNotificationAsync(userId, "Unread one", isRead: false);
        await SeedNotificationAsync(userId, "Unread two", isRead: false);
        await SeedNotificationAsync(otherUserId, "Other unread", isRead: false);
        using var client = _factory.CreateAuthenticatedClient(userId);

        // Act
        var readAllResponse = await client.PostAsync("/api/notifications/read-all", null);
        var clearAllResponse = await client.DeleteAsync("/api/notifications/clear-all");

        // Assert
        Assert.Equal(HttpStatusCode.OK, readAllResponse.StatusCode);
        using var readAllDocument = await ReadDocumentAsync(readAllResponse);
        Assert.Equal(2, readAllDocument.RootElement.GetProperty("data").GetProperty("updated").GetInt32());

        Assert.Equal(HttpStatusCode.OK, clearAllResponse.StatusCode);
        using var clearAllDocument = await ReadDocumentAsync(clearAllResponse);
        Assert.Equal(2, clearAllDocument.RootElement.GetProperty("data").GetProperty("deleted").GetInt32());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        Assert.False(await db.Notifications.AnyAsync(notification => notification.UserId == userId));
        Assert.True(await db.Notifications.AnyAsync(notification => notification.UserId == otherUserId));
    }

    [Fact]
    public async Task DeleteNotification_WithOwnNotification_ShouldRemoveOneItem()
    {
        // Arrange
        var userId = Guid.NewGuid();
        await _factory.EnsureUserAsync(userId, "notification_delete_user");
        var firstId = await SeedNotificationAsync(userId, "Delete me", isRead: false);
        await SeedNotificationAsync(userId, "Keep me", isRead: false);
        using var client = _factory.CreateAuthenticatedClient(userId);

        // Act
        var response = await client.DeleteAsync($"/api/notifications/{firstId}");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        Assert.True(document.RootElement.GetProperty("data").GetProperty("deleted").GetBoolean());
        Assert.Equal(1, document.RootElement.GetProperty("data").GetProperty("unreadCount").GetInt32());
    }

    private async Task<Guid> SeedNotificationAsync(Guid userId, string message, bool isRead)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = "test",
            Message = message,
            RefType = "test",
            RefId = Guid.NewGuid(),
            IsRead = isRead,
            CreatedAt = DateTime.Now
        };

        db.Notifications.Add(notification);
        await db.SaveChangesAsync();
        return notification.Id;
    }

    private static async Task<JsonDocument> ReadDocumentAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }
}
