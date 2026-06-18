using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Admin;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Users;

[ApiController]
[Route("api/admin/permissions")]
[Authorize(Policy = AppPolicies.AdminOnly)]
// Read-only catalog of permissions available to grant.
public class AdminPermissionsController : ControllerBase
{
    private readonly DevLearningHubContext _db;

    public AdminPermissionsController(DevLearningHubContext db)
    {
        _db = db;
    }

    /// <summary>
    /// List all permissions grouped by module.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<PermissionModuleResponse>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<PermissionModuleResponse>>>> GetCatalog()
    {
        var permissions = await _db.Permissions
            .AsNoTracking()
            .OrderBy(p => p.Module)
            .ThenBy(p => p.Name)
            .Select(p => new PermissionResponse
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                Module = p.Module
            })
            .ToListAsync();

        var grouped = permissions
            .GroupBy(p => p.Module ?? "other")
            .Select(g => new PermissionModuleResponse
            {
                Module = g.Key,
                Permissions = g.ToList()
            })
            .ToList();

        return Ok(ApiResponse<List<PermissionModuleResponse>>.Ok(grouped));
    }
}
