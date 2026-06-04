using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class AuthApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string DefaultPassword = "123456";

    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public AuthApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_WithValidData_ShouldReturnOkAndToken()
    {
        var response = await RegisterAsync(
            username: "testuser01",
            email: "testuser01@gmail.com",
            fullName: "Test User"
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = await ReadRootAsync(response);

        AssertSuccess(root);

        var data = root.GetProperty("data");

        AssertAuthDataHasTokens(data);
        AssertUser(data, "testuser01", "testuser01@gmail.com", "Test User");
    }

    [Fact]
    public async Task Register_WithValidData_ShouldAssignDefaultUserRole()
    {
        var response = await RegisterAsync(
            username: "defaultroleuser01",
            email: "defaultroleuser01@gmail.com",
            fullName: "Default Role User"
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = await ReadRootAsync(response);
        AssertSuccess(root);

        var userId = root
            .GetProperty("data")
            .GetProperty("user")
            .GetProperty("id")
            .GetGuid();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var userRole = await db.UserRoles
            .Include(ur => ur.Role)
            .SingleOrDefaultAsync(ur => ur.UserId == userId);

        Assert.NotNull(userRole);
        Assert.Equal("user", userRole!.Role.Name);
        Assert.True(userRole.Role.IsActive);
    }

    [Fact]
    public async Task Register_WithDuplicateUsernameOrEmail_ShouldReturnConflict()
    {
        var firstResponse = await RegisterAsync(
            username: "duplicateuser",
            email: "duplicate@gmail.com",
            fullName: "Duplicate User"
        );

        var secondResponse = await RegisterAsync(
            username: "duplicateuser",
            email: "duplicate@gmail.com",
            fullName: "Duplicate User"
        );

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);

        var root = await ReadRootAsync(secondResponse);

        AssertFail(root, "already exists");
    }

    [Fact]
    public async Task Login_WithCorrectUsernameOrEmailAndPassword_ShouldReturnOkAndToken()
    {
        await RegisterAsync(
            username: "loginuser01",
            email: "loginuser01@gmail.com",
            fullName: "Login User"
        );

        var response = await LoginAsync(
            usernameOrEmail: "loginuser01@gmail.com",
            password: DefaultPassword
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = await ReadRootAsync(response);

        AssertSuccess(root);

        var data = root.GetProperty("data");

        AssertAuthDataHasTokens(data);
        AssertUser(data, "loginuser01", "loginuser01@gmail.com", "Login User");
    }

    [Fact]
    public async Task Login_WithIncorrectPasswordOrUsername_ShouldReturnUnauthorized()
    {
        await RegisterAsync(
            username: "wrongloginuser01",
            email: "wrongloginuser01@gmail.com",
            fullName: "Wrong Login User"
        );

        var response = await LoginAsync(
            usernameOrEmail: "wrongloginuser01@gmail.com",
            password: "wrongpassword"
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var root = await ReadRootAsync(response);

        AssertFail(root, "Invalid credentials.");
    }

    [Fact]
    public async Task Refresh_WithValidRefreshToken_ShouldReturnOkAndNewTokens()
    {
        var oldRefreshToken = await RegisterAndGetRefreshTokenAsync(
            username: "refreshuser01",
            email: "refreshuser01@gmail.com",
            fullName: "Refresh User"
        );

        var response = await RefreshAsync(oldRefreshToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = await ReadRootAsync(response);

        AssertSuccess(root);

        var data = root.GetProperty("data");

        AssertAuthDataHasTokens(data);

        var newRefreshToken = data.GetProperty("refreshToken").GetString();

        Assert.NotEqual(oldRefreshToken, newRefreshToken);
    }

    [Fact]
    public async Task Refresh_WithOldRefreshTokenAfterRotation_ShouldReturnUnauthorized()
    {
        var oldRefreshToken = await RegisterAndGetRefreshTokenAsync(
            username: "refreshuser02",
            email: "refreshuser02@gmail.com",
            fullName: "Refresh User 02"
        );

        var firstRefreshResponse = await RefreshAsync(oldRefreshToken);
        Assert.Equal(HttpStatusCode.OK, firstRefreshResponse.StatusCode);

        var secondRefreshResponse = await RefreshAsync(oldRefreshToken);

        Assert.Equal(HttpStatusCode.Unauthorized, secondRefreshResponse.StatusCode);

        var root = await ReadRootAsync(secondRefreshResponse);

        AssertFail(root, "Refresh token is invalid or expired.");
    }

    [Fact]
    public async Task Logout_WithValidRefreshToken_ShouldReturnOkAndRevokedTrue()
    {
        var refreshToken = await RegisterAndGetRefreshTokenAsync(
            username: "logoutuser01",
            email: "logoutuser01@gmail.com",
            fullName: "Logout User"
        );

        var response = await LogoutAsync(refreshToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = await ReadRootAsync(response);

        AssertSuccess(root);

        var data = root.GetProperty("data");

        Assert.True(data.GetProperty("revoked").GetBoolean());
    }

    [Fact]
    public async Task Logout_WithAlreadyRevokedRefreshToken_ShouldReturnOkAndRevokedFalse()
    {
        var refreshToken = await RegisterAndGetRefreshTokenAsync(
            username: "logoutuser02",
            email: "logoutuser02@gmail.com",
            fullName: "Logout User 02"
        );

        var firstLogoutResponse = await LogoutAsync(refreshToken);
        Assert.Equal(HttpStatusCode.OK, firstLogoutResponse.StatusCode);

        var secondLogoutResponse = await LogoutAsync(refreshToken);

        Assert.Equal(HttpStatusCode.OK, secondLogoutResponse.StatusCode);

        var root = await ReadRootAsync(secondLogoutResponse);

        AssertSuccess(root);

        var data = root.GetProperty("data");

        Assert.False(data.GetProperty("revoked").GetBoolean());
        Assert.Equal("Token already revoked.", root.GetProperty("message").GetString());
    }

    // =========================
    // Helper methods
    // =========================

    private async Task<HttpResponseMessage> RegisterAsync(
        string username,
        string email,
        string fullName,
        string password = DefaultPassword)
    {
        var request = new
        {
            username,
            email,
            password,
            fullName
        };

        return await _client.PostAsJsonAsync("/api/auth/register", request);
    }

    private async Task<HttpResponseMessage> LoginAsync(
        string usernameOrEmail,
        string password)
    {
        var request = new
        {
            usernameOrEmail,
            password
        };

        return await _client.PostAsJsonAsync("/api/auth/login", request);
    }

    private async Task<HttpResponseMessage> RefreshAsync(string refreshToken)
    {
        var request = new
        {
            refreshToken
        };

        return await _client.PostAsJsonAsync("/api/auth/refresh", request);
    }

    private async Task<HttpResponseMessage> LogoutAsync(string refreshToken)
    {
        var request = new
        {
            refreshToken
        };

        return await _client.PostAsJsonAsync("/api/auth/logout", request);
    }

    private async Task<string> RegisterAndGetRefreshTokenAsync(
        string username,
        string email,
        string fullName)
    {
        var response = await RegisterAsync(username, email, fullName);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = await ReadRootAsync(response);

        AssertSuccess(root);

        var refreshToken = root
            .GetProperty("data")
            .GetProperty("refreshToken")
            .GetString();

        Assert.False(string.IsNullOrWhiteSpace(refreshToken));

        return refreshToken!;
    }

    private static async Task<JsonElement> ReadRootAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();

        using var document = JsonDocument.Parse(json);

        return document.RootElement.Clone();
    }

    private static void AssertSuccess(JsonElement root)
    {
        Assert.True(root.GetProperty("success").GetBoolean());
    }

    private static void AssertFail(JsonElement root, string expectedMessage)
    {
        Assert.False(root.GetProperty("success").GetBoolean());
        Assert.Contains(expectedMessage, root.GetProperty("message").GetString());
    }

    private static void AssertAuthDataHasTokens(JsonElement data)
    {
        var accessToken = data.GetProperty("accessToken").GetString();
        var refreshToken = data.GetProperty("refreshToken").GetString();

        Assert.False(string.IsNullOrWhiteSpace(accessToken));
        Assert.False(string.IsNullOrWhiteSpace(refreshToken));
        Assert.True(data.TryGetProperty("expiresAt", out _));
    }

    private static void AssertUser(
        JsonElement data,
        string expectedUsername,
        string expectedEmail,
        string expectedFullName)
    {
        var user = data.GetProperty("user");

        Assert.Equal(expectedUsername, user.GetProperty("username").GetString());
        Assert.Equal(expectedEmail, user.GetProperty("email").GetString());
        Assert.Equal(expectedFullName, user.GetProperty("fullName").GetString());
    }
}
