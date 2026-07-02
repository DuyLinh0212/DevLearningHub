using DevLearningHub.Api.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace DevLearningHub.Test.Factories;

internal static class TestApiHelpers
{
    public static HttpClient CreateAuthenticatedClient(
        this CustomWebApplicationFactory factory,
        Guid userId,
        string role = "User",
        string permissions = "")
    {
        var client = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.AddAuthentication(defaultScheme: "TestScheme")
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("TestScheme", _ => { });
            });
        }).CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        client.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Role", role);
        if (!string.IsNullOrWhiteSpace(permissions))
        {
            client.DefaultRequestHeaders.Add("X-Test-Permissions", permissions);
        }

        return client;
    }

    public static async Task<User> EnsureUserAsync(
        this CustomWebApplicationFactory factory,
        Guid userId,
        string username,
        string roleName = "user",
        IEnumerable<string>? permissions = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var now = DateTime.Now;
        var user = db.Users.FirstOrDefault(user => user.Id == userId);
        if (user == null)
        {
            user = new User
            {
                Id = userId,
                Username = username,
                Email = $"{username}@test.local",
                PasswordHash = "not-used-in-this-test",
                FullName = username,
                IsActive = true,
                IsLocked = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.Users.Add(user);
        }

        var role = EnsureRole(db, roleName, now);
        if (!db.UserRoles.Any(userRole => userRole.UserId == userId && userRole.RoleId == role.Id))
        {
            db.UserRoles.Add(new UserRole
            {
                UserId = userId,
                RoleId = role.Id,
                AssignedAt = now
            });
        }

        foreach (var permissionName in permissions ?? Array.Empty<string>())
        {
            var permission = EnsurePermission(db, permissionName);
            if (!db.UserPermissions.Any(userPermission =>
                    userPermission.UserId == userId &&
                    userPermission.PermissionId == permission.Id))
            {
                db.UserPermissions.Add(new UserPermission
                {
                    UserId = userId,
                    PermissionId = permission.Id,
                    IsGranted = true,
                    GrantedAt = now
                });
            }
        }

        await db.SaveChangesAsync();
        return user;
    }

    public static Permission EnsurePermission(DevLearningHubContext db, string name)
    {
        var permission = db.Permissions.Local.FirstOrDefault(permission => permission.Name == name)
            ?? db.Permissions.FirstOrDefault(permission => permission.Name == name);
        if (permission != null)
        {
            return permission;
        }

        permission = new Permission
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = $"Quyen {name}",
            Module = name.Split(':')[0]
        };
        db.Permissions.Add(permission);
        return permission;
    }

    private static Role EnsureRole(DevLearningHubContext db, string name, DateTime now)
    {
        var role = db.Roles.Local.FirstOrDefault(role => role.Name == name)
            ?? db.Roles.FirstOrDefault(role => role.Name == name);
        if (role != null)
        {
            role.IsActive = true;
            return role;
        }

        role = new Role
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = name,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.Roles.Add(role);
        return role;
    }
}
