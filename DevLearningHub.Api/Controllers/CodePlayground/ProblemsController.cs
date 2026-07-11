using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.CodePlayground;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Hubs;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace DevLearningHub.Api.Controllers.CodePlayground;

[ApiController]
[Route("api")]
public class ProblemsController : ControllerBase
{
    private readonly DevLearningHubContext _context;
    private readonly INotificationService _notifications;
    private readonly IPermissionService _permissions;
    private readonly IAutoApprovalPolicy _autoApproval;
    private readonly IHubContext<NotificationHub, INotificationClient> _notificationHub;

    public ProblemsController(
        DevLearningHubContext context,
        INotificationService notifications,
        IPermissionService permissions,
        IAutoApprovalPolicy autoApproval,
        IHubContext<NotificationHub, INotificationClient> notificationHub)
    {
        _context = context;
        _notifications = notifications;
        _permissions = permissions;
        _autoApproval = autoApproval;
        _notificationHub = notificationHub;
    }

    [HttpGet("problems")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<ProblemSummaryResponse>>> GetProblems([FromQuery] bool mine = false)
    {
        var hasUser = User.TryGetUserId(out var userId);
        if (mine && !hasUser)
        {
            return Unauthorized();
        }

        var query = _context.Problems.AsQueryable();
        if (mine)
        {
            query = query.Where(p => p.CreatedBy == userId);
        }
        else
        {
            query = query.Where(p =>
                p.IsActive &&
                (p.ReviewStatus == "approved" || p.ReviewStatus == null || p.ReviewStatus == string.Empty));
        }

        var problems = await query
            .Include(p => p.Tags)
            .Include(p => p.TestCases)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new ProblemSummaryResponse
            {
                Id = p.Id,
                TopicId = p.TopicId,
                CreatedBy = p.CreatedBy,
                Title = p.Title,
                Difficulty = p.Difficulty,
                IsActive = p.IsActive,
                ReviewStatus = p.ReviewStatus,
                ReviewNote = p.ReviewNote,
                CreatedAt = p.CreatedAt,
                TestCaseCount = p.TestCases.Count,
                Tags = p.Tags.Select(t => t.Name).ToList()
            })
            .ToListAsync();

        return Ok(problems);
    }

    [HttpGet("problems/{id:guid}")]
    [Authorize]
    public async Task<ActionResult<ProblemDetailResponse>> GetProblem(Guid id)
    {
        var problem = await _context.Problems
            .Include(p => p.Tags)
            .Include(p => p.TestCases)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (problem == null)
        {
            return NotFound("Khong tim thay bai tap.");
        }

        User.TryGetUserId(out var viewerId);
        var isOwner = viewerId != Guid.Empty && problem.CreatedBy == viewerId;
        var canReview = viewerId != Guid.Empty && await _permissions.HasPermissionAsync(viewerId, "problem:review");
        var canManage = User.HasPermission("problem:edit");
        var isPubliclyVisible = problem.IsActive &&
            (problem.ReviewStatus == "approved" || string.IsNullOrWhiteSpace(problem.ReviewStatus));
        if (!isPubliclyVisible && !isOwner && !canReview && !canManage)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "Bai tap chua duoc cong khai.");
        }

        return Ok(new ProblemDetailResponse
        {
            Id = problem.Id,
            TopicId = problem.TopicId,
            CreatedBy = problem.CreatedBy,
            Title = problem.Title,
            Description = problem.Description,
            Difficulty = problem.Difficulty,
            StarterCode = problem.StarterCode,
            StarterCodes = ReadStarterCodes(problem),
            LanguageIds = ReadLanguageIds(problem),
            Sandbox = ToSandbox(problem),
            IsActive = problem.IsActive,
            ReviewStatus = problem.ReviewStatus,
            ReviewNote = problem.ReviewNote,
            CreatedAt = problem.CreatedAt,
            Tags = problem.Tags.Select(t => t.Name).ToList(),
            SampleTestCases = problem.TestCases
                .Where(tc => !tc.IsHidden || canReview || canManage)
                .OrderBy(tc => tc.OrderIndex)
                .Select(tc => new PublicTestCaseResponse
                {
                    Id = tc.Id,
                    Input = tc.Input,
                    ExpectedOutput = tc.ExpectedOutput,
                    OrderIndex = tc.OrderIndex
                })
                .ToList()
        });
    }

    [HttpPost("problems")]
    [HasPermission("problem:create")]
    public async Task<ActionResult<ProblemDetailResponse>> CreateProblem([FromBody] CreateProblemRequest request)
    {
        var currentUserId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value!);
        var reviewStatus = await _autoApproval.EvaluateProblemAsync(currentUserId, request.Title, request.Description, isPublic: true);

        var problem = new Problem
        {
            Id = Guid.NewGuid(),
            TopicId = request.TopicId,
            CreatedBy = currentUserId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Difficulty = request.Difficulty,
            StarterCode = request.StarterCode,
            StarterCodesJson = JsonSerializer.Serialize(request.StarterCodes ?? new()),
            AllowedLanguageIdsJson = JsonSerializer.Serialize(await ValidateLanguageIdsAsync(request.LanguageIds)),
            SandboxTimeLimitMs = request.Sandbox.TimeLimitMs,
            SandboxMemoryLimitKb = request.Sandbox.MemoryLimitKb,
            SandboxAllowStdin = request.Sandbox.AllowStdin,
            IsActive = true,
            ReviewStatus = reviewStatus,
            CreatedAt = DateTime.Now
        };

        if (request.TagIds?.Count > 0)
        {
            var tags = await _context.Tags
                .Where(t => request.TagIds.Contains(t.Id))
                .ToListAsync();
            foreach (var tag in tags)
            {
                problem.Tags.Add(tag);
            }
        }

        _context.Problems.Add(problem);
        await _context.SaveChangesAsync();

        if (problem.ReviewStatus == "pending")
        {
            await _notificationHub.Clients.All.ModerationQueueChanged("problem");
        }

        return CreatedAtAction(nameof(GetProblem), new { id = problem.Id }, new ProblemDetailResponse
        {
            Id = problem.Id,
            TopicId = problem.TopicId,
            CreatedBy = problem.CreatedBy,
            Title = problem.Title,
            Description = problem.Description,
            Difficulty = problem.Difficulty,
            StarterCode = problem.StarterCode,
            StarterCodes = ReadStarterCodes(problem),
            LanguageIds = ReadLanguageIds(problem),
            Sandbox = ToSandbox(problem),
            IsActive = problem.IsActive,
            ReviewStatus = problem.ReviewStatus,
            ReviewNote = problem.ReviewNote,
            CreatedAt = problem.CreatedAt,
            Tags = problem.Tags.Select(t => t.Name).ToList()
        });
    }

    [HttpPut("problems/{id:guid}")]
    [Authorize]
    public async Task<IActionResult> UpdateProblem(Guid id, [FromBody] UpdateProblemRequest request)
    {
        var problem = await _context.Problems
            .Include(p => p.Tags)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (problem == null)
        {
            return NotFound();
        }

        if (!CanManageProblem(problem))
        {
            return Forbid();
        }

        problem.TopicId = request.TopicId;
        problem.Title = request.Title.Trim();
        problem.Description = request.Description.Trim();
        problem.Difficulty = request.Difficulty;
        problem.StarterCode = request.StarterCode;
        problem.StarterCodesJson = JsonSerializer.Serialize(request.StarterCodes ?? new());
        problem.AllowedLanguageIdsJson = JsonSerializer.Serialize(await ValidateLanguageIdsAsync(request.LanguageIds));
        problem.SandboxTimeLimitMs = request.Sandbox.TimeLimitMs;
        problem.SandboxMemoryLimitKb = request.Sandbox.MemoryLimitKb;
        problem.SandboxAllowStdin = request.Sandbox.AllowStdin;
        problem.IsActive = request.IsActive;

        var reviewStatus = await _autoApproval.EvaluateProblemAsync(problem.CreatedBy, problem.Title, problem.Description, problem.IsActive);
        ApplyAutoReview(problem, reviewStatus);

        problem.Tags.Clear();
        if (request.TagIds?.Count > 0)
        {
            var tags = await _context.Tags
                .Where(t => request.TagIds.Contains(t.Id))
                .ToListAsync();
            foreach (var tag in tags)
            {
                problem.Tags.Add(tag);
            }
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("problems/{id:guid}")]
    [HasPermission("problem:edit")]
    public async Task<IActionResult> DeleteProblem(Guid id)
    {
        var problem = await _context.Problems.FindAsync(id);
        if (problem == null)
        {
            return NotFound();
        }

        problem.IsActive = false;
        await _context.SaveChangesAsync();

        User.TryGetUserId(out var actorId);
        await _notifications.NotifyAsync(
            recipientId: problem.CreatedBy,
            type: NotificationTypes.ProblemDeleted,
            message: $"Bai tap code \"{problem.Title}\" cua ban da bi xoa boi quan tri vien.",
            refId: problem.Id,
            refType: NotificationRefTypes.Problem,
            actorId: actorId);

        return NoContent();
    }

    [HttpGet("problems/{id:guid}/test-cases")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<TestCaseResponse>>> GetTestCases(Guid id)
    {
        var testCases = await _context.TestCases
            .Where(tc => tc.ProblemId == id)
            .OrderBy(tc => tc.OrderIndex)
            .Select(tc => new TestCaseResponse
            {
                Id = tc.Id,
                ProblemId = tc.ProblemId,
                Input = tc.Input,
                ExpectedOutput = tc.ExpectedOutput,
                IsHidden = tc.IsHidden,
                OrderIndex = tc.OrderIndex
            })
            .ToListAsync();

        return Ok(testCases);
    }

    [HttpGet("programming-languages")]
    [Authorize]
    public async Task<IActionResult> GetProgrammingLanguages()
    {
        var languages = await _context.ProgrammingLanguages.AsNoTracking()
            .Where(l => l.IsActive)
            .OrderBy(l => l.Name)
            .Select(l => new { l.Id, l.Name, l.Slug, l.Judge0LanguageId })
            .ToListAsync();
        return Ok(languages);
    }

    [HttpPost("problems/{id:guid}/test-cases/import")]
    [Authorize]
    [RequestSizeLimit(1024 * 1024)]
    public async Task<IActionResult> ImportTestCases(Guid id, [FromForm] ImportTestCasesRequest request)
    {
        var problem = await _context.Problems.Include(p => p.TestCases).FirstOrDefaultAsync(p => p.Id == id);
        if (problem == null) return NotFound();
        if (!CanManageProblem(problem)) return Forbid();
        if (request.File == null || request.File.Length == 0) return BadRequest("File is required.");

        var rows = new List<(string Input, string ExpectedOutput, bool IsHidden)>();
        using var reader = new StreamReader(request.File.OpenReadStream());
        var content = await reader.ReadToEndAsync();
        try
        {
            if (request.File.FileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            {
                var jsonRows = JsonSerializer.Deserialize<List<ImportTestCaseRow>>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
                rows.AddRange(jsonRows.Select(r => (r.Input ?? string.Empty, r.ExpectedOutput ?? string.Empty, r.IsHidden)));
            }
            else
            {
                var lines = content.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var line in lines.Skip(1))
                {
                    var cells = line.Split(',', 3);
                    if (cells.Length < 2) return BadRequest("CSV must contain input,expectedOutput,isHidden columns.");
                    rows.Add((cells[0].Trim(), cells[1].Trim(), cells.Length > 2 && bool.TryParse(cells[2].Trim(), out var hidden) && hidden));
                }
            }
        }
        catch (JsonException)
        {
            return BadRequest("Invalid testcase file format.");
        }

        if (rows.Count == 0 || rows.Count > 500) return BadRequest("File must contain 1-500 test cases.");
        if (rows.Any(r => string.IsNullOrWhiteSpace(r.Input) || string.IsNullOrWhiteSpace(r.ExpectedOutput)))
            return BadRequest("Input and expectedOutput are required for every row.");

        await using var transaction = _context.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"
            ? null
            : await _context.Database.BeginTransactionAsync();
        if (request.ReplaceExisting) _context.TestCases.RemoveRange(problem.TestCases);
        var start = request.ReplaceExisting ? 0 : (problem.TestCases.Count == 0 ? 0 : problem.TestCases.Max(t => t.OrderIndex) + 1);
        _context.TestCases.AddRange(rows.Select((r, index) => new TestCase
        {
            Id = Guid.NewGuid(), ProblemId = id, Input = r.Input, ExpectedOutput = r.ExpectedOutput,
            IsHidden = r.IsHidden, OrderIndex = (short)(start + index)
        }));
        await _context.SaveChangesAsync();
        if (transaction != null) await transaction.CommitAsync();
        return Ok(new { imported = rows.Count, replaceExisting = request.ReplaceExisting });
    }

    [HttpPost("problems/{id:guid}/test-cases")]
    [Authorize]
    public async Task<IActionResult> AddTestCase(Guid id, [FromBody] CreateTestCaseRequest request)
    {
        var problem = await _context.Problems.FindAsync(id);
        if (problem == null)
        {
            return NotFound("Khong tim thay bai tap tuong ung.");
        }

        if (!CanManageProblem(problem) && !User.HasPermission("problem:create"))
        {
            return Forbid();
        }

        var testCase = new TestCase
        {
            Id = Guid.NewGuid(),
            ProblemId = id,
            Input = request.Input,
            ExpectedOutput = request.ExpectedOutput,
            IsHidden = request.IsHidden,
            OrderIndex = request.OrderIndex
        };

        _context.TestCases.Add(testCase);
        await _context.SaveChangesAsync();

        return Ok(new TestCaseResponse
        {
            Id = testCase.Id,
            ProblemId = testCase.ProblemId,
            Input = testCase.Input,
            ExpectedOutput = testCase.ExpectedOutput,
            IsHidden = testCase.IsHidden,
            OrderIndex = testCase.OrderIndex
        });
    }

    [HttpPut("test-cases/{id:guid}")]
    [Authorize]
    public async Task<IActionResult> UpdateTestCase(Guid id, [FromBody] UpdateTestCaseRequest request)
    {
        var testCase = await _context.TestCases
            .Include(tc => tc.Problem)
            .FirstOrDefaultAsync(tc => tc.Id == id);
        if (testCase == null)
        {
            return NotFound();
        }

        if (!CanManageProblem(testCase.Problem))
        {
            return Forbid();
        }

        testCase.Input = request.Input;
        testCase.ExpectedOutput = request.ExpectedOutput;
        testCase.IsHidden = request.IsHidden;
        testCase.OrderIndex = request.OrderIndex;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("test-cases/{id:guid}")]
    [Authorize]
    public async Task<IActionResult> DeleteTestCase(Guid id)
    {
        var testCase = await _context.TestCases
            .Include(tc => tc.Problem)
            .FirstOrDefaultAsync(tc => tc.Id == id);
        if (testCase == null)
        {
            return NotFound();
        }

        if (!CanManageProblem(testCase.Problem))
        {
            return Forbid();
        }

        _context.TestCases.Remove(testCase);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private bool CanManageProblem(Problem problem)
    {
        return User.HasPermission("problem:edit")
            || (User.TryGetUserId(out var userId) && problem.CreatedBy == userId);
    }

    private static void ApplyAutoReview(Problem problem, string reviewStatus)
    {
        problem.ReviewStatus = reviewStatus;
        if (!string.Equals(reviewStatus, "approved", StringComparison.OrdinalIgnoreCase))
        {
            problem.ReviewedBy = null;
            problem.ReviewedAt = null;
            problem.ReviewNote = null;
        }
    }

    private async Task<List<int>> ValidateLanguageIdsAsync(IEnumerable<int>? ids)
    {
        var requested = (ids ?? Enumerable.Empty<int>()).Distinct().ToList();
        if (requested.Count == 0) return new();
        var active = await _context.ProgrammingLanguages.Where(l => requested.Contains(l.Id) && l.IsActive).Select(l => l.Id).ToListAsync();
        if (active.Count != requested.Count) throw new ArgumentException("One or more programming languages are inactive or invalid.");
        return active;
    }

    private static Dictionary<string, string> ReadStarterCodes(Problem problem)
    {
        if (string.IsNullOrWhiteSpace(problem.StarterCodesJson)) return new(StringComparer.OrdinalIgnoreCase);
        try { return JsonSerializer.Deserialize<Dictionary<string, string>>(problem.StarterCodesJson) ?? new(StringComparer.OrdinalIgnoreCase); }
        catch (JsonException) { return new(StringComparer.OrdinalIgnoreCase); }
    }

    private static List<int> ReadLanguageIds(Problem problem)
    {
        if (string.IsNullOrWhiteSpace(problem.AllowedLanguageIdsJson)) return new();
        try { return JsonSerializer.Deserialize<List<int>>(problem.AllowedLanguageIdsJson) ?? new(); }
        catch (JsonException) { return new(); }
    }

    private static SandboxConfigResponse ToSandbox(Problem problem) => new()
    {
        TimeLimitMs = problem.SandboxTimeLimitMs,
        MemoryLimitKb = problem.SandboxMemoryLimitKb,
        AllowStdin = problem.SandboxAllowStdin
    };

    private sealed class ImportTestCaseRow
    {
        public string? Input { get; set; }
        public string? ExpectedOutput { get; set; }
        public bool IsHidden { get; set; }
    }
}
