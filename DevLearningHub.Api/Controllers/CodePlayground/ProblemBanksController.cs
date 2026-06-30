using System.Linq.Expressions;
using DevLearningHub.Api.Dtos.CodePlayground;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Community; // PagedResponse<T>
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Extensions;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.CodePlayground;

[ApiController]
[Route("api/problem-banks")]
// "Kho quản lý bài tập Code": a curated collection of code exercises with
// per-learner progress tracking, likes and ratings.
public class ProblemBanksController : ControllerBase
{
    // A submission counts as solving a problem when Judge0 returns "accepted"
    // (StatusId 3), mirroring CodePlaygroundController.
    private const string AcceptedVerdict = "accepted";

    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    private readonly DevLearningHubContext _db;
    private readonly IPermissionService _permissions;

    public ProblemBanksController(DevLearningHubContext db, IPermissionService permissions)
    {
        _db = db;
        _permissions = permissions;
    }

    // ----- Bank CRUD -----

    [HttpGet]
    [AllowAnonymous]
    // List public banks plus the caller's own private banks.
    public async Task<ActionResult<ApiResponse<List<ProblemBankResponse>>>> GetBanks([FromQuery] Guid? createdBy = null)
    {
        var hasUser = User.TryGetUserId(out var userId);

        var query = _db.ProblemBanks.AsNoTracking();
        if (createdBy.HasValue)
        {
            query = query.Where(b => b.CreatedBy == createdBy.Value);
        }

        // Visibility: public banks for everyone; private banks only for their owner.
        query = query.Where(b => b.IsPublic || (hasUser && b.CreatedBy == userId));

        var banks = await query
            .OrderByDescending(b => b.CreatedAt)
            .Select(SummarySelector(hasUser ? userId : Guid.Empty))
            .ToListAsync();

        return Ok(ApiResponse<List<ProblemBankResponse>>.Ok(banks));
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    // Bank detail including the ordered list of exercises it contains.
    public async Task<ActionResult<ApiResponse<ProblemBankDetailResponse>>> GetBank(Guid id)
    {
        var hasUser = User.TryGetUserId(out var userId);
        var viewerId = hasUser ? userId : Guid.Empty;

        var bank = await _db.ProblemBanks
            .AsNoTracking()
            .Where(b => b.Id == id)
            .Select(b => new ProblemBankDetailResponse
            {
                Id = b.Id,
                Title = b.Title,
                Description = b.Description,
                IsPublic = b.IsPublic,
                TopicId = b.TopicId,
                TopicName = b.Topic != null ? b.Topic.Name : null,
                Creator = new ProblemBankUserSummary
                {
                    Id = b.CreatedByNavigation.Id,
                    Username = b.CreatedByNavigation.Username,
                    FullName = b.CreatedByNavigation.FullName,
                    AvatarUrl = b.CreatedByNavigation.AvatarUrl
                },
                ProblemCount = b.Items.Count,
                LikeCount = b.Likes.Count,
                AvgRating = b.Ratings.Select(r => (double?)r.Rating).Average() ?? 0,
                RatingCount = b.Ratings.Count,
                MyLiked = viewerId != Guid.Empty && b.Likes.Any(l => l.UserId == viewerId),
                MyRating = b.Ratings.Where(r => r.UserId == viewerId).Select(r => (byte?)r.Rating).FirstOrDefault(),
                CreatedAt = b.CreatedAt,
                UpdatedAt = b.UpdatedAt,
                Problems = b.Items
                    .OrderBy(i => i.OrderIndex)
                    .ThenBy(i => i.AddedAt)
                    .Select(i => new ProblemBankProblemItem
                    {
                        ProblemId = i.ProblemId,
                        Title = i.Problem.Title,
                        Difficulty = i.Problem.Difficulty,
                        IsActive = i.Problem.IsActive,
                        OrderIndex = i.OrderIndex,
                        AddedAt = i.AddedAt
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync();

        if (bank == null)
        {
            return NotFound(ApiResponse<ProblemBankDetailResponse>.Fail("Problem bank not found."));
        }

        // Hide someone else's private bank.
        if (!bank.IsPublic && bank.Creator.Id != viewerId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<ProblemBankDetailResponse>.Fail("This problem bank is private."));
        }

        return Ok(ApiResponse<ProblemBankDetailResponse>.Ok(bank));
    }

    [HttpPost]
    [Authorize]
    // Create a (possibly empty) bank. Exercises can be added later.
    public async Task<ActionResult<ApiResponse<ProblemBankResponse>>> CreateBank(CreateProblemBankRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<ProblemBankResponse>.Fail("Unauthorized."));
        }

        var title = request.Title?.Trim();
        if (string.IsNullOrWhiteSpace(title))
        {
            return BadRequest(ApiResponse<ProblemBankResponse>.Fail("Title is required."));
        }

        var bank = new ProblemBank
        {
            Id = Guid.NewGuid(),
            CreatedBy = userId,
            Title = title,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsPublic = request.IsPublic,
            TopicId = request.TopicId,
            CreatedAt = DateTime.Now
        };

        _db.ProblemBanks.Add(bank);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<ProblemBankResponse>.Ok(await LoadSummaryAsync(bank.Id, userId), "Problem bank created."));
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    // Update bank metadata. Owner or someone with problem:edit.
    public async Task<ActionResult<ApiResponse<ProblemBankResponse>>> UpdateBank(Guid id, UpdateProblemBankRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<ProblemBankResponse>.Fail("Unauthorized."));
        }

        var bank = await _db.ProblemBanks.FirstOrDefaultAsync(b => b.Id == id);
        if (bank == null)
        {
            return NotFound(ApiResponse<ProblemBankResponse>.Fail("Problem bank not found."));
        }

        if (!await CanManageAsync(bank, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<ProblemBankResponse>.Fail("Forbidden."));
        }

        var title = request.Title?.Trim();
        if (string.IsNullOrWhiteSpace(title))
        {
            return BadRequest(ApiResponse<ProblemBankResponse>.Fail("Title is required."));
        }

        bank.Title = title;
        bank.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        bank.IsPublic = request.IsPublic;
        bank.TopicId = request.TopicId;
        bank.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<ProblemBankResponse>.Ok(await LoadSummaryAsync(bank.Id, userId)));
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    // Delete a bank. Items/likes/ratings are removed by FK cascade.
    public async Task<ActionResult<ApiResponse<object>>> DeleteBank(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var bank = await _db.ProblemBanks.FirstOrDefaultAsync(b => b.Id == id);
        if (bank == null)
        {
            return NotFound(ApiResponse<object>.Fail("Problem bank not found."));
        }

        if (!await CanManageAsync(bank, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        _db.ProblemBanks.Remove(bank);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    // ----- Items (add / remove exercises) -----

    [HttpPost("{id:guid}/problems")]
    [Authorize]
    // Add an existing exercise to the bank.
    public async Task<ActionResult<ApiResponse<object>>> AddProblem(Guid id, AddProblemToBankRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var bank = await _db.ProblemBanks.FirstOrDefaultAsync(b => b.Id == id);
        if (bank == null)
        {
            return NotFound(ApiResponse<object>.Fail("Problem bank not found."));
        }

        if (!await CanManageAsync(bank, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        var problem = await _db.Problems.FirstOrDefaultAsync(p => p.Id == request.ProblemId);
        if (problem == null)
        {
            return NotFound(ApiResponse<object>.Fail("Problem not found."));
        }

        // Only bank owner (or those with problem:edit) may add problems they didn't create.
        var canEditAny = await _permissions.HasPermissionAsync(userId, "problem:edit");
        if (!canEditAny && problem.CreatedBy != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail("Bạn chỉ có thể thêm bài tập do chính mình tạo vào ngân hàng."));
        }

        var alreadyLinked = await _db.ProblemBankItems
            .AnyAsync(i => i.BankId == id && i.ProblemId == request.ProblemId);
        if (alreadyLinked)
        {
            return BadRequest(ApiResponse<object>.Fail("Problem is already in this bank."));
        }

        // Default new items to the end of the list when no explicit order is given.
        var orderIndex = request.OrderIndex
            ?? (await _db.ProblemBankItems.Where(i => i.BankId == id).MaxAsync(i => (int?)i.OrderIndex) ?? -1) + 1;

        _db.ProblemBankItems.Add(new ProblemBankItem
        {
            BankId = id,
            ProblemId = request.ProblemId,
            OrderIndex = orderIndex,
            AddedAt = DateTime.Now
        });

        bank.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { added = true }));
    }

    [HttpDelete("{id:guid}/problems/{problemId:guid}")]
    [Authorize]
    // Remove an exercise from the bank (the exercise itself is not deleted).
    public async Task<ActionResult<ApiResponse<object>>> RemoveProblem(Guid id, Guid problemId)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var bank = await _db.ProblemBanks.FirstOrDefaultAsync(b => b.Id == id);
        if (bank == null)
        {
            return NotFound(ApiResponse<object>.Fail("Problem bank not found."));
        }

        if (!await CanManageAsync(bank, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Forbidden."));
        }

        var item = await _db.ProblemBankItems.FirstOrDefaultAsync(i => i.BankId == id && i.ProblemId == problemId);
        if (item == null)
        {
            return NotFound(ApiResponse<object>.Fail("Problem is not in this bank."));
        }

        _db.ProblemBankItems.Remove(item);
        bank.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { removed = true }));
    }

    // ----- Progress & participants -----

    [HttpGet("{id:guid}/progress")]
    [Authorize]
    // Current user's progress through the bank: completion % and per-problem best accuracy.
    public async Task<ActionResult<ApiResponse<ProblemBankProgressResponse>>> GetMyProgress(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<ProblemBankProgressResponse>.Fail("Unauthorized."));
        }

        var bankExists = await _db.ProblemBanks.AnyAsync(b => b.Id == id);
        if (!bankExists)
        {
            return NotFound(ApiResponse<ProblemBankProgressResponse>.Fail("Problem bank not found."));
        }

        // Exercises in this bank (id + title), ordered.
        var problems = await _db.ProblemBankItems
            .Where(i => i.BankId == id)
            .OrderBy(i => i.OrderIndex)
            .Select(i => new { i.ProblemId, i.Problem.Title })
            .ToListAsync();

        var problemIds = problems.Select(p => p.ProblemId).ToList();

        // All of this user's submissions for those exercises (minimal columns).
        var submissions = await _db.Submissions
            .Where(s => s.UserId == userId && problemIds.Contains(s.ProblemId))
            .Select(s => new { s.ProblemId, s.Verdict, s.PassedCases, s.TotalCases })
            .ToListAsync();

        var byProblem = submissions.GroupBy(s => s.ProblemId).ToDictionary(g => g.Key, g => g.ToList());

        var problemAccuracies = new List<ProblemBankProblemAccuracy>();
        var attemptedAccuracies = new List<double>();
        var solvedCount = 0;

        foreach (var p in problems)
        {
            byProblem.TryGetValue(p.ProblemId, out var attempts);
            double? best = null;
            var solved = false;

            if (attempts != null && attempts.Count > 0)
            {
                solved = attempts.Any(a => string.Equals(a.Verdict, AcceptedVerdict, StringComparison.OrdinalIgnoreCase));
                best = attempts.Max(a => Accuracy(a.PassedCases, a.TotalCases));
                attemptedAccuracies.Add(best ?? 0);
            }

            if (solved)
            {
                solvedCount++;
            }

            problemAccuracies.Add(new ProblemBankProblemAccuracy
            {
                ProblemId = p.ProblemId,
                Title = p.Title,
                Solved = solved,
                BestAccuracyPercent = best
            });
        }

        var total = problems.Count;
        var result = new ProblemBankProgressResponse
        {
            BankId = id,
            TotalProblems = total,
            SolvedProblems = solvedCount,
            CompletionPercent = total == 0 ? 0 : Math.Round(solvedCount * 100.0 / total, 2),
            AvgAccuracyPercent = attemptedAccuracies.Count == 0 ? 0 : Math.Round(attemptedAccuracies.Average(), 2),
            Problems = problemAccuracies
        };

        return Ok(ApiResponse<ProblemBankProgressResponse>.Ok(result));
    }

    [HttpGet("{id:guid}/participants")]
    [Authorize]
    // Everyone who attempted at least one exercise in the bank, with their
    // completion % and average accuracy. Owner / problem:edit only.
    public async Task<ActionResult<ApiResponse<List<ProblemBankParticipantResponse>>>> GetParticipants(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<List<ProblemBankParticipantResponse>>.Fail("Unauthorized."));
        }

        var bank = await _db.ProblemBanks.FirstOrDefaultAsync(b => b.Id == id);
        if (bank == null)
        {
            return NotFound(ApiResponse<List<ProblemBankParticipantResponse>>.Fail("Problem bank not found."));
        }

        if (!await CanManageAsync(bank, userId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<List<ProblemBankParticipantResponse>>.Fail("Forbidden."));
        }

        var problemIds = await _db.ProblemBankItems
            .Where(i => i.BankId == id)
            .Select(i => i.ProblemId)
            .ToListAsync();

        var total = problemIds.Count;
        if (total == 0)
        {
            return Ok(ApiResponse<List<ProblemBankParticipantResponse>>.Ok(new List<ProblemBankParticipantResponse>()));
        }

        // Pull every submission on the bank's exercises (minimal columns), then
        // aggregate per participant in memory.
        var submissions = await _db.Submissions
            .Where(s => problemIds.Contains(s.ProblemId))
            .Select(s => new { s.UserId, s.ProblemId, s.Verdict, s.PassedCases, s.TotalCases })
            .ToListAsync();

        var participantIds = submissions.Select(s => s.UserId).Distinct().ToList();

        var users = await _db.Users
            .Where(u => participantIds.Contains(u.Id))
            .Select(u => new ProblemBankUserSummary
            {
                Id = u.Id,
                Username = u.Username,
                FullName = u.FullName,
                AvatarUrl = u.AvatarUrl
            })
            .ToListAsync();
        var userById = users.ToDictionary(u => u.Id);

        var result = new List<ProblemBankParticipantResponse>();
        foreach (var group in submissions.GroupBy(s => s.UserId))
        {
            var perProblem = group.GroupBy(s => s.ProblemId);
            var solved = perProblem.Count(pg =>
                pg.Any(a => string.Equals(a.Verdict, AcceptedVerdict, StringComparison.OrdinalIgnoreCase)));
            var bestAccuracies = perProblem
                .Select(pg => pg.Max(a => Accuracy(a.PassedCases, a.TotalCases)) ?? 0)
                .ToList();

            result.Add(new ProblemBankParticipantResponse
            {
                User = userById.TryGetValue(group.Key, out var u)
                    ? u
                    : new ProblemBankUserSummary { Id = group.Key },
                SolvedCount = solved,
                TotalProblems = total,
                CompletionPercent = Math.Round(solved * 100.0 / total, 2),
                AvgAccuracyPercent = bestAccuracies.Count == 0 ? 0 : Math.Round(bestAccuracies.Average(), 2)
            });
        }

        result = result
            .OrderByDescending(p => p.CompletionPercent)
            .ThenByDescending(p => p.AvgAccuracyPercent)
            .ToList();

        return Ok(ApiResponse<List<ProblemBankParticipantResponse>>.Ok(result));
    }

    // ----- Likes -----

    [HttpPost("{id:guid}/like")]
    [Authorize]
    // Toggle the current user's like on the bank.
    public async Task<ActionResult<ApiResponse<object>>> ToggleLike(Guid id)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        var bankExists = await _db.ProblemBanks.AnyAsync(b => b.Id == id);
        if (!bankExists)
        {
            return NotFound(ApiResponse<object>.Fail("Problem bank not found."));
        }

        var existing = await _db.ProblemBankLikes.FirstOrDefaultAsync(l => l.BankId == id && l.UserId == userId);
        bool liked;
        if (existing == null)
        {
            _db.ProblemBankLikes.Add(new ProblemBankLike { BankId = id, UserId = userId, CreatedAt = DateTime.Now });
            liked = true;
        }
        else
        {
            _db.ProblemBankLikes.Remove(existing);
            liked = false;
        }

        await _db.SaveChangesAsync();

        var likeCount = await _db.ProblemBankLikes.CountAsync(l => l.BankId == id);
        return Ok(ApiResponse<object>.Ok(new { liked, likeCount }));
    }

    // ----- Ratings -----

    [HttpPost("{id:guid}/rating")]
    [Authorize]
    // Set or update the current user's 1-5 star rating (with optional review text).
    public async Task<ActionResult<ApiResponse<object>>> RateBank(Guid id, RateProblemBankRequest request)
    {
        if (!User.TryGetUserId(out var userId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));
        }

        if (request.Rating < 1 || request.Rating > 5)
        {
            return BadRequest(ApiResponse<object>.Fail("Rating must be between 1 and 5."));
        }

        var bankExists = await _db.ProblemBanks.AnyAsync(b => b.Id == id);
        if (!bankExists)
        {
            return NotFound(ApiResponse<object>.Fail("Problem bank not found."));
        }

        var comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        if (comment is { Length: > 500 })
        {
            comment = comment[..500];
        }

        var rating = await _db.ProblemBankRatings.FirstOrDefaultAsync(r => r.BankId == id && r.UserId == userId);
        if (rating == null)
        {
            _db.ProblemBankRatings.Add(new ProblemBankRating
            {
                BankId = id,
                UserId = userId,
                Rating = request.Rating,
                Comment = comment,
                CreatedAt = DateTime.Now
            });
        }
        else
        {
            rating.Rating = request.Rating;
            rating.Comment = comment;
            rating.UpdatedAt = DateTime.Now;
        }

        await _db.SaveChangesAsync();

        var stats = await _db.ProblemBankRatings
            .Where(r => r.BankId == id)
            .GroupBy(r => 1)
            .Select(g => new { Avg = g.Average(r => (double)r.Rating), Count = g.Count() })
            .FirstOrDefaultAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            myRating = request.Rating,
            avgRating = stats == null ? 0 : Math.Round(stats.Avg, 2),
            ratingCount = stats?.Count ?? 0
        }));
    }

    [HttpGet("{id:guid}/ratings")]
    [AllowAnonymous]
    // List reviews for the bank (newest first), paginated.
    public async Task<ActionResult<ApiResponse<PagedResponse<ProblemBankRatingResponse>>>> GetRatings(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize)
    {
        var bankExists = await _db.ProblemBanks.AnyAsync(b => b.Id == id);
        if (!bankExists)
        {
            return NotFound(ApiResponse<PagedResponse<ProblemBankRatingResponse>>.Fail("Problem bank not found."));
        }

        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > MaxPageSize ? DefaultPageSize : pageSize;

        var query = _db.ProblemBankRatings.AsNoTracking().Where(r => r.BankId == id);
        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new ProblemBankRatingResponse
            {
                User = new ProblemBankUserSummary
                {
                    Id = r.User.Id,
                    Username = r.User.Username,
                    FullName = r.User.FullName,
                    AvatarUrl = r.User.AvatarUrl
                },
                Rating = r.Rating,
                Comment = r.Comment,
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt
            })
            .ToListAsync();

        var result = new PagedResponse<ProblemBankRatingResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        };

        return Ok(ApiResponse<PagedResponse<ProblemBankRatingResponse>>.Ok(result));
    }

    // ----- Helpers -----

    // Owner of the bank, or anyone holding the problem:edit permission (Admin/Moderator).
    private async Task<bool> CanManageAsync(ProblemBank bank, Guid userId)
    {
        return bank.CreatedBy == userId || await _permissions.HasPermissionAsync(userId, "problem:edit");
    }

    // Best-attempt accuracy for one submission, as a 0-100 percentage. Null when
    // the problem has no test cases (avoids divide-by-zero).
    private static double? Accuracy(short passed, short total)
    {
        if (total <= 0)
        {
            return null;
        }

        return Math.Round(passed * 100.0 / total, 2);
    }

    // Reusable EF-translatable projection for the summary card. Returns an
    // Expression (not a delegate) so it can be passed straight into .Select().
    private static Expression<Func<ProblemBank, ProblemBankResponse>> SummarySelector(Guid viewerId)
    {
        return b => new ProblemBankResponse
        {
            Id = b.Id,
            Title = b.Title,
            Description = b.Description,
            IsPublic = b.IsPublic,
            TopicId = b.TopicId,
            TopicName = b.Topic != null ? b.Topic.Name : null,
            Creator = new ProblemBankUserSummary
            {
                Id = b.CreatedByNavigation.Id,
                Username = b.CreatedByNavigation.Username,
                FullName = b.CreatedByNavigation.FullName,
                AvatarUrl = b.CreatedByNavigation.AvatarUrl
            },
            ProblemCount = b.Items.Count,
            LikeCount = b.Likes.Count,
            AvgRating = b.Ratings.Select(r => (double?)r.Rating).Average() ?? 0,
            RatingCount = b.Ratings.Count,
            MyLiked = viewerId != Guid.Empty && b.Likes.Any(l => l.UserId == viewerId),
            MyRating = b.Ratings.Where(r => r.UserId == viewerId).Select(r => (byte?)r.Rating).FirstOrDefault(),
            CreatedAt = b.CreatedAt,
            UpdatedAt = b.UpdatedAt
        };
    }

    // Materialised summary for a single bank (used after create/update).
    private async Task<ProblemBankResponse> LoadSummaryAsync(Guid bankId, Guid viewerId)
    {
        return await _db.ProblemBanks
            .AsNoTracking()
            .Where(b => b.Id == bankId)
            .Select(SummarySelector(viewerId))
            .FirstAsync();
    }
}
