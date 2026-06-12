using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class UsersApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public UsersApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetMe_WithValidToken_ShouldReturnCurrentUserProfile()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "profileuser01",
            email: "profileuser01@gmail.com",
            fullName: "Profile User 01");

        var response = await SendWithBearerAsync(HttpMethod.Get, "/api/users/me", auth.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        Assert.True(root.GetProperty("success").GetBoolean());

        var data = root.GetProperty("data");

        Assert.Equal(auth.UserId, data.GetProperty("id").GetGuid());
        Assert.Equal("profileuser01", data.GetProperty("username").GetString());
        Assert.Equal("profileuser01@gmail.com", data.GetProperty("email").GetString());
        Assert.Equal("Profile User 01", data.GetProperty("fullName").GetString());
        Assert.Equal(0, data.GetProperty("xpPoints").GetInt32());
    }

    [Fact]
    public async Task GetMe_WithoutToken_ShouldReturnUnauthorized()
    {
        var response = await _client.GetAsync("/api/users/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdateMe_WithValidToken_ShouldReturnUpdatedProfile()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "updateprofile01",
            email: "updateprofile01@gmail.com",
            fullName: "Before Update");

        var request = new
        {
            fullName = "After Update",
            avatarUrl = "https://example.com/avatar.png"
        };

        var response = await SendWithBearerAsync(HttpMethod.Put, "/api/users/me", auth.AccessToken, request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        Assert.True(root.GetProperty("success").GetBoolean());
        Assert.Equal("Profile updated.", root.GetProperty("message").GetString());

        var data = root.GetProperty("data");

        Assert.Equal(auth.UserId, data.GetProperty("id").GetGuid());
        Assert.Equal("After Update", data.GetProperty("fullName").GetString());
        Assert.Equal("https://example.com/avatar.png", data.GetProperty("avatarUrl").GetString());
    }

    [Fact]
    public async Task GetStats_WithExistingUser_ShouldReturnQuizStatistics()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "statsuser01",
            email: "statsuser01@gmail.com",
            fullName: "Stats User 01");

        await SeedCompletedQuizSessionsAsync(auth.UserId);

        var response = await SendWithBearerAsync(HttpMethod.Get, $"/api/users/{auth.UserId}/stats", auth.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        Assert.True(root.GetProperty("success").GetBoolean());

        var data = root.GetProperty("data");

        Assert.Equal(auth.UserId, data.GetProperty("userId").GetGuid());
        Assert.Equal(2, data.GetProperty("totalQuizTaken").GetInt32());
        Assert.Equal(450, data.GetProperty("totalXP").GetInt32());
        Assert.Equal(0.75, data.GetProperty("avgScore").GetDouble());
        Assert.True(data.GetProperty("rank").GetInt32() >= 1);
    }

    [Fact]
    public async Task GetLeaderboard_WithValidToken_ShouldReturnActiveUsersByXp()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "leaderauth01",
            email: "leaderauth01@gmail.com",
            fullName: "Leader Auth 01");

        var leaderId = await SeedLeaderboardUserAsync();

        var response = await SendWithBearerAsync(HttpMethod.Get, "/api/users/leaderboard?top=1", auth.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        Assert.True(root.GetProperty("success").GetBoolean());

        var data = root.GetProperty("data");

        Assert.Equal(JsonValueKind.Array, data.ValueKind);
        Assert.Single(data.EnumerateArray());

        var first = data[0];

        Assert.Equal(1, first.GetProperty("rank").GetInt32());
        Assert.Equal(leaderId, first.GetProperty("userId").GetGuid());
        Assert.Equal("leaderboard_max_01", first.GetProperty("username").GetString());
        Assert.Equal(10000, first.GetProperty("xp").GetInt32());
    }

    [Fact]
    public async Task AdminGetAll_WithAdminToken_ShouldReturnPagedUsers()
    {
        var adminAuth = await RegisterAdminAndGetAuthAsync(
            username: "adminlist01",
            email: "adminlist01@gmail.com",
            fullName: "Admin List 01");

        var response = await SendWithBearerAsync(HttpMethod.Get, "/api/admin/users?page=1&pageSize=10", adminAuth.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        Assert.True(root.GetProperty("success").GetBoolean());

        var data = root.GetProperty("data");

        Assert.True(data.GetProperty("items").ValueKind == JsonValueKind.Array);
        Assert.True(data.GetProperty("totalCount").GetInt32() >= 1);
        Assert.Equal(1, data.GetProperty("page").GetInt32());
        Assert.Equal(10, data.GetProperty("pageSize").GetInt32());
        Assert.True(data.TryGetProperty("totalPages", out _));
    }

    [Fact]
    public async Task AdminGetAll_WithNormalUserToken_ShouldReturnForbidden()
    {
        var userAuth = await RegisterAndGetAuthAsync(
            username: "normaladminaccess01",
            email: "normaladminaccess01@gmail.com",
            fullName: "Normal Admin Access 01");

        var response = await SendWithBearerAsync(HttpMethod.Get, "/api/admin/users", userAuth.AccessToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AdminGetAll_WithoutToken_ShouldReturnUnauthorized()
    {
        var response = await _client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Lock_WithAdminTokenAndDifferentUser_ShouldReturnOkAndLockedTrue()
    {
        var adminAuth = await RegisterAdminAndGetAuthAsync(
            username: "adminlock01",
            email: "adminlock01@gmail.com",
            fullName: "Admin Lock 01");

        var targetAuth = await RegisterAndGetAuthAsync(
            username: "locktarget01",
            email: "locktarget01@gmail.com",
            fullName: "Lock Target 01");

        var request = new
        {
            reason = "Test lock reason"
        };

        var response = await SendWithBearerAsync(
            HttpMethod.Patch,
            $"/api/admin/users/{targetAuth.UserId}/lock",
            adminAuth.AccessToken,
            request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        Assert.True(root.GetProperty("success").GetBoolean());
        Assert.Equal("User locked.", root.GetProperty("message").GetString());
        Assert.True(root.GetProperty("data").GetProperty("locked").GetBoolean());
    }

    [Fact]
    public async Task Lock_WithAdminTokenAndSelfUser_ShouldReturnBadRequest()
    {
        var adminAuth = await RegisterAdminAndGetAuthAsync(
            username: "adminselflock01",
            email: "adminselflock01@gmail.com",
            fullName: "Admin Self Lock 01");

        var request = new
        {
            reason = "Self lock should fail"
        };

        var response = await SendWithBearerAsync(
            HttpMethod.Patch,
            $"/api/admin/users/{adminAuth.UserId}/lock",
            adminAuth.AccessToken,
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        Assert.False(root.GetProperty("success").GetBoolean());
        Assert.Equal("You cannot lock your own account.", root.GetProperty("message").GetString());
    }

    private async Task<AuthTestData> RegisterAndGetAuthAsync(string username, string email, string fullName)
    {
        var request = new
        {
            username,
            email,
            password = "123456",
            fullName
        };

        var response = await _client.PostAsJsonAsync("/api/auth/register", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        return await ReadAuthDataAsync(response);
    }

    private async Task<AuthTestData> RegisterAdminAndGetAuthAsync(string username, string email, string fullName)
    {
        var registered = await RegisterAndGetAuthAsync(username, email, fullName);

        await SeedAdminRoleAsync(registered.UserId);

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            usernameOrEmail = email,
            password = "123456"
        });

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        return await ReadAuthDataAsync(loginResponse);
    }

    private async Task SeedAdminRoleAsync(Guid userId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var role = db.Roles.FirstOrDefault(r => r.Name == "Admin");
        if (role == null)
        {
            role = new Role
            {
                Id = Guid.NewGuid(),
                Name = "Admin",
                Description = "Administrator",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            db.Roles.Add(role);
            await db.SaveChangesAsync();
        }

        var alreadyAssigned = db.UserRoles.Any(ur => ur.UserId == userId && ur.RoleId == role.Id);
        if (!alreadyAssigned)
        {
            db.UserRoles.Add(new UserRole
            {
                UserId = userId,
                RoleId = role.Id,
                AssignedAt = DateTime.UtcNow
            });

            await db.SaveChangesAsync();
        }
    }

    private async Task SeedCompletedQuizSessionsAsync(Guid userId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        db.QuizSessions.AddRange(
            new QuizSession
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                QuizSetId = Guid.NewGuid(),
                Score = 3,
                TotalQuestions = 4,
                TimeTakenSeconds = 60,
                Status = "completed",
                StartedAt = DateTime.UtcNow.AddMinutes(-10),
                EndedAt = DateTime.UtcNow.AddMinutes(-9)
            },
            new QuizSession
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                QuizSetId = Guid.NewGuid(),
                Score = 6,
                TotalQuestions = 8,
                TimeTakenSeconds = 120,
                Status = "completed",
                StartedAt = DateTime.UtcNow.AddMinutes(-8),
                EndedAt = DateTime.UtcNow.AddMinutes(-6)
            },
            new QuizSession
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                QuizSetId = Guid.NewGuid(),
                Score = null,
                TotalQuestions = 4,
                Status = "in_progress",
                StartedAt = DateTime.UtcNow
            });

        await db.SaveChangesAsync();
    }

    private async Task<Guid> SeedLeaderboardUserAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var existing = db.Users.FirstOrDefault(u => u.Username == "leaderboard_max_01");
        if (existing != null)
        {
            existing.IsActive = true;
            db.QuizSessions.RemoveRange(db.QuizSessions.Where(session => session.UserId == existing.Id));
            db.QuizSessions.Add(new QuizSession
            {
                Id = Guid.NewGuid(),
                UserId = existing.Id,
                QuizSetId = Guid.NewGuid(),
                Score = 200,
                TotalQuestions = 200,
                Status = "completed",
                StartedAt = DateTime.UtcNow.AddMinutes(-2),
                EndedAt = DateTime.UtcNow.AddMinutes(-1)
            });
            await db.SaveChangesAsync();
            return existing.Id;
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "leaderboard_max_01",
            Email = "leaderboard_max_01@gmail.com",
            PasswordHash = "not-used-in-this-test",
            FullName = "Leaderboard Max 01",
            XpPoints = 0,
            IsActive = true,
            IsLocked = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Users.Add(user);
        db.QuizSessions.Add(new QuizSession
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            QuizSetId = Guid.NewGuid(),
            Score = 200,
            TotalQuestions = 200,
            Status = "completed",
            StartedAt = DateTime.UtcNow.AddMinutes(-2),
            EndedAt = DateTime.UtcNow.AddMinutes(-1)
        });
        await db.SaveChangesAsync();

        return user.Id;
    }

    private static async Task<AuthTestData> ReadAuthDataAsync(HttpResponseMessage response)
    {
        using var document = await ReadDocumentAsync(response);
        var data = document.RootElement.GetProperty("data");
        var user = data.GetProperty("user");

        return new AuthTestData(
            data.GetProperty("accessToken").GetString()!,
            data.GetProperty("refreshToken").GetString()!,
            user.GetProperty("id").GetGuid());
    }

    private static async Task<JsonDocument> ReadDocumentAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }

    private async Task<HttpResponseMessage> SendWithBearerAsync(
        HttpMethod method,
        string requestUri,
        string accessToken,
        object? body = null)
    {
        using var request = new HttpRequestMessage(method, requestUri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await _client.SendAsync(request);
    }

    private sealed record AuthTestData(string AccessToken, string RefreshToken, Guid UserId);
}
