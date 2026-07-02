using DevLearningHub.Api.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DevLearningHub.Test.Factories;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"DevLearningHub_Test_Db_{Guid.NewGuid()}";
    private readonly object _databaseLock = new();
    private bool _databaseInitialized;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<DevLearningHubContext>));

            if (descriptor != null)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<DevLearningHubContext>(options =>
            {
                options.UseInMemoryDatabase(_databaseName);
            });

            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

            lock (_databaseLock)
            {
                if (_databaseInitialized)
                {
                    return;
                }

                db.Database.EnsureDeleted();
                db.Database.EnsureCreated();
                SeedAuthorizationCatalog(db);
                _databaseInitialized = true;
            }
        });
    }

    private static void SeedAuthorizationCatalog(DevLearningHubContext db)
    {
        // Seed quyền nền cho test: JWT thật đọc permission từ DB khi register/login.
        // Nếu thiếu catalog này, các endpoint có HasPermission/HasPermissionAsync sẽ trả 403.
        var now = DateTime.Now;

        var userRole = EnsureRole(db, "user", "Nguoi dung thuong", now);
        var adminRole = EnsureRole(db, "Admin", "Administrator", now);
        EnsureRole(db, "Moderator", "Moderator", now);

        var normalUserPermissions = new[]
        {
            "quiz:create",
            "post:create",
            "comment:create"
        };

        var adminPermissions = new[]
        {
            "user:view_all",
            "user:ban",
            "user:edit_role",
            "audit:view",
            "quiz:create",
            "quiz:edit",
            "post:create",
            "post:edit_any",
            "post:delete_any",
            "post:hide_own",
            "post:hide_any",
            "comment:create",
            "comment:delete",
            "comment:hide",
            "problem:create",
            "problem:edit"
        };

        foreach (var name in normalUserPermissions.Concat(adminPermissions).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            EnsurePermission(db, name);
        }

        foreach (var name in normalUserPermissions)
        {
            EnsureRolePermission(db, userRole.Id, name);
        }

        foreach (var name in adminPermissions)
        {
            EnsureRolePermission(db, adminRole.Id, name);
        }

        db.SaveChanges();
    }

    private static Role EnsureRole(DevLearningHubContext db, string name, string description, DateTime now)
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
            Description = description,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Roles.Add(role);
        return role;
    }

    private static Permission EnsurePermission(DevLearningHubContext db, string name)
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

    private static void EnsureRolePermission(DevLearningHubContext db, Guid roleId, string permissionName)
    {
        var permission = EnsurePermission(db, permissionName);
        if (db.RolePermissions.Any(rolePermission =>
                rolePermission.RoleId == roleId &&
                rolePermission.PermissionId == permission.Id))
        {
            return;
        }

        db.RolePermissions.Add(new RolePermission
        {
            RoleId = roleId,
            PermissionId = permission.Id
        });
    }
}
