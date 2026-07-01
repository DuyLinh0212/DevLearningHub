using System.Net;
using System.Net.Http.Json;
using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class ReportsNotificationApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    private readonly Guid _reporterId = Guid.NewGuid();
    private readonly Guid _ownerId = Guid.NewGuid();
    private readonly Guid _adminId = Guid.NewGuid();
    private readonly Guid _adminRoleId = Guid.NewGuid();

    public ReportsNotificationApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private (HttpClient Client, WebApplicationFactory<Program> Factory) CreateConfiguredClient()
    {
        var factory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.AddAuthentication(defaultScheme: "TestScheme")
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("TestScheme", options => { });
            });
        });

        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        return (client, factory);
    }

    [Fact]
    public async Task CreateReport_ForProblem_ShouldNotifyProblemOwnerOnly()
    {
        // Arrange
        var problemTypeId = Guid.NewGuid();
        var problemId = Guid.NewGuid();
        var (client, factory) = CreateConfiguredClient();
        await SeedBaseUsersAndAdminAsync(factory.Services);
        await SeedReportTypeAsync(factory.Services, problemTypeId, "problem");
        await SeedProblemAsync(factory.Services, problemId, _ownerId);
        client.DefaultRequestHeaders.Add("X-Test-UserId", _reporterId.ToString());

        // Act
        var response = await client.PostAsJsonAsync("/api/reports", new
        {
            reportTypeId = problemTypeId,
            targetId = problemId,
            description = "Wrong test case"
        });

        // Assert
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var notifications = await db.Notifications.AsNoTracking().ToListAsync();

        var ownerNotification = Assert.Single(notifications);
        Assert.Equal(_ownerId, ownerNotification.UserId);
        Assert.Equal("content_reported", ownerNotification.Type);
        Assert.Equal(problemId, ownerNotification.RefId);
        Assert.Equal("problem", ownerNotification.RefType);
    }

    [Fact]
    public async Task CreateReport_ForQuizQuestion_ShouldNotifyQuestionOwnerOnly()
    {
        // Arrange
        var questionTypeId = Guid.NewGuid();
        var questionId = Guid.NewGuid();
        var (client, factory) = CreateConfiguredClient();
        await SeedBaseUsersAndAdminAsync(factory.Services);
        await SeedReportTypeAsync(factory.Services, questionTypeId, "quiz_question");
        await SeedQuestionAsync(factory.Services, questionId, _ownerId);
        client.DefaultRequestHeaders.Add("X-Test-UserId", _reporterId.ToString());

        // Act
        var response = await client.PostAsJsonAsync("/api/reports", new
        {
            reportTypeId = questionTypeId,
            targetId = questionId,
            description = "Wrong answer"
        });

        // Assert
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var notifications = await db.Notifications.AsNoTracking().ToListAsync();

        var ownerNotification = Assert.Single(notifications);
        Assert.Equal(_ownerId, ownerNotification.UserId);
        Assert.Equal("content_reported", ownerNotification.Type);
        Assert.Equal(questionId, ownerNotification.RefId);
        Assert.Equal("question", ownerNotification.RefType);
    }

    [Fact]
    public async Task CreateReport_ForPost_ShouldNotifyAdminInsteadOfPostOwner()
    {
        // Arrange
        var postTypeId = Guid.NewGuid();
        var postId = Guid.NewGuid();
        var (client, factory) = CreateConfiguredClient();
        await SeedBaseUsersAndAdminAsync(factory.Services);
        await SeedReportTypeAsync(factory.Services, postTypeId, "post");
        await SeedPostAsync(factory.Services, postId, _ownerId);
        client.DefaultRequestHeaders.Add("X-Test-UserId", _reporterId.ToString());

        // Act
        var response = await client.PostAsJsonAsync("/api/reports", new
        {
            reportTypeId = postTypeId,
            targetId = postId,
            description = "Spam"
        });

        // Assert
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var reportId = await db.Reports
            .Where(r => r.TargetId == postId)
            .Select(r => r.Id)
            .SingleAsync();
        var notifications = await db.Notifications.AsNoTracking().ToListAsync();

        var adminNotification = Assert.Single(notifications);
        Assert.Equal(_adminId, adminNotification.UserId);
        Assert.Equal("content_reported", adminNotification.Type);
        Assert.Equal(reportId, adminNotification.RefId);
        Assert.Equal("report", adminNotification.RefType);
    }

    private async Task SeedBaseUsersAndAdminAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        db.Database.EnsureDeleted();
        db.Database.EnsureCreated();

        db.Users.AddRange(
            CreateUser(_reporterId, "reporter"),
            CreateUser(_ownerId, "owner"),
            CreateUser(_adminId, "admin"));

        db.Roles.Add(new Role
        {
            Id = _adminRoleId,
            Name = AppRoles.Admin,
            Description = "Administrator",
            IsActive = true,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        });

        db.UserRoles.Add(new UserRole
        {
            UserId = _adminId,
            RoleId = _adminRoleId,
            AssignedAt = DateTime.Now
        });

        await db.SaveChangesAsync();
    }

    private async Task SeedReportTypeAsync(IServiceProvider services, Guid id, string name)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        db.ReportTypes.Add(new ReportType
        {
            Id = id,
            Name = name,
            Description = name
        });
        await db.SaveChangesAsync();
    }

    private async Task SeedProblemAsync(IServiceProvider services, Guid id, Guid ownerId)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        db.Problems.Add(new Problem
        {
            Id = id,
            TopicId = Guid.NewGuid(),
            CreatedBy = ownerId,
            Title = "Problem",
            Description = "Problem description",
            Difficulty = "easy",
            IsActive = true,
            CreatedAt = DateTime.Now
        });
        await db.SaveChangesAsync();
    }

    private async Task SeedQuestionAsync(IServiceProvider services, Guid id, Guid ownerId)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        db.Questions.Add(new Question
        {
            Id = id,
            TopicId = Guid.NewGuid(),
            CreatedBy = ownerId,
            Content = "Question",
            Level = "easy",
            IsActive = true,
            CreatedAt = DateTime.Now
        });
        await db.SaveChangesAsync();
    }

    private async Task SeedPostAsync(IServiceProvider services, Guid id, Guid ownerId)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        db.Posts.Add(new Post
        {
            Id = id,
            AuthorId = ownerId,
            Title = "Post",
            BodyMarkdown = "Body",
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        });
        await db.SaveChangesAsync();
    }

    private static User CreateUser(Guid id, string name)
    {
        return new User
        {
            Id = id,
            Username = name,
            Email = $"{name}@example.com",
            PasswordHash = "test",
            FullName = name,
            IsActive = true,
            IsLocked = false,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };
    }
}
