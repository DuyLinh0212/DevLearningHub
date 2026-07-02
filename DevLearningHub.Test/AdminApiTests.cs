using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class AdminApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AdminApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetPermissionCatalog_WithViewPermission_ShouldReturnGroupedPermissions()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "admin_catalog", "Admin");
        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "user:view_all");

        // Act
        var response = await client.GetAsync("/api/admin/permissions");

        // Assert
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        using var document = await ReadDocumentAsync(response);
        var modules = document.RootElement.GetProperty("data").EnumerateArray().ToList();

        Assert.Contains(modules, module => module.GetProperty("module").GetString() == "user");
        Assert.Contains(modules.SelectMany(module => module.GetProperty("permissions").EnumerateArray()),
            permission => permission.GetProperty("name").GetString() == "user:view_all");
    }

    [Fact]
    public async Task SetUserPermissions_WithGrantDenyInherit_ShouldUpdateEffectivePermissionsAndAudit()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "admin_permission_editor", "Admin");
        await _factory.EnsureUserAsync(targetId, "target_permission_user");
        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "user:view_all,user:edit_role");

        // Act: gán một quyền, chặn một quyền và để một quyền kế thừa.
        var response = await client.PutAsJsonAsync($"/api/admin/users/{targetId}/permissions", new
        {
            items = new[]
            {
                new { permission = "quiz:edit", state = "grant" },
                new { permission = "post:create", state = "deny" },
                new { permission = "comment:create", state = "inherit" }
            }
        });

        // Assert
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        using var document = await ReadDocumentAsync(response);
        var data = document.RootElement.GetProperty("data");

        Assert.Contains("quiz:edit", data.GetProperty("grants").EnumerateArray().Select(item => item.GetString()));
        Assert.Contains("post:create", data.GetProperty("denies").EnumerateArray().Select(item => item.GetString()));
        Assert.Contains("quiz:edit", data.GetProperty("effective").EnumerateArray().Select(item => item.GetString()));
        Assert.DoesNotContain("post:create", data.GetProperty("effective").EnumerateArray().Select(item => item.GetString()));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        Assert.True(await db.AuditLogs.AnyAsync(log => log.Action == "user.permission_change" && log.TargetId == targetId));
    }

    [Fact]
    public async Task SaveUserManagement_WithRoleAndPermissions_ShouldReplaceRoleAndOverrides()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "admin_management_editor", "Admin");
        await _factory.EnsureUserAsync(targetId, "target_management_user");
        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "user:view_all,user:edit_role");

        // Act: chọn role Admin nhưng chỉ giữ một phần quyền, API sẽ tạo deny override cho phần bỏ chọn.
        var response = await client.PutAsJsonAsync($"/api/admin/users/{targetId}/management", new
        {
            role = "Admin",
            permissions = new[] { "user:view_all", "quiz:create" }
        });

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var data = document.RootElement.GetProperty("data");
        var selectedRole = data.GetProperty("roles").EnumerateArray()
            .Single(role => role.GetProperty("name").GetString() == "Admin");

        Assert.True(selectedRole.GetProperty("selected").GetBoolean());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var targetRole = await db.UserRoles.Include(userRole => userRole.Role).SingleAsync(userRole => userRole.UserId == targetId);
        Assert.Equal("Admin", targetRole.Role.Name);
        Assert.True(await db.UserPermissions.AnyAsync(userPermission => userPermission.UserId == targetId && !userPermission.IsGranted));
    }

    [Fact]
    public async Task ForceLogout_WithEditRolePermission_ShouldDeleteRefreshTokens()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "admin_force_logout", "Admin");
        await _factory.EnsureUserAsync(targetId, "target_force_logout");

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
            db.RefreshTokens.Add(new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = targetId,
                TokenHash = "token-hash-force-logout",
                ExpiresAt = DateTime.Now.AddDays(1),
                CreatedAt = DateTime.Now
            });
            await db.SaveChangesAsync();
        }

        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "user:edit_role");

        // Act
        var response = await client.PostAsync($"/api/admin/users/{targetId}/management/logout", null);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scopeVerify = _factory.Services.CreateScope();
        var verifyDb = scopeVerify.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        Assert.False(await verifyDb.RefreshTokens.AnyAsync(token => token.UserId == targetId));
    }

    [Fact]
    public async Task GetAuditLogs_WithFilters_ShouldReturnMatchingLogsAndActions()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "admin_audit_viewer", "Admin");
        await _factory.EnsureUserAsync(actorId, "audit_actor");

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
            db.AuditLogs.AddRange(
                new AuditLog
                {
                    Id = Guid.NewGuid(),
                    ActorId = actorId,
                    Action = "quiz.create",
                    TargetType = "quiz_set",
                    TargetId = Guid.NewGuid(),
                    Detail = "created by test",
                    CreatedAt = DateTime.Now
                },
                new AuditLog
                {
                    Id = Guid.NewGuid(),
                    ActorId = actorId,
                    Action = "post.delete",
                    TargetType = "post",
                    TargetId = Guid.NewGuid(),
                    Detail = "deleted by test",
                    CreatedAt = DateTime.Now
                });
            await db.SaveChangesAsync();
        }

        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "audit:view");

        // Act
        var listResponse = await client.GetAsync($"/api/admin/audit-logs?action=quiz&actorId={actorId}&targetType=quiz_set");
        var actionsResponse = await client.GetAsync("/api/admin/audit-logs/actions");

        // Assert
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        using var listDocument = await ReadDocumentAsync(listResponse);
        var items = listDocument.RootElement.GetProperty("data").GetProperty("items").EnumerateArray().ToList();
        Assert.All(items, item => Assert.Contains("quiz", item.GetProperty("action").GetString()));

        Assert.Equal(HttpStatusCode.OK, actionsResponse.StatusCode);
        using var actionsDocument = await ReadDocumentAsync(actionsResponse);
        Assert.Contains("quiz.create", actionsDocument.RootElement.GetProperty("data").EnumerateArray().Select(item => item.GetString()));
    }

    private static async Task<JsonDocument> ReadDocumentAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }
}
