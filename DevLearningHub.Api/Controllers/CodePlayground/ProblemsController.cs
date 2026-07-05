using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.CodePlayground;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.CodePlayground;

[ApiController]
[Route("api")]
public class ProblemsController : ControllerBase
{
    private readonly DevLearningHubContext _context;
    private readonly INotificationService _notifications;
    private readonly IPermissionService _permissions;
    private readonly IAutoApprovalPolicy _autoApproval;

    public ProblemsController(
        DevLearningHubContext context,
        INotificationService notifications,
        IPermissionService permissions,
        IAutoApprovalPolicy autoApproval)
    {
        _context = context;
        _notifications = notifications;
        _permissions = permissions;
        _autoApproval = autoApproval;
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
            IsActive = problem.IsActive,
            ReviewStatus = problem.ReviewStatus,
            ReviewNote = problem.ReviewNote,
            CreatedAt = problem.CreatedAt,
            Tags = problem.Tags.Select(t => t.Name).ToList(),
            SampleTestCases = problem.TestCases
                .Where(tc => !tc.IsHidden)
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

        return CreatedAtAction(nameof(GetProblem), new { id = problem.Id }, new ProblemDetailResponse
        {
            Id = problem.Id,
            TopicId = problem.TopicId,
            CreatedBy = problem.CreatedBy,
            Title = problem.Title,
            Description = problem.Description,
            Difficulty = problem.Difficulty,
            StarterCode = problem.StarterCode,
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
}
