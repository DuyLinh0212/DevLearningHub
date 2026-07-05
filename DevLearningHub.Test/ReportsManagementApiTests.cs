using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class ReportsManagementApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public ReportsManagementApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateReport_WithDuplicatePendingReport_ShouldReturnBadRequest()
    {
        // Arrange
        var reporterId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        await _factory.EnsureUserAsync(reporterId, "report_duplicate_reporter");
        await _factory.EnsureUserAsync(ownerId, "report_duplicate_owner");
        var typeId = await SeedReportTypeAsync("post");
        var postId = await SeedPostAsync(ownerId);
        using var client = _factory.CreateAuthenticatedClient(reporterId);

        // Act
        var firstResponse = await client.PostAsJsonAsync("/api/reports", new
        {
            reportTypeId = typeId,
            targetId = postId,
            description = "Spam content"
        });
        var duplicateResponse = await client.PostAsJsonAsync("/api/reports", new
        {
            reportTypeId = typeId,
            targetId = postId,
            description = "Spam content again"
        });

        // Assert
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);
    }

    [Fact]
    public async Task ResolveReport_WithModeratorPermission_ShouldUpdateStatus()
    {
        // Arrange
        var reporterId = Guid.NewGuid();
        var moderatorId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        await _factory.EnsureUserAsync(reporterId, "report_resolve_reporter");
        await _factory.EnsureUserAsync(moderatorId, "report_resolve_moderator", permissions: new[] { "post:hide_any" });
        await _factory.EnsureUserAsync(ownerId, "report_resolve_owner");
        var typeId = await SeedReportTypeAsync("post");
        var postId = await SeedPostAsync(ownerId);
        var reportId = await SeedReportAsync(typeId, reporterId, postId);
        using var client = _factory.CreateAuthenticatedClient(moderatorId, permissions: "post:hide_any");

        // Act
        var listResponse = await client.GetAsync("/api/reports?status=pending&type=post");
        var resolveResponse = await client.PutAsJsonAsync($"/api/reports/{reportId}/resolve", new
        {
            status = "resolved"
        });

        // Assert
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        using var listDocument = await ReadDocumentAsync(listResponse);
        Assert.Contains(listDocument.RootElement.GetProperty("data").GetProperty("items").EnumerateArray(),
            report => report.GetProperty("id").GetGuid() == reportId);

        Assert.Equal(HttpStatusCode.OK, resolveResponse.StatusCode);
        using var resolveDocument = await ReadDocumentAsync(resolveResponse);
        Assert.Equal("resolved", resolveDocument.RootElement.GetProperty("data").GetProperty("status").GetString());
    }

    [Fact]
    public async Task ResolveReport_WithInvalidStatus_ShouldReturnBadRequest()
    {
        // Arrange
        var moderatorId = Guid.NewGuid();
        await _factory.EnsureUserAsync(moderatorId, "report_invalid_status_moderator", permissions: new[] { "post:hide_any" });
        using var client = _factory.CreateAuthenticatedClient(moderatorId, permissions: "post:hide_any");

        // Act
        var response = await client.PutAsJsonAsync($"/api/reports/{Guid.NewGuid()}/resolve", new
        {
            status = "invalid"
        });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<Guid> SeedReportTypeAsync(string name)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var type = new ReportType
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = name
        };
        db.ReportTypes.Add(type);
        await db.SaveChangesAsync();
        return type.Id;
    }

    private async Task<Guid> SeedPostAsync(Guid ownerId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var post = new Post
        {
            Id = Guid.NewGuid(),
            AuthorId = ownerId,
            Title = $"Reported post {Guid.NewGuid():N}",
            BodyMarkdown = "Reported body",
            ReviewStatus = "approved",
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };
        db.Posts.Add(post);
        await db.SaveChangesAsync();
        return post.Id;
    }

    private async Task<Guid> SeedReportAsync(Guid typeId, Guid reporterId, Guid targetId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var report = new Report
        {
            Id = Guid.NewGuid(),
            ReportTypeId = typeId,
            ReporterId = reporterId,
            TargetId = targetId,
            Description = "Pending report",
            Status = "pending",
            CreatedAt = DateTime.Now
        };
        db.Reports.Add(report);
        await db.SaveChangesAsync();
        return report.Id;
    }

    private static async Task<JsonDocument> ReadDocumentAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }
}
