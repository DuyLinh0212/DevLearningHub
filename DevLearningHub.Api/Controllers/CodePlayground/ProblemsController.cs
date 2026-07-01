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

	public ProblemsController(DevLearningHubContext context, INotificationService notifications)
	{
		_context = context;
		_notifications = notifications;
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
				CreatedBy = p.CreatedBy,
				Title = p.Title,
				Difficulty = p.Difficulty,
				IsActive = p.IsActive,
				CreatedAt = p.CreatedAt,
				TestCaseCount = p.TestCases.Count,
				Tags = p.Tags.Select(t => t.Name).ToList()
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

    // 37. POST /api/problems (Authenticated users)
    [HttpPost("problems")]
    [HasPermission("problem:create")]
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
			CreatedAt = DateTime.Now
		};

		// Map tags nếu có
		if (request.TagIds?.Count > 0)
		{
			var tags = await _context.Tags
				.Where(t => request.TagIds.Contains(t.Id))
				.ToListAsync();
			foreach (var tag in tags)
				problem.Tags.Add(tag);
		}

		_context.Problems.Add(problem);
		await _context.SaveChangesAsync();

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
			Tags = problem.Tags.Select(t => t.Name).ToList()
		};

		return CreatedAtAction(nameof(GetProblem), new { id = problem.Id }, response);
	}

    // 38. PUT /api/problems/{id} (Admin + Moderator)
    [HttpPut("problems/{id:guid}")]
    [Authorize]
    public async Task<IActionResult> UpdateProblem(Guid id, [FromBody] UpdateProblemRequest request)
	{
		var problem = await _context.Problems.FindAsync(id);
		if (problem == null) return NotFound();
		if (!CanManageProblem(problem)) return Forbid();

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
    [HasPermission("problem:edit")]
    public async Task<IActionResult> DeleteProblem(Guid id)
	{
		var problem = await _context.Problems.FindAsync(id);
		if (problem == null) return NotFound();

		problem.IsActive = false; // Xóa mềm bằng cách hạ Active xuống false
		await _context.SaveChangesAsync();

		// Notify the problem creator their exercise was removed (skipped if self-deleted).
		User.TryGetUserId(out var actorId);
		await _notifications.NotifyAsync(
			recipientId: problem.CreatedBy,
			type: NotificationTypes.ProblemDeleted,
			message: $"Bài tập code \"{problem.Title}\" của bạn đã bị xóa bởi quản trị viên.",
			refId: problem.Id,
			refType: NotificationRefTypes.Problem,
			actorId: actorId);

		return NoContent();
	}

	// ── Quản lý Test Cases (Admin) ────────────────────────────────────────────

	// 40. GET /api/problems/{id}/test-cases (Admin + Moderator)
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
			}).ToListAsync();

		return Ok(testCases);
	}

	// 41. POST /api/problems/{id}/test-cases (Admin + Moderator)
	[HttpPost("problems/{id:guid}/test-cases")]
    [Authorize]
    public async Task<IActionResult> AddTestCase(Guid id, [FromBody] CreateTestCaseRequest request)
	{
		var problem = await _context.Problems.FindAsync(id);
		var problemExists = problem != null;
		if (!problemExists) return NotFound("Không tìm thấy bài tập tương ứng.");

		if (!CanManageProblem(problem!) && !User.HasPermission("problem:create")) return Forbid();

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

	// 42. PUT /api/test-cases/{id} (Admin + Moderator)
	[HttpPut("test-cases/{id:guid}")]
    [Authorize]
    public async Task<IActionResult> UpdateTestCase(Guid id, [FromBody] UpdateTestCaseRequest request)
	{
		var testCase = await _context.TestCases
			.Include(tc => tc.Problem)
			.FirstOrDefaultAsync(tc => tc.Id == id);
		if (testCase == null) return NotFound();
		if (!CanManageProblem(testCase.Problem)) return Forbid();

		testCase.Input = request.Input;
		testCase.ExpectedOutput = request.ExpectedOutput;
		testCase.IsHidden = request.IsHidden;
		testCase.OrderIndex = request.OrderIndex;

		await _context.SaveChangesAsync();
		return NoContent();
	}

	// 43. DELETE /api/test-cases/{id} (Admin + Moderator)
	[HttpDelete("test-cases/{id:guid}")]
    [Authorize]
    public async Task<IActionResult> DeleteTestCase(Guid id)
	{
		var testCase = await _context.TestCases
			.Include(tc => tc.Problem)
			.FirstOrDefaultAsync(tc => tc.Id == id);
		if (testCase == null) return NotFound();
		if (!CanManageProblem(testCase.Problem)) return Forbid();

		_context.TestCases.Remove(testCase);
		await _context.SaveChangesAsync();
		return NoContent();
	}

	private bool CanManageProblem(Problem problem)
	{
		return User.HasPermission("problem:edit")
			|| (User.TryGetUserId(out var userId) && problem.CreatedBy == userId);
	}
}
