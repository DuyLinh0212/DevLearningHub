using System.Net;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class AdminRolesApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AdminRolesApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetRoles_AdminRole_EffectivePermissionsCoverFullCatalogAndFullControl()
    {
        // Arrange: add a catalog permission that the Admin role is NOT explicitly granted,
        // so we can prove Admin's effective permissions expand to the whole catalog.
        const string standalonePermission = "roadmap:review";
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
            TestApiHelpers.EnsurePermission(db, standalonePermission);
            await db.SaveChangesAsync();
        }

        var adminId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "roles_admin_viewer", "Admin");
        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "role:view");

        // Act
        var response = await client.GetAsync("/api/admin/roles");

        // Assert
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        using var document = await ReadDocumentAsync(response);
        var adminRole = document.RootElement.GetProperty("data").EnumerateArray()
            .Single(role => string.Equals(role.GetProperty("name").GetString(), "Admin", StringComparison.OrdinalIgnoreCase));

        var effective = adminRole.GetProperty("effectivePermissions").EnumerateArray()
            .Select(item => item.GetString())
            .ToList();
        var raw = adminRole.GetProperty("permissions").EnumerateArray()
            .Select(item => item.GetString())
            .ToList();

        // Admin always has full control, even though it is not an explicit role_permissions row.
        Assert.Contains("system.full_control", effective);
        // Admin's effective set covers a catalog permission it was never explicitly granted.
        Assert.DoesNotContain(standalonePermission, raw);
        Assert.Contains(standalonePermission, effective);
    }

    [Fact]
    public async Task GetRoles_UserRole_EffectivePermissionsIncludeBaselineBeyondRawGrants()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        await _factory.EnsureUserAsync(adminId, "roles_user_inspector", "Admin");
        using var client = _factory.CreateAuthenticatedClient(adminId, "Admin", "role:view");

        // Act
        var response = await client.GetAsync("/api/admin/roles");

        // Assert
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        using var document = await ReadDocumentAsync(response);
        var userRole = document.RootElement.GetProperty("data").EnumerateArray()
            .Single(role => string.Equals(role.GetProperty("name").GetString(), "user", StringComparison.OrdinalIgnoreCase));

        var effective = userRole.GetProperty("effectivePermissions").EnumerateArray()
            .Select(item => item.GetString())
            .ToList();
        var raw = userRole.GetProperty("permissions").EnumerateArray()
            .Select(item => item.GetString())
            .ToList();

        // The seeded User role does not grant post:edit_own explicitly, but it is part of
        // the baseline user permissions, so it must appear in the effective set.
        Assert.DoesNotContain("post:edit_own", raw);
        Assert.Contains("post:edit_own", effective);
        // Raw permissions the User role does hold are still present in the effective set.
        Assert.Contains("quiz:create", effective);
    }

    private static async Task<JsonDocument> ReadDocumentAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }
}
