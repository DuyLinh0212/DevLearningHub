using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.CodePlayground;
using DevLearningHub.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.CodePlayground;

[ApiController]
[Route("api")]
public class ProblemsController : ControllerBase
{
    private readonly DevLearningHubContext _context;

    public ProblemsController(DevLearningHubContext context)
    {
        _context = context;
    }

    // 35. GET /api/problems (Public)
    [HttpGet("problems")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<ProblemSummaryResponse>>> GetProblems()
    {
        var problems = await _context.Problems
            .Where(p => p.IsActive)
            .Include(p => p.Tags)
            .Include(p => p.TestCases)
            .Select(p => new ProblemSummaryResponse
            {
                Id = p.Id,
                TopicId = p.TopicId,
                Title = p.Title,
                Difficulty = p.Difficulty,
                IsActive = p.IsActive,
                CreatedAt = p.CreatedAt,
                TestCaseCount = p.TestCases.Count,
                Tags = p.Tags.Select(t => t.Name).ToList() // Giả định Tag có thuộc tính Name
            }).ToListAsync();

        return Ok(problems);
    }

    // 36. GET /api/problems/{id} (User+)
    [HttpGet("problems/{id:guid}")]
    [Authorize]
    public async Task<ActionResult<ProblemDetailResponse>> GetProblem(Guid id)
    {
        var problem = await _context.Problems
            .Include(p => p.Tags)
            .Include(p => p.TestCases)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (problem == null) return NotFound("Không tìm thấy bài tập.");

        var response = new ProblemDetailResponse
        {
            Id = problem.Id,
            TopicId = problem.TopicId,
            CreatedBy = problem.CreatedBy,
            Title = problem.Title,
            Description = problem.Description,
            Difficulty = problem.Difficulty,
            StarterCode = problem.StarterCode,
            IsActive = problem.IsActive,
            CreatedAt = problem.CreatedAt,
            Tags = problem.Tags.Select(t => t.Name).ToList(),
            // Chỉ lấy các test case công khai (IsHidden == false) cho học viên xem mẫu
            SampleTestCases = problem.TestCases
                .Where(tc => !tc.IsHidden)
                .OrderBy(tc => tc.OrderIndex)
                .Select(tc => new PublicTestCaseResponse
                {
                    Id = tc.Id,
                    Input = tc.Input,
                    ExpectedOutput = tc.ExpectedOutput,
                    OrderIndex = tc.OrderIndex
                }).ToList()
        };

        return Ok(response);
    }

    // 37. POST /api/problems (Admin + Moderator)
    [HttpPost("problems")]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Moderator}")]
    public async Task<ActionResult<ProblemDetailResponse>> CreateProblem([FromBody] CreateProblemRequest request)
    {
        var currentUserId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value!);

        var problem = new Problem
        {
            Id = Guid.NewGuid(),
            TopicId = request.TopicId,
            CreatedBy = currentUserId,
            Title = request.Title,
            Description = request.Description,
            Difficulty = request.Difficulty,
            StarterCode = request.StarterCode,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        // TODO: Map thêm Tags từ request.TagIds vào problem.Tags nếu cần

        _context.Problems.Add(problem);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProblem), new { id = problem.Id }, null);
    }

    // 38. PUT /api/problems/{id} (Admin + Moderator)
    [HttpPut("problems/{id:guid}")]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Moderator}")]
    public async Task<IActionResult> UpdateProblem(Guid id, [FromBody] UpdateProblemRequest request)
    {
        var problem = await _context.Problems.FindAsync(id);
        if (problem == null) return NotFound();

        problem.TopicId = request.TopicId;
        problem.Title = request.Title;
        problem.Description = request.Description;
        problem.Difficulty = request.Difficulty;
        problem.StarterCode = request.StarterCode;
        problem.IsActive = request.IsActive;

        // TODO: Cập nhật lại danh sách Tags (Xóa cũ thêm mới)

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // 39. DELETE /api/problems/{id} -> Xóa mềm (Admin + Moderator)
    [HttpDelete("problems/{id:guid}")]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Moderator}")]
    public async Task<IActionResult> DeleteProblem(Guid id)
    {
        var problem = await _context.Problems.FindAsync(id);
        if (problem == null) return NotFound();

        problem.IsActive = false; // Xóa mềm bằng cách hạ Active xuống false
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // ── Quản lý Test Cases (Admin) ────────────────────────────────────────────

    // 40. GET /api/problems/{id}/test-cases (Admin + Moderator)
    [HttpGet("problems/{id:guid}/test-cases")]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Moderator}")]
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
            }).ToListAsync();

        return Ok(testCases);
    }

    // 41. POST /api/problems/{id}/test-cases (Admin + Moderator)
    [HttpPost("problems/{id:guid}/test-cases")]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Moderator}")]
    public async Task<IActionResult> AddTestCase(Guid id, [FromBody] CreateTestCaseRequest request)
    {
        var problemExists = await _context.Problems.AnyAsync(p => p.Id == id);
        if (!problemExists) return NotFound("Không tìm thấy bài tập tương ứng.");

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
        return Ok(testCase);
    }

    // 42. PUT /api/test-cases/{id} (Admin + Moderator)
    [HttpPut("test-cases/{id:guid}")]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Moderator}")]
    public async Task<IActionResult> UpdateTestCase(Guid id, [FromBody] UpdateTestCaseRequest request)
    {
        var testCase = await _context.TestCases.FindAsync(id);
        if (testCase == null) return NotFound();

        testCase.Input = request.Input;
        testCase.ExpectedOutput = request.ExpectedOutput;
        testCase.IsHidden = request.IsHidden;
        testCase.OrderIndex = request.OrderIndex;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // 43. DELETE /api/test-cases/{id} (Admin + Moderator)
    [HttpDelete("test-cases/{id:guid}")]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Moderator}")]
    public async Task<IActionResult> DeleteTestCase(Guid id)
    {
        var testCase = await _context.TestCases.FindAsync(id);
        if (testCase == null) return NotFound();

        _context.TestCases.Remove(testCase);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}