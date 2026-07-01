using System.Net;
using System.Net.Http.Json;
using DevLearningHub.Api.Dtos.CodePlayground;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Services;
using DevLearningHub.Test.Factories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
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
        var client = CreateConfiguredClient();
        await SeedDatabaseAsync();
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
        Assert.Equal("accepted", result.Verdict, ignoreCase: true);
        Assert.Equal(2, result.PassedCases);
        Assert.Equal(2, result.TotalCases);
    }

    [Fact]
    public async Task CreateProblem_ShouldReturnCreatedProblemBody_WithId()
    {
        // Arrange
        await SeedDatabaseAsync();
        var client = CreateConfiguredClient();
        var request = new CreateProblemRequest
        {
            TopicId = Guid.NewGuid(),
            Title = "Bài mới",
            Description = "Mô tả bài mới",
            Difficulty = "easy",
            StarterCode = "print('hello')"
        };

        // Act
        client.DefaultRequestHeaders.Add("X-Test-Role", "User");
        client.DefaultRequestHeaders.Add("X-Test-UserId", _testUserId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Permissions", "problem:create");
        var response = await client.PostAsJsonAsync("/api/problems", request);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ProblemDetailResponse>();
        Assert.NotNull(result);
        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(request.Title, result.Title);
    }

    [Fact]
    public async Task ProblemOwner_ShouldUpdateProblemAndTestCase_WithoutEditPermission()
    {
        // Arrange
        var client = CreateConfiguredClient();
        client.DefaultRequestHeaders.Add("X-Test-Role", "User");
        client.DefaultRequestHeaders.Add("X-Test-UserId", _testUserId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Permissions", "problem:create");

        var createProblem = new CreateProblemRequest
        {
            TopicId = Guid.NewGuid(),
            Title = "Bài chủ sở hữu",
            Description = "Mô tả",
            Difficulty = "easy"
        };
        var createProblemResponse = await client.PostAsJsonAsync("/api/problems", createProblem);
        createProblemResponse.EnsureSuccessStatusCode();
        var createdProblem = await createProblemResponse.Content.ReadFromJsonAsync<ProblemDetailResponse>();
        Assert.NotNull(createdProblem);

        var createTestCase = new CreateTestCaseRequest
        {
            Input = "1 2",
            ExpectedOutput = "3",
            IsHidden = false,
            OrderIndex = 0
        };
        var createTestCaseResponse = await client.PostAsJsonAsync($"/api/problems/{createdProblem.Id}/test-cases", createTestCase);
        createTestCaseResponse.EnsureSuccessStatusCode();
        var createdTestCase = await createTestCaseResponse.Content.ReadFromJsonAsync<TestCaseResponse>();
        Assert.NotNull(createdTestCase);

        client.DefaultRequestHeaders.Remove("X-Test-Permissions");

        var updateProblem = new UpdateProblemRequest
        {
            TopicId = Guid.NewGuid(),
            Title = "Tính tổng đã sửa",
            Description = "Mô tả đã sửa",
            Difficulty = "medium",
            StarterCode = "updated",
            IsActive = true
        };

        // Act
        var updateTestCase = new UpdateTestCaseRequest
        {
            Input = "2 3",
            ExpectedOutput = "5",
            IsHidden = createdTestCase.IsHidden,
            OrderIndex = createdTestCase.OrderIndex
        };
        var problemResponse = await client.PutAsJsonAsync($"/api/problems/{createdProblem.Id}", updateProblem);
        var testCaseResponse = await client.PutAsJsonAsync($"/api/test-cases/{createdTestCase.Id}", updateTestCase);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, problemResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, testCaseResponse.StatusCode);
    }

    [Fact]
    public async Task ProblemManager_ShouldViewPrivateProblemBanksAndAddProblems()
    {
        // Arrange
        var ownerId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var privateBankId = Guid.NewGuid();
        var addProblemId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var client = CreateConfiguredClient();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
            db.Database.EnsureDeleted();
            db.Database.EnsureCreated();

            db.Users.AddRange(
                new User
                {
                    Id = ownerId,
                    Username = "owner",
                    Email = "owner@test.local",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new User
                {
                    Id = adminId,
                    Username = "admin",
                    Email = "admin@test.local",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });

            db.Topics.Add(new Topic
            {
                Id = topicId,
                Name = "Code",
                Slug = "code",
                IsActive = true
            });

            db.ProblemBanks.Add(new ProblemBank
            {
                Id = privateBankId,
                CreatedBy = ownerId,
                Title = "Private bank",
                Description = "Owner private bank",
                IsPublic = false,
                TopicId = topicId,
                CreatedAt = DateTime.UtcNow
            });

            db.Problems.Add(new Problem
            {
                Id = addProblemId,
                TopicId = topicId,
                CreatedBy = ownerId,
                Title = "Problem to add",
                Description = "Description",
                Difficulty = "easy",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });

            await db.SaveChangesAsync();
        }

        client.DefaultRequestHeaders.Add("X-Test-Role", "Admin");
        client.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());

        // Act
        var listResponse = await client.GetAsync("/api/problem-banks");
        var detailResponse = await client.GetAsync($"/api/problem-banks/{privateBankId}");
        var addResponse = await client.PostAsJsonAsync($"/api/problem-banks/{privateBankId}/problems", new AddProblemToBankRequest
        {
            ProblemId = addProblemId
        });

        // Assert
        listResponse.EnsureSuccessStatusCode();
        detailResponse.EnsureSuccessStatusCode();
        addResponse.EnsureSuccessStatusCode();

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        Assert.True(await verifyDb.ProblemBankItems.AnyAsync(i => i.BankId == privateBankId && i.ProblemId == addProblemId));
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
