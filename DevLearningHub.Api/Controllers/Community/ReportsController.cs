using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Community;

[ApiController]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly DevLearningHubContext _db;
    private readonly IPermissionService _permissions;
    private readonly INotificationService _notifications;

    public ReportsController(
        DevLearningHubContext db,
        IPermissionService permissions,
        INotificationService notifications)
    {
        _db = db;
        _permissions = permissions;
        _notifications = notifications;
    }

    // ── Public types (no auth needed) ──────────────────────────────────
    [HttpGet("types")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetReportTypes()
    {
        var types = await _db.ReportTypes
            .AsNoTracking()
            .OrderBy(t => t.Name)
            .Select(t => new { id = t.Id, name = t.Name, description = t.Description })
            .ToListAsync<object>();

        return Ok(ApiResponse<List<object>>.Ok(types));
    }

    // ── User: submit a report ───────────────────────────────────────────
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> CreateReport([FromBody] CreateReportRequest request)
    {
        if (!User.TryGetUserId(out var userId))
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));

        if (request.TargetId == Guid.Empty)
            return BadRequest(ApiResponse<object>.Fail("TargetId là bắt buộc."));

        var type = await _db.ReportTypes.FirstOrDefaultAsync(t => t.Id == request.ReportTypeId);
        if (type == null)
            return BadRequest(ApiResponse<object>.Fail("Loại báo cáo không hợp lệ."));

        var existing = await _db.Reports.FirstOrDefaultAsync(
            r => r.ReporterId == userId && r.TargetId == request.TargetId && r.Status == "pending");
        if (existing != null)
            return BadRequest(ApiResponse<object>.Fail("Bạn đã báo cáo nội dung này và đang chờ xử lý."));

        var report = new Report
        {
            Id = Guid.NewGuid(),
            ReportTypeId = request.ReportTypeId,
            ReporterId = userId,
            TargetId = request.TargetId,
            Description = request.Description?.Trim()[..Math.Min(request.Description.Trim().Length, 2000)],
            Status = "pending",
            CreatedAt = DateTime.UtcNow
        };

        _db.Reports.Add(report);
        await _db.SaveChangesAsync();

        await NotifyReportedContentOwnerAsync(type.Name, request.TargetId, userId);

        return Ok(ApiResponse<object>.Ok(new { id = report.Id }, "Báo cáo đã được gửi thành công."));
    }

    // ── Admin: list all reports ─────────────────────────────────────────
    [HttpGet]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> GetReports(
        [FromQuery] string? status = null,
        [FromQuery] string? type = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (!User.TryGetUserId(out var moderatorId))
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));

        if (!await CanManageReportsAsync(moderatorId))
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));

        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var query = _db.Reports
            .AsNoTracking()
            .Include(r => r.ReportType)
            .Include(r => r.Reporter)
            .Include(r => r.Resolver)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(r => r.Status == status);

        if (!string.IsNullOrWhiteSpace(type))
            query = query.Where(r => r.ReportType.Name == type);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new ReportResponse
            {
                Id = r.Id,
                TypeName = r.ReportType.Name,
                TypeDescription = r.ReportType.Description,
                ReporterId = r.ReporterId,
                ReporterUsername = r.Reporter.Username,
                ReporterAvatarUrl = r.Reporter.AvatarUrl,
                TargetId = r.TargetId,
                Description = r.Description,
                Status = r.Status,
                CreatedAt = r.CreatedAt,
                ResolvedAt = r.ResolvedAt,
                ResolvedByUsername = r.Resolver != null ? r.Resolver.Username : null
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            items,
            totalCount = total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        }));
    }

    // ── Admin: resolve / dismiss a report ──────────────────────────────
    [HttpPut("{id:guid}/resolve")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> ResolveReport(Guid id, [FromBody] ResolveReportRequest request)
    {
        if (!User.TryGetUserId(out var moderatorId))
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));

        if (!await CanManageReportsAsync(moderatorId))
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));

        var allowed = new[] { "reviewed", "resolved", "dismissed" };
        if (!allowed.Contains(request.Status))
            return BadRequest(ApiResponse<object>.Fail("Status phải là reviewed, resolved hoặc dismissed."));

        var report = await _db.Reports.FindAsync(id);
        if (report == null)
            return NotFound(ApiResponse<object>.Fail("Báo cáo không tồn tại."));

        report.Status = request.Status;
        report.ResolvedAt = DateTime.UtcNow;
        report.ResolvedBy = moderatorId;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { id = report.Id, status = report.Status }, "Báo cáo đã được cập nhật."));
    }

    private async Task<bool> CanManageReportsAsync(Guid userId)
    {
        return await _permissions.HasPermissionAsync(userId, "post:hide_any")
            || await _permissions.HasPermissionAsync(userId, "post:delete_any");
    }

    private async Task NotifyReportedContentOwnerAsync(string typeName, Guid targetId, Guid reporterId)
    {
        var target = await ResolveReportTargetAsync(typeName, targetId);
        if (target.OwnerId == null)
        {
            return;
        }

        var message = typeName switch
        {
            "post" => "Bài viết của bạn vừa được báo cáo vi phạm. Vui lòng kiểm tra lại nội dung.",
            "comment" => "Bình luận của bạn vừa được báo cáo vi phạm. Vui lòng kiểm tra lại nội dung.",
            "problem" => "Bài code của bạn vừa được báo lỗi. Vui lòng kiểm tra đề bài và test case.",
            "quiz_question" => "Câu hỏi quiz của bạn vừa được báo lỗi. Vui lòng kiểm tra lại đáp án và nội dung.",
            _ => "Một nội dung của bạn vừa được báo cáo. Vui lòng kiểm tra lại nội dung."
        };

        await _notifications.NotifyAsync(
            recipientId: target.OwnerId.Value,
            type: NotificationTypes.ContentReported,
            message: message,
            refId: targetId,
            refType: target.RefType,
            actorId: reporterId);
    }

    private async Task<(Guid? OwnerId, string? RefType)> ResolveReportTargetAsync(string typeName, Guid targetId)
    {
        return typeName switch
        {
            "post" => (
                await _db.Posts
                    .Where(p => p.Id == targetId)
                    .Select(p => (Guid?)p.AuthorId)
                    .FirstOrDefaultAsync(),
                NotificationRefTypes.Post),

            "comment" => (
                await _db.Comments
                    .Where(c => c.Id == targetId)
                    .Select(c => (Guid?)c.AuthorId)
                    .FirstOrDefaultAsync(),
                NotificationRefTypes.Comment),

            "problem" => (
                await _db.Problems
                    .Where(p => p.Id == targetId)
                    .Select(p => (Guid?)p.CreatedBy)
                    .FirstOrDefaultAsync(),
                NotificationRefTypes.Problem),

            "quiz_question" => (
                await _db.Questions
                    .Where(q => q.Id == targetId)
                    .Select(q => (Guid?)q.CreatedBy)
                    .FirstOrDefaultAsync(),
                NotificationRefTypes.Question),

            _ => (null, null)
        };
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

public class CreateReportRequest
{
    public Guid ReportTypeId { get; set; }

    public Guid TargetId { get; set; }

    public string? Description { get; set; }
}

public class ResolveReportRequest
{
    public string Status { get; set; } = "resolved";
}

public class ReportResponse
{
    public Guid Id { get; set; }

    public string TypeName { get; set; } = null!;

    public string? TypeDescription { get; set; }

    public Guid ReporterId { get; set; }

    public string ReporterUsername { get; set; } = null!;

    public string? ReporterAvatarUrl { get; set; }

    public Guid TargetId { get; set; }

    public string? Description { get; set; }

    public string Status { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public string? ResolvedByUsername { get; set; }
}
