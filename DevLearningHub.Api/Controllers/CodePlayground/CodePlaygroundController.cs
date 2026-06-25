using DevLearningHub.Api.Dtos.CodePlayground;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DevLearningHub.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize] // Tất cả endpoint trong controller này yêu cầu User+ đăng nhập
public class CodePlaygroundController : ControllerBase
{
    private readonly DevLearningHubContext _context;
    private readonly IJudge0Service _judge0Service;

    public CodePlaygroundController(DevLearningHubContext context, IJudge0Service judge0Service)
    {
        _context = context;
        _judge0Service = judge0Service;
    }

    // 44. POST /api/code/run - Chạy thử code nhanh với 1 input custom
    [HttpPost("code/run")]
    public async Task<ActionResult<CodeRunResponse>> RunCode([FromBody] CodeRunRequest request)
    {
        var result = await _judge0Service.RunAsync(request.Code, request.LanguageId, request.Stdin);

        var response = new CodeRunResponse
        {
            Stdout = result.Stdout,
            Stderr = result.Stderr,
            CompileOutput = result.CompileOutput,
            Status = result.Status,
            RuntimeMs = result.Time != null ? (int)(result.Time * 1000) : null,
            MemoryKb = result.Memory
        };

        return Ok(response);
    }

    // 45. POST /api/code/submit - Nộp bài — chấm toàn bộ test
    [HttpPost("code/submit")]
    public async Task<ActionResult<CodeSubmitResponse>> SubmitCode([FromBody] CodeSubmitRequest request)
    {
        var currentUserId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);

        // 1. Lấy thông tin ngôn ngữ lập trình để lưu tên ngôn ngữ (ví dụ: "C++", "Java")
        var langEntity = await _context.ProgrammingLanguages
            .FirstOrDefaultAsync(l => l.Judge0LanguageId == request.LanguageId);
        string languageName = langEntity?.Name ?? $"Language #{request.LanguageId}";

        // 2. Lấy toàn bộ test cases của bài tập ra
        var testCases = await _context.TestCases
            .Where(tc => tc.ProblemId == request.ProblemId)
            .OrderBy(tc => tc.OrderIndex)
            .ToListAsync();

        if (!testCases.Any())
            return BadRequest("Bài tập này hiện chưa có bộ Test Case để hệ thống chấm điểm.");

        // 3. Map sang định dạng Batch của Judge0 để gửi đi chấm song song
        var judge0Submissions = testCases.Select(tc => new Judge0Submission
        {
            SourceCode = request.Code,
            LanguageId = request.LanguageId,
            Stdin = tc.Input,
            ExpectedOutput = tc.ExpectedOutput
        }).ToList();

        // 4. Gọi Judge0 chấm hàng loạt (Đã có sẵn logic Polling chờ kết quả bên trong Service của bạn)
        var judgeResults = await _judge0Service.SubmitBatchAsync(judge0Submissions);

        // 5. Khởi tạo thực thể Submission để chuẩn bị lưu database
        var submission = new Submission
        {
            Id = Guid.NewGuid(),
            UserId = currentUserId,
            ProblemId = request.ProblemId,
            Code = request.Code,
            Language = languageName,
            LanguageId = request.LanguageId,
            SubmittedAt = DateTime.UtcNow,
            // Sẽ update chi tiết lỗi tổng quan ở bước duyệt kết quả dưới đây
            Verdict = "Accepted",
            PassedCases = 0,
            TotalCases = (short)testCases.Count
        };

        int maxRuntimeMs = 0;
        int maxMemoryKb = 0;

        // 6. Duyệt qua kết quả của từng Test Case để tạo SubmissionTestResult
        for (int i = 0; i < testCases.Count; i++)
        {
            var tc = testCases[i];
            // Phòng trường hợp kết quả trả về từ Judge0 bị lệch số lượng (timeout, lỗi mạng...)
            var res = i < judgeResults.Count ? judgeResults[i] : null;

            var testResult = new SubmissionTestResult
            {
                Id = Guid.NewGuid(),
                SubmissionId = submission.Id,
                TestCaseId = tc.Id,
                Status = res?.Status ?? "Unknown Error",
                ActualOutput = res?.Stdout,
                RuntimeMs = res?.Time != null ? (int)(res.Time * 1000) : null,
                MemoryKb = res?.Memory
            };

            // Nếu đây là test case chạy đầu tiên mà bị lỗi, hoặc tích lũy lỗi, cập nhật trạng thái tổng quan cho bài nộp (Verdict)
            if (res != null)
            {
                if (res.StatusId == 3) // 3 tương ứng với 'Accepted' trong chuẩn Judge0
                {
                    submission.PassedCases++;
                }
                else if (submission.Verdict == "Accepted")
                {
                    // Lấy lỗi của case thất bại đầu tiên làm Verdict chung cho bài nộp (ví dụ: Wrong Answer, Time Limit Exceeded)
                    submission.Verdict = res.Status;
                    submission.Stdout = res.Stdout;
                    submission.Stderr = res.Stderr;
                    submission.CompileOutput = res.CompileOutput;
                    submission.Judge0Token = res.Token;
                }

                // Tính Runtime/Memory lớn nhất trong tất cả các test cases
                int currentRuntimeMs = res.Time != null ? (int)(res.Time * 1000) : 0;
                if (currentRuntimeMs > maxRuntimeMs) maxRuntimeMs = currentRuntimeMs;
                if (res.Memory != null && res.Memory > maxMemoryKb) maxMemoryKb = res.Memory.Value;
            }

            submission.SubmissionTestResults.Add(testResult);
        }

        // Cập nhật lại số hiệu năng cao nhất của lượt nộp
        submission.RuntimeMs = maxRuntimeMs > 0 ? maxRuntimeMs : null;
        submission.MemoryKb = maxMemoryKb > 0 ? maxMemoryKb : null;

        // 7. Lưu tất cả vào Database
        _context.Submissions.Add(submission);
        await _context.SaveChangesAsync();

        // 8. Trả về kết quả hiển thị nhanh gọn cho Client
        var response = new CodeSubmitResponse
        {
            SubmissionId = submission.Id,
            Verdict = submission.Verdict,
            PassedCases = submission.PassedCases,
            TotalCases = submission.TotalCases,
            RuntimeMs = submission.RuntimeMs,
            MemoryKb = submission.MemoryKb
        };

        return Ok(response);
    }

    // 46. GET /api/submissions - Lịch sử nộp bài cá nhân (User+)
    [HttpGet("submissions")]
    public async Task<ActionResult<IEnumerable<SubmissionSummaryResponse>>> GetMySubmissions()
    {
        var currentUserId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);

        var history = await _context.Submissions
            .Where(s => s.UserId == currentUserId)
            .Include(s => s.Problem)
            .OrderByDescending(s => s.SubmittedAt)
            .Select(s => new SubmissionSummaryResponse
            {
                Id = s.Id,
                ProblemId = s.ProblemId,
                ProblemTitle = s.Problem.Title,
                Language = s.Language,
                Verdict = s.Verdict,
                PassedCases = s.PassedCases,
                TotalCases = s.TotalCases,
                RuntimeMs = s.RuntimeMs,
                MemoryKb = s.MemoryKb,
                SubmittedAt = s.SubmittedAt
            }).ToListAsync();

        return Ok(history);
    }

    // 47. GET /api/submissions/{id} - Chi tiết lần nộp + kết quả từng test
    [HttpGet("submissions/{id:guid}")]
    public async Task<ActionResult<SubmissionDetailResponse>> GetSubmissionDetail(Guid id)
    {
        var currentUserId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
        var userRoles = User.FindAll(ClaimTypes.Role).Select(r => r.Value).ToList();

        // Tìm lượt nộp bài kèm theo thông tin bài tập và chi tiết từng kết quả test
        var submission = await _context.Submissions
            .Include(s => s.Problem)
            .Include(s => s.SubmissionTestResults)
                .ThenInclude(str => str.TestCase)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (submission == null)
            return NotFound("Không tìm thấy thông tin lượt nộp bài này.");

        // Đảm bảo bảo mật: Người xem phải là chính chủ lượt nộp hoặc là Admin
        if (submission.UserId != currentUserId && !userRoles.Contains("Admin"))
            return Forbid("Bạn không có quyền xem chi tiết lượt nộp của người khác.");

        var response = new SubmissionDetailResponse
        {
            Id = submission.Id,
            ProblemId = submission.ProblemId,
            ProblemTitle = submission.Problem.Title,
            Language = submission.Language,
            Verdict = submission.Verdict,
            PassedCases = submission.PassedCases,
            TotalCases = submission.TotalCases,
            RuntimeMs = submission.RuntimeMs,
            MemoryKb = submission.MemoryKb,
            SubmittedAt = submission.SubmittedAt,
            Code = submission.Code,
            Stdout = submission.Stdout,
            Stderr = submission.Stderr,
            CompileOutput = submission.CompileOutput,
            TestResults = submission.SubmissionTestResults.Select(str => new SubmissionTestResultResponse
            {
                TestCaseId = str.TestCaseId,
                Status = str.Status,
                ActualOutput = str.TestCase.IsHidden && !userRoles.Contains("Admin") ? "⚠️ Hidden Test Case" : str.ActualOutput,
                RuntimeMs = str.RuntimeMs,
                MemoryKb = str.MemoryKb,
                IsHidden = str.TestCase.IsHidden,
                OrderIndex = str.TestCase.OrderIndex,
                // Logic bảo mật: Ẩn thông tin Input / ExpectedOutput nếu đây là Hidden Test Case (trừ khi người xem là Admin)
                Input = str.TestCase.IsHidden && !userRoles.Contains("Admin") ? "⚠️ Hidden" : str.TestCase.Input,
                ExpectedOutput = str.TestCase.IsHidden && !userRoles.Contains("Admin") ? "⚠️ Hidden" : str.TestCase.ExpectedOutput
            }).OrderBy(tr => tr.OrderIndex).ToList()
        };

        return Ok(response);
    }
}