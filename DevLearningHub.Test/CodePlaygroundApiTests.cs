using System.Net;
using System.Net.Http.Json;
using DevLearningHub.Api.Dtos.CodePlayground;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Services;
using DevLearningHub.Test.Factories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace DevLearningHub.Test;

public class CodePlaygroundApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly Mock<IJudge0Service> _judge0Mock;
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testProblemId = Guid.NewGuid();

    public CodePlaygroundApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _judge0Mock = new Mock<IJudge0Service>();
    }

    /// <summary>
    /// Helper tạo HttpClient đã được cấu hình Mock Service và Bypass Authentication thông qua một Fake Scheme
    /// </summary>
    private HttpClient CreateConfiguredClient(string role = "User")
    {
        return _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                // 1. Thay thế IJudge0Service thật bằng Mock Object
                var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IJudge0Service));
                if (descriptor != null) services.Remove(descriptor);
                services.AddScoped(_ => _judge0Mock.Object);

                // 2. Đăng ký một Authentication Handler giả lập (Fake Auth) để inject User Claims
                services.AddAuthentication(defaultScheme: "TestScheme")
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("TestScheme", options => { });
            });
        }).CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
    }

    private async Task SeedDatabaseAsync()
    {
        // Khởi tạo scope để can thiệp vào InMemory DbContext của Factory
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        // Xóa sạch dữ liệu cũ để tránh xung đột giữa các lượt chạy test
        db.Database.EnsureDeleted();
        db.Database.EnsureCreated();

        // 1. Seed Ngôn ngữ lập trình
        var language = new ProgrammingLanguage
        {
            Id = 1,
            Name = "C++",
            Slug = "cpp",
            Judge0LanguageId = 54,
            IsActive = true
        };
        db.ProgrammingLanguages.Add(language);

        // 2. Seed Bài tập mẫu
        var problem = new Problem
        {
            Id = _testProblemId,
            TopicId = Guid.NewGuid(),
            CreatedBy = _testUserId,
            Title = "Tính tổng 2 số",
            Description = "Cho 2 số nguyên A và B. Tính A + B",
            Difficulty = "easy",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Problems.Add(problem);

        // 3. Seed Test Case mẫu (gồm 1 cái công khai, 1 cái ẩn)
        db.TestCases.AddRange(
            new TestCase { Id = Guid.NewGuid(), ProblemId = _testProblemId, Input = "1 2", ExpectedOutput = "3", IsHidden = false, OrderIndex = 1 },
            new TestCase { Id = Guid.NewGuid(), ProblemId = _testProblemId, Input = "5 5", ExpectedOutput = "10", IsHidden = true, OrderIndex = 2 }
        );

        await db.SaveChangesAsync();
    }

    // ── TEST CASES FOR API ──────────────────────────────────────────────────

    [Fact]
    public async Task RunCode_ShouldReturnStdout_WhenValidRequest()
    {
        // Arrange
        var client = CreateConfiguredClient();
        var request = new CodeRunRequest { Code = "print('Hello')", LanguageId = 71, Stdin = "" };

        _judge0Mock.Setup(s => s.RunAsync(request.Code, request.LanguageId, request.Stdin))
            .ReturnsAsync(new Judge0Result { Status = "Accepted", Stdout = "Hello\n", StatusId = 3 });

        // Act
        client.DefaultRequestHeaders.Add("X-Test-Role", "User"); // Gửi kèm Role qua Header cho Fake Auth Handler xử lý
        var response = await client.PostAsJsonAsync("/api/code/run", request);

        // Assert
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CodeRunResponse>();
        Assert.NotNull(result);
        Assert.Equal("Hello\n", result.Stdout);
        Assert.Equal("Accepted", result.Status);
    }

    [Fact]
    public async Task SubmitCode_ShouldSaveAndReturnVerdict_WhenValidSubmission()
    {
        // Arrange
        await SeedDatabaseAsync();
        var client = CreateConfiguredClient();
        var request = new CodeSubmitRequest { ProblemId = _testProblemId, Code = "some code", LanguageId = 54 };

        // Giả lập kết quả trả về từ Judge0 cho 2 Test Case đã seed
        var expectedJudgeResults = new List<Judge0Result>
        {
            new() { StatusId = 3, Status = "Accepted", Time = 0.01, Memory = 200 },
            new() { StatusId = 3, Status = "Accepted", Time = 0.02, Memory = 210 }
        };

        _judge0Mock.Setup(s => s.SubmitBatchAsync(It.IsAny<List<Judge0Submission>>()))
            .ReturnsAsync(expectedJudgeResults);

        // Act
        client.DefaultRequestHeaders.Add("X-Test-Role", "User");
        client.DefaultRequestHeaders.Add("X-Test-UserId", _testUserId.ToString());
        var response = await client.PostAsJsonAsync("/api/code/submit", request);

        // Assert
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CodeSubmitResponse>();
        Assert.NotNull(result);
        Assert.Equal("Accepted", result.Verdict);
        Assert.Equal(2, result.PassedCases);
        Assert.Equal(2, result.TotalCases);
    }

    [Fact]
    public async Task UpdateUrl_ShouldReturnForbidden_WhenUserIsNotAdmin()
    {
        // Arrange
        var client = CreateConfiguredClient();
        var request = new UpdateJudgeUrlRequest { Url = "https://newjudge.com" };

        // Act - Sử dụng Role User thông thường
        client.DefaultRequestHeaders.Add("X-Test-Role", "User");
        var response = await client.PutAsJsonAsync("/api/admin/judge/url", request);

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateUrl_ShouldReturnOk_WhenUserIsAdmin()
    {
        // Arrange
        var client = CreateConfiguredClient();
        var request = new UpdateJudgeUrlRequest { Url = "https://newjudge.com" };

        // Act - Sử dụng Role Admin để cập nhật URL
        client.DefaultRequestHeaders.Add("X-Test-Role", "Admin");
        var response = await client.PutAsJsonAsync("/api/admin/judge/url", request);

        // Assert
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<JudgeUrlResponse>();
        Assert.NotNull(result);
        Assert.Equal("https://newjudge.com", result.Url);
    }
}