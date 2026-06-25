using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;

namespace DevLearningHub.Api.Services;

// Central place to record an audit trail entry for a user action.
public interface IAuditService
{
    /// <summary>
    /// Write one audit log row. The actor is taken from the current HTTP user unless
    /// <paramref name="actorId"/> is supplied (e.g. during login when the principal is not set yet).
    /// </summary>
    Task LogAsync(
        string action,
        string? targetType = null,
        Guid? targetId = null,
        string? detail = null,
        Guid? actorId = null);
}

public sealed class AuditService : IAuditService
{
    // The audit_logs columns are capped at these lengths (detail is nvarchar(max)).
    private const int ActionMaxLength = 100;
    private const int TargetTypeMaxLength = 50;
    private const int IpMaxLength = 50;

    private readonly DevLearningHubContext _db;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<AuditService> _logger;

    public AuditService(
        DevLearningHubContext db,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AuditService> logger)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public async Task LogAsync(
        string action,
        string? targetType = null,
        Guid? targetId = null,
        string? detail = null,
        Guid? actorId = null)
    {
        var httpContext = _httpContextAccessor.HttpContext;

        var resolvedActorId = actorId ?? ResolveActorId(httpContext);
        if (resolvedActorId is null || resolvedActorId == Guid.Empty)
        {
            // Never block the main operation just because we could not attribute an actor.
            _logger.LogWarning("Skipped audit log for {Action}: no actor id available.", action);
            return;
        }

        var entry = new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = resolvedActorId.Value,
            Action = Truncate(action, ActionMaxLength) ?? string.Empty,
            TargetType = Truncate(targetType, TargetTypeMaxLength),
            TargetId = targetId,
            Detail = detail,
            IpAddress = Truncate(httpContext?.Connection.RemoteIpAddress?.ToString(), IpMaxLength),
            CreatedAt = DateTime.Now
        };

        try
        {
            _db.AuditLogs.Add(entry);
            await _db.SaveChangesAsync();
            _logger.LogInformation("Audit log written: {Action} by {ActorId}", action, resolvedActorId);
        }
        catch (Exception ex)
        {
            // Auditing is best-effort: a logging failure must not break the user-facing request.
            _logger.LogError(ex, "Failed to write audit log for {Action}.", action);
        }
    }

    private static Guid? ResolveActorId(HttpContext? httpContext)
    {
        if (httpContext?.User is null)
        {
            return null;
        }

        return httpContext.User.TryGetUserId(out var id) ? id : null;
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return value;
        }

        return value[..maxLength];
    }
}
