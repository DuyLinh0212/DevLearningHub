using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Admin;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Users;

[ApiController]
[Route("api/admin/audit-logs")]
[Authorize]
// Read-only access to the audit trail, gated by the audit:view permission.
public class AdminAuditController : ControllerBase
{
    private readonly DevLearningHubContext _db;

    public AdminAuditController(DevLearningHubContext db)
    {
        _db = db;
    }

    /// <summary>
    /// List audit logs (newest first) with paging and optional filters.
    /// </summary>
    [HttpGet]
    [HasPermission("audit:view")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AuditLogResponse>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<AuditLogResponse>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? action = null,
        [FromQuery] Guid? actorId = null,
        [FromQuery] string? targetType = null,
        [FromQuery] Guid? targetId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.AuditLogs
            .Include(log => log.Actor)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(action))
        {
            var keyword = action.Trim();
            query = query.Where(log => log.Action.Contains(keyword));
        }

        if (actorId.HasValue)
        {
            query = query.Where(log => log.ActorId == actorId.Value);
        }

        if (!string.IsNullOrWhiteSpace(targetType))
        {
            var type = targetType.Trim();
            query = query.Where(log => log.TargetType == type);
        }

        if (targetId.HasValue)
        {
            query = query.Where(log => log.TargetId == targetId.Value);
        }

        if (from.HasValue)
        {
            query = query.Where(log => log.CreatedAt >= from.Value);
        }

        if (to.HasValue)
        {
            // Treat `to` as inclusive for the whole day when only a date is given.
            var upper = to.Value;
            query = query.Where(log => log.CreatedAt <= upper);
        }

        var totalCount = await query.CountAsync();
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        if (page > totalPages)
        {
            page = totalPages;
        }
        var items = await query
            .OrderByDescending(log => log.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(log => new AuditLogResponse
            {
                Id = log.Id,
                ActorId = log.ActorId,
                ActorUsername = log.Actor != null ? log.Actor.Username : null,
                ActorFullName = log.Actor != null ? log.Actor.FullName : null,
                Action = log.Action,
                TargetType = log.TargetType,
                TargetId = log.TargetId,
                Detail = log.Detail,
                IpAddress = log.IpAddress,
                CreatedAt = log.CreatedAt
            })
            .ToListAsync();

        var result = new PagedResult<AuditLogResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };

        return Ok(ApiResponse<PagedResult<AuditLogResponse>>.Ok(result));
    }

    /// <summary>
    /// Distinct action names present in the audit trail, for building filter dropdowns.
    /// </summary>
    [HttpGet("actions")]
    [HasPermission("audit:view")]
    [ProducesResponseType(typeof(ApiResponse<List<string>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetActions()
    {
        var actions = await _db.AuditLogs
            .AsNoTracking()
            .Select(log => log.Action)
            .Distinct()
            .OrderBy(name => name)
            .ToListAsync();

        return Ok(ApiResponse<List<string>>.Ok(actions));
    }
}
