using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Admin;
using DevLearningHub.Api.Dtos.CodePlayground;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Admin;

[ApiController]
[Route("api/admin/analytics")]
[Authorize]
public class AdminAnalyticsController : ControllerBase
{
    private const string AcceptedVerdict = "accepted";

    private readonly DevLearningHubContext _db;

    public AdminAnalyticsController(DevLearningHubContext db)
    {
        _db = db;
    }

    [HttpGet("quiz-sets")]
    [HasPermission("analytics:view")]
    public async Task<ActionResult<ApiResponse<List<QuizSetAnalyticsResponse>>>> GetQuizSetStats()
    {
        var stats = await _db.QuizSets
            .AsNoTracking()
            .OrderByDescending(q => q.CreatedAt)
            .Select(q => new QuizSetAnalyticsResponse
            {
                QuizSetId = q.Id,
                Title = q.Title,
                TotalAttempts = q.QuizSessions.Count,
                CompletedAttempts = q.QuizSessions.Count(s => s.Status == "completed"),
                ParticipantCount = q.QuizSessions.Select(s => s.UserId).Distinct().Count(),
                AverageScore = q.QuizSessions.Where(s => s.Status == "completed" && s.Score.HasValue)
                    .Select(s => (double?)s.Score!.Value)
                    .Average() ?? 0,
                AverageAccuracy = q.QuizSessions.Where(s => s.Status == "completed")
                    .Select(s => (double?)(s.TotalQuestions == 0 ? 0 : (double)(s.Score ?? 0) / s.TotalQuestions))
                    .Average() ?? 0,
                LastAttemptAt = q.QuizSessions
                    .OrderByDescending(s => s.StartedAt)
                    .Select(s => (DateTime?)s.StartedAt)
                    .FirstOrDefault()
            })
            .ToListAsync();

        return Ok(ApiResponse<List<QuizSetAnalyticsResponse>>.Ok(stats));
    }

    [HttpGet("quiz-sets/{id:guid}/participants")]
    [HasPermission("analytics:view")]
    public async Task<ActionResult<ApiResponse<List<QuizSetParticipantResponse>>>> GetQuizSetParticipants(Guid id)
    {
        var exists = await _db.QuizSets.AnyAsync(q => q.Id == id);
        if (!exists)
        {
            return NotFound(ApiResponse<List<QuizSetParticipantResponse>>.Fail("Quiz set not found."));
        }

        var sessions = await _db.QuizSessions
            .AsNoTracking()
            .Where(s => s.QuizSetId == id)
            .Select(s => new
            {
                s.UserId,
                s.User.Username,
                s.User.FullName,
                s.Status,
                s.Score,
                s.TotalQuestions,
                s.StartedAt,
                s.EndedAt
            })
            .ToListAsync();

        var result = sessions
            .GroupBy(s => new { s.UserId, s.Username, s.FullName })
            .Select(g =>
            {
                var completed = g.Where(s => s.Status == "completed").ToList();
                var best = completed
                    .OrderByDescending(s => s.TotalQuestions == 0 ? 0 : (double)(s.Score ?? 0) / s.TotalQuestions)
                    .FirstOrDefault();

                return new QuizSetParticipantResponse
                {
                    UserId = g.Key.UserId,
                    Username = g.Key.Username,
                    FullName = g.Key.FullName,
                    AttemptsCount = g.Count(),
                    CompletedAttempts = completed.Count,
                    BestScore = best?.Score ?? 0,
                    BestTotalQuestions = best?.TotalQuestions ?? 0,
                    BestAccuracy = best == null || best.TotalQuestions == 0 ? 0 : (double)(best.Score ?? 0) / best.TotalQuestions,
                    LastAttemptAt = g.Max(s => (DateTime?)(s.EndedAt ?? s.StartedAt))
                };
            })
            .OrderByDescending(p => p.BestAccuracy)
            .ThenByDescending(p => p.LastAttemptAt)
            .ToList();

        return Ok(ApiResponse<List<QuizSetParticipantResponse>>.Ok(result));
    }

    [HttpGet("problem-banks")]
    [HasPermission("analytics:view")]
    public async Task<ActionResult<ApiResponse<List<ProblemBankAnalyticsResponse>>>> GetProblemBankStats()
    {
        var banks = await _db.ProblemBanks
            .AsNoTracking()
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                b.Id,
                b.Title,
                ProblemIds = b.Items.Select(i => i.ProblemId).ToList()
            })
            .ToListAsync();

        var result = new List<ProblemBankAnalyticsResponse>();
        foreach (var bank in banks)
        {
            var submissions = bank.ProblemIds.Count == 0
                ? new List<Submission>()
                : await _db.Submissions.AsNoTracking()
                    .Where(s => bank.ProblemIds.Contains(s.ProblemId))
                    .ToListAsync();

            var participantStats = BuildProblemBankParticipants(bank.ProblemIds, submissions);
            result.Add(new ProblemBankAnalyticsResponse
            {
                BankId = bank.Id,
                Title = bank.Title,
                ProblemCount = bank.ProblemIds.Count,
                ParticipantCount = participantStats.Count,
                AverageCompletionPercent = participantStats.Count == 0 ? 0 : Math.Round(participantStats.Average(p => p.CompletionPercent), 2),
                AverageAccuracyPercent = participantStats.Count == 0 ? 0 : Math.Round(participantStats.Average(p => p.AvgAccuracyPercent), 2),
                SolvedSubmissionCount = submissions.Count(s => string.Equals(s.Verdict, AcceptedVerdict, StringComparison.OrdinalIgnoreCase))
            });
        }

        return Ok(ApiResponse<List<ProblemBankAnalyticsResponse>>.Ok(result));
    }

    [HttpGet("problem-banks/{id:guid}/participants")]
    [HasPermission("analytics:view")]
    public async Task<ActionResult<ApiResponse<List<ProblemBankParticipantResponse>>>> GetProblemBankParticipants(Guid id)
    {
        var bank = await _db.ProblemBanks
            .AsNoTracking()
            .Where(b => b.Id == id)
            .Select(b => new
            {
                ProblemIds = b.Items.Select(i => i.ProblemId).ToList()
            })
            .FirstOrDefaultAsync();

        if (bank == null)
        {
            return NotFound(ApiResponse<List<ProblemBankParticipantResponse>>.Fail("Problem bank not found."));
        }

        var submissions = bank.ProblemIds.Count == 0
            ? new List<Submission>()
            : await _db.Submissions.AsNoTracking()
                .Where(s => bank.ProblemIds.Contains(s.ProblemId))
                .ToListAsync();

        var participants = BuildProblemBankParticipants(bank.ProblemIds, submissions);
        var userIds = participants.Select(p => p.User.Id).ToList();
        var users = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id);

        foreach (var participant in participants)
        {
            if (users.TryGetValue(participant.User.Id, out var user))
            {
                participant.User.Username = user.Username;
                participant.User.FullName = user.FullName;
                participant.User.AvatarUrl = user.AvatarUrl;
            }
        }

        return Ok(ApiResponse<List<ProblemBankParticipantResponse>>.Ok(participants));
    }

    [HttpGet("moderator-dashboard")]
    [HasPermission("analytics:view")]
    public async Task<ActionResult<ApiResponse<ModeratorDashboardAnalyticsResponse>>> GetModeratorDashboard()
    {
        var response = new ModeratorDashboardAnalyticsResponse
        {
            PendingReports = await _db.Reports.CountAsync(r => r.Status == "pending"),
            PendingPosts = await _db.Posts.CountAsync(p => p.ReviewStatus == "pending"),
            PendingProblems = await _db.Problems.CountAsync(p => p.ReviewStatus == "pending"),
            PendingProblemBanks = await _db.ProblemBanks.CountAsync(b => b.ReviewStatus == "pending"),
            PendingQuizSets = await _db.QuizSets.CountAsync(q => q.ReviewStatus == "pending"),
            HiddenPosts = await _db.Posts.CountAsync(p => p.IsHidden),
            TotalPosts = await _db.Posts.CountAsync(),
            TotalProblems = await _db.Problems.CountAsync(),
            TotalProblemBanks = await _db.ProblemBanks.CountAsync(),
            TotalQuizSets = await _db.QuizSets.CountAsync(),
            RecentActivities = await _db.AuditLogs
                .AsNoTracking()
                .Where(l => l.Action.Contains("review") || l.Action.Contains("moderation") || l.Action.Contains("hide"))
                .OrderByDescending(l => l.CreatedAt)
                .Take(10)
                .Select(l => new RecentModerationActivityResponse
                {
                    Id = l.Id,
                    Action = l.Action,
                    TargetType = l.TargetType,
                    TargetId = l.TargetId,
                    Detail = l.Detail,
                    CreatedAt = l.CreatedAt
                })
                .ToListAsync()
        };

        return Ok(ApiResponse<ModeratorDashboardAnalyticsResponse>.Ok(response));
    }

    private static List<ProblemBankParticipantResponse> BuildProblemBankParticipants(List<Guid> problemIds, List<Submission> submissions)
    {
        var total = problemIds.Count;
        if (total == 0)
        {
            return new List<ProblemBankParticipantResponse>();
        }

        return submissions
            .GroupBy(s => s.UserId)
            .Select(g =>
            {
                var perProblem = g.GroupBy(s => s.ProblemId).ToList();
                var solved = perProblem.Count(pg => pg.Any(s => string.Equals(s.Verdict, AcceptedVerdict, StringComparison.OrdinalIgnoreCase)));
                var bestAccuracies = perProblem
                    .Select(pg => pg.Max(s => s.TotalCases <= 0 ? 0 : s.PassedCases * 100.0 / s.TotalCases))
                    .ToList();

                return new ProblemBankParticipantResponse
                {
                    User = new ProblemBankUserSummary { Id = g.Key },
                    SolvedCount = solved,
                    TotalProblems = total,
                    CompletionPercent = Math.Round(solved * 100.0 / total, 2),
                    AvgAccuracyPercent = bestAccuracies.Count == 0 ? 0 : Math.Round(bestAccuracies.Average(), 2)
                };
            })
            .OrderByDescending(p => p.CompletionPercent)
            .ThenByDescending(p => p.AvgAccuracyPercent)
            .ToList();
    }
}
