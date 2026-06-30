using System.ComponentModel.DataAnnotations;

namespace DevLearningHub.Api.Dtos.CodePlayground;

// ── Problems ──────────────────────────────────────────────────────────────────

public class ProblemSummaryResponse
{
    public Guid Id { get; set; }
    public Guid TopicId { get; set; }
    public Guid CreatedBy { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public int TestCaseCount { get; set; }
    public List<string> Tags { get; set; } = new();
}

public class ProblemDetailResponse
{
    public Guid Id { get; set; }
    public Guid TopicId { get; set; }
    public Guid CreatedBy { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public string? StarterCode { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<string> Tags { get; set; } = new();
    public List<PublicTestCaseResponse> SampleTestCases { get; set; } = new();
}

public class PublicTestCaseResponse
{
    public Guid Id { get; set; }
    public string Input { get; set; } = string.Empty;
    public string ExpectedOutput { get; set; } = string.Empty;
    public short OrderIndex { get; set; }
}

public class CreateProblemRequest
{
    [Required]
    public Guid TopicId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    [MaxLength(10)]
    public string Difficulty { get; set; } = "easy";

    public string? StarterCode { get; set; }

    public List<Guid> TagIds { get; set; } = new();
}

public class UpdateProblemRequest
{
    [Required]
    public Guid TopicId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    [MaxLength(10)]
    public string Difficulty { get; set; } = "easy";

    public string? StarterCode { get; set; }

    public bool IsActive { get; set; } = true;

    public List<Guid> TagIds { get; set; } = new();
}

// ── Test Cases ────────────────────────────────────────────────────────────────

public class TestCaseResponse
{
    public Guid Id { get; set; }
    public Guid ProblemId { get; set; }
    public string Input { get; set; } = string.Empty;
    public string ExpectedOutput { get; set; } = string.Empty;
    public bool IsHidden { get; set; }
    public short OrderIndex { get; set; }
}

public class CreateTestCaseRequest
{
    [Required]
    public string Input { get; set; } = string.Empty;

    [Required]
    public string ExpectedOutput { get; set; } = string.Empty;

    public bool IsHidden { get; set; } = false;

    public short OrderIndex { get; set; } = 0;
}

public class UpdateTestCaseRequest
{
    [Required]
    public string Input { get; set; } = string.Empty;

    [Required]
    public string ExpectedOutput { get; set; } = string.Empty;

    public bool IsHidden { get; set; }

    public short OrderIndex { get; set; }
}

// ── Code Run / Submit ─────────────────────────────────────────────────────────

public class CodeRunRequest
{
    [Required]
    public string Code { get; set; } = string.Empty;

    [Required]
    public int LanguageId { get; set; }

    public string Stdin { get; set; } = string.Empty;
}

public class CodeRunResponse
{
    public string? Stdout { get; set; }
    public string? Stderr { get; set; }
    public string? CompileOutput { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? RuntimeMs { get; set; }
    public int? MemoryKb { get; set; }
}

public class CodeSubmitRequest
{
    [Required]
    public Guid ProblemId { get; set; }

    [Required]
    public string Code { get; set; } = string.Empty;

    [Required]
    public int LanguageId { get; set; }
}

public class CodeSubmitResponse
{
    public Guid SubmissionId { get; set; }
    public string Verdict { get; set; } = string.Empty;
    public short PassedCases { get; set; }
    public short TotalCases { get; set; }
    public int? RuntimeMs { get; set; }
    public int? MemoryKb { get; set; }
}

// ── Submissions ───────────────────────────────────────────────────────────────

public class SubmissionSummaryResponse
{
    public Guid Id { get; set; }
    public Guid ProblemId { get; set; }
    public string ProblemTitle { get; set; } = string.Empty;
    public string Language { get; set; } = string.Empty;
    public string Verdict { get; set; } = string.Empty;
    public short PassedCases { get; set; }
    public short TotalCases { get; set; }
    public int? RuntimeMs { get; set; }
    public int? MemoryKb { get; set; }
    public DateTime SubmittedAt { get; set; }
}

public class SubmissionDetailResponse : SubmissionSummaryResponse
{
    public string Code { get; set; } = string.Empty;
    public string? Stdout { get; set; }
    public string? Stderr { get; set; }
    public string? CompileOutput { get; set; }
    public List<SubmissionTestResultResponse> TestResults { get; set; } = new();
}

public class SubmissionTestResultResponse
{
    public Guid TestCaseId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ActualOutput { get; set; }
    public int? RuntimeMs { get; set; }
    public int? MemoryKb { get; set; }
    public bool IsHidden { get; set; }
    public string Input { get; set; } = string.Empty;
    public string ExpectedOutput { get; set; } = string.Empty;
    public short OrderIndex { get; set; }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

public class UpdateJudgeUrlRequest
{
    [Required]
    [Url]
    public string Url { get; set; } = string.Empty;
}

public class JudgeUrlResponse
{
    public string Url { get; set; } = string.Empty;
}
