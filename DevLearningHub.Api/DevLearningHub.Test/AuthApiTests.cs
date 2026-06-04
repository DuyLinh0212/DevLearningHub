using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DevLearningHub.Test.Factories;
using Xunit;

namespace DevLearningHub.Test;

public class AuthApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AuthApiTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_WithValidData_ShouldReturnOkAndToken()
    {
        var request = new
        {
            username = "testuser01",
            email = "testuser01@gmail.com",
            password = "123456",
            fullName = "Test User"
        };

        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.True(root.GetProperty("success").GetBoolean());

        var data = root.GetProperty("data");

        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("accessToken").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("refreshToken").GetString()));
        Assert.True(data.TryGetProperty("expiresAt", out _));

        var user = data.GetProperty("user");

        Assert.Equal("testuser01", user.GetProperty("username").GetString());
        Assert.Equal("testuser01@gmail.com", user.GetProperty("email").GetString());
        Assert.Equal("Test User", user.GetProperty("fullName").GetString());
    }

    [Fact]
    public async Task Register_WithDuplicateUsernameOrEmail_ShouldReturnConflict()
    {
        var request = new
        {
            username = "duplicateuser",
            email = "duplicate@gmail.com",
            password = "123456",
            fullName = "Duplicate User"
        };

        var firstResponse = await _client.PostAsJsonAsync("/api/auth/register", request);
        var secondResponse = await _client.PostAsJsonAsync("/api/auth/register", request);

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);

        var json = await secondResponse.Content.ReadAsStringAsync();

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.False(root.GetProperty("success").GetBoolean());
        Assert.Contains("already exists", root.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Login_WithCorrectUsernameOrEmailAndPassword_ShouldReturnOkAndToken()
    {
        // Arrange: đăng ký user trước để có tài khoản trong InMemory DB
        var registerRequest = new
        {
            username = "loginuser01",
            email = "loginuser01@gmail.com",
            password = "123456",
            fullName = "Login User"
        };

        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest);
        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);

        var loginRequest = new
        {
            usernameOrEmail = "loginuser01@gmail.com",
            password = "123456"
        };

        // Act: gọi API login
        var response = await _client.PostAsJsonAsync("/api/auth/login", loginRequest);

        // Assert: kiểm tra status code
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.True(root.GetProperty("success").GetBoolean());

        var data = root.GetProperty("data");

        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("accessToken").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("refreshToken").GetString()));
        Assert.True(data.TryGetProperty("expiresAt", out _));

        var user = data.GetProperty("user");

        Assert.Equal("loginuser01", user.GetProperty("username").GetString());
        Assert.Equal("loginuser01@gmail.com", user.GetProperty("email").GetString());
        Assert.Equal("Login User", user.GetProperty("fullName").GetString());
    }

    [Fact]
    public async Task Login_WithIncorrectPasswordOrUsername_ShouldReturnUnauthorized()
    {
        // Arrange: tạo user trước để test sai password
        var registerRequest = new
        {
            username = "wrongloginuser01",
            email = "wrongloginuser01@gmail.com",
            password = "123456",
            fullName = "Wrong Login User"
        };

        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest);
        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);

        var loginRequest = new
        {
            usernameOrEmail = "wrongloginuser01@gmail.com",
            password = "wrongpassword"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/login", loginRequest);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.False(root.GetProperty("success").GetBoolean());
        Assert.Equal("Invalid credentials.", root.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Refresh_WithValidRefreshToken_ShouldReturnOkAndNewTokens()
    {
        // Arrange: đăng ký user để lấy refreshToken ban đầu
        var registerRequest = new
        {
            username = "refreshuser01",
            email = "refreshuser01@gmail.com",
            password = "123456",
            fullName = "Refresh User"
        };

        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest);
        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);

        var registerJson = await registerResponse.Content.ReadAsStringAsync();
        using var registerDocument = JsonDocument.Parse(registerJson);

        var oldRefreshToken = registerDocument
            .RootElement
            .GetProperty("data")
            .GetProperty("refreshToken")
            .GetString();

        Assert.False(string.IsNullOrWhiteSpace(oldRefreshToken));

        var refreshRequest = new
        {
            refreshToken = oldRefreshToken
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/refresh", refreshRequest);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);

        var root = document.RootElement;

        Assert.True(root.GetProperty("success").GetBoolean());

        var data = root.GetProperty("data");

        var newAccessToken = data.GetProperty("accessToken").GetString();
        var newRefreshToken = data.GetProperty("refreshToken").GetString();

        Assert.False(string.IsNullOrWhiteSpace(newAccessToken));
        Assert.False(string.IsNullOrWhiteSpace(newRefreshToken));
        Assert.True(data.TryGetProperty("expiresAt", out _));

        Assert.NotEqual(oldRefreshToken, newRefreshToken);
    }

    [Fact]
    public async Task Refresh_WithOldRefreshTokenAfterRotation_ShouldReturnUnauthorized()
    {
        // Arrange: đăng ký user để lấy refreshToken ban đầu
        var registerRequest = new
        {
            username = "refreshuser02",
            email = "refreshuser02@gmail.com",
            password = "123456",
            fullName = "Refresh User 02"
        };

        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest);
        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);

        var registerJson = await registerResponse.Content.ReadAsStringAsync();
        using var registerDocument = JsonDocument.Parse(registerJson);

        var oldRefreshToken = registerDocument
            .RootElement
            .GetProperty("data")
            .GetProperty("refreshToken")
            .GetString();

        Assert.False(string.IsNullOrWhiteSpace(oldRefreshToken));

        var refreshRequest = new
        {
            refreshToken = oldRefreshToken
        };

        // Act lần 1: refresh thành công, token cũ bị revoke
        var firstRefreshResponse = await _client.PostAsJsonAsync("/api/auth/refresh", refreshRequest);
        Assert.Equal(HttpStatusCode.OK, firstRefreshResponse.StatusCode);

        // Act lần 2: dùng lại refreshToken cũ
        var secondRefreshResponse = await _client.PostAsJsonAsync("/api/auth/refresh", refreshRequest);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, secondRefreshResponse.StatusCode);

        var json = await secondRefreshResponse.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);

        var root = document.RootElement;

        Assert.False(root.GetProperty("success").GetBoolean());
        Assert.Equal("Refresh token is invalid or expired.", root.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Logout_WithValidRefreshToken_ShouldReturnOkAndRevokedTrue()
    {
        // Arrange: đăng ký user để lấy refreshToken
        var registerRequest = new
        {
            username = "logoutuser01",
            email = "logoutuser01@gmail.com",
            password = "123456",
            fullName = "Logout User"
        };

        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest);
        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);

        var registerJson = await registerResponse.Content.ReadAsStringAsync();
        using var registerDocument = JsonDocument.Parse(registerJson);

        var refreshToken = registerDocument
            .RootElement
            .GetProperty("data")
            .GetProperty("refreshToken")
            .GetString();

        Assert.False(string.IsNullOrWhiteSpace(refreshToken));

        var logoutRequest = new
        {
            refreshToken = refreshToken
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/logout", logoutRequest);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);

        var root = document.RootElement;

        Assert.True(root.GetProperty("success").GetBoolean());

        var data = root.GetProperty("data");

        Assert.True(data.GetProperty("revoked").GetBoolean());
    }

    [Fact]
    public async Task Logout_WithAlreadyRevokedRefreshToken_ShouldReturnOkAndRevokedFalse()
    {
        // Arrange: đăng ký user để lấy refreshToken
        var registerRequest = new
        {
            username = "logoutuser02",
            email = "logoutuser02@gmail.com",
            password = "123456",
            fullName = "Logout User 02"
        };

        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest);
        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);

        var registerJson = await registerResponse.Content.ReadAsStringAsync();
        using var registerDocument = JsonDocument.Parse(registerJson);

        var refreshToken = registerDocument
            .RootElement
            .GetProperty("data")
            .GetProperty("refreshToken")
            .GetString();

        Assert.False(string.IsNullOrWhiteSpace(refreshToken));

        var logoutRequest = new
        {
            refreshToken = refreshToken
        };

        // Act lần 1: logout thành công, token bị revoke
        var firstLogoutResponse = await _client.PostAsJsonAsync("/api/auth/logout", logoutRequest);
        Assert.Equal(HttpStatusCode.OK, firstLogoutResponse.StatusCode);

        // Act lần 2: logout lại cùng refreshToken
        var secondLogoutResponse = await _client.PostAsJsonAsync("/api/auth/logout", logoutRequest);

        // Assert
        Assert.Equal(HttpStatusCode.OK, secondLogoutResponse.StatusCode);

        var json = await secondLogoutResponse.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);

        var root = document.RootElement;

        Assert.True(root.GetProperty("success").GetBoolean());

        var data = root.GetProperty("data");

        Assert.False(data.GetProperty("revoked").GetBoolean());
        Assert.Equal("Token already revoked.", root.GetProperty("message").GetString());
    }
}