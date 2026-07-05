using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class ProblemBankApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public ProblemBankApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetBanks_WithAnonymousUser_ShouldHidePrivateBanks()
    {
        // Arrange
        var ownerId = Guid.NewGuid();
        await _factory.EnsureUserAsync(ownerId, "bank_visibility_owner");
        var publicBankId = await SeedBankAsync(ownerId, "Public bank visibility", isPublic: true);
        await SeedBankAsync(ownerId, "Private bank visibility", isPublic: false);
        using var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/problem-banks");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var banks = document.RootElement.GetProperty("data").EnumerateArray().ToList();

        Assert.Contains(banks, bank => bank.GetProperty("id").GetGuid() == publicBankId);
        Assert.DoesNotContain(banks, bank => bank.GetProperty("title").GetString() == "Private bank visibility");
    }

    [Fact]
    public async Task AddProblem_WithDuplicateProblem_ShouldReturnBadRequest()
    {
        // Arrange
        var ownerId = Guid.NewGuid();
        await _factory.EnsureUserAsync(ownerId, "bank_duplicate_owner", permissions: new[] { "problem:edit" });
        var bankId = await SeedBankAsync(ownerId, "Duplicate problem bank", isPublic: true);
        var problemId = await SeedProblemAsync(ownerId, "Duplicate problem");
        using var client = _factory.CreateAuthenticatedClient(ownerId, permissions: "problem:edit");

        // Act
        var firstResponse = await client.PostAsJsonAsync($"/api/problem-banks/{bankId}/problems", new { problemId });
        var duplicateResponse = await client.PostAsJsonAsync($"/api/problem-banks/{bankId}/problems", new { problemId });

        // Assert
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);
        using var document = await ReadDocumentAsync(duplicateResponse);
        Assert.Contains("already", document.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task GetProgress_WithAcceptedSubmission_ShouldReturnSolvedAndAccuracy()
    {
        // Arrange
        var ownerId = Guid.NewGuid();
        var learnerId = Guid.NewGuid();
        await _factory.EnsureUserAsync(ownerId, "bank_progress_owner");
        await _factory.EnsureUserAsync(learnerId, "bank_progress_learner");
        var bankId = await SeedBankAsync(ownerId, "Progress bank", isPublic: true);
        var firstProblemId = await SeedProblemAsync(ownerId, "Solved problem");
        var secondProblemId = await SeedProblemAsync(ownerId, "Unsolved problem");
        await LinkProblemAsync(bankId, firstProblemId, 0);
        await LinkProblemAsync(bankId, secondProblemId, 1);
        await SeedSubmissionAsync(learnerId, firstProblemId, "accepted", passedCases: 2, totalCases: 2);
        await SeedSubmissionAsync(learnerId, secondProblemId, "wrong_answer", passedCases: 1, totalCases: 2);
        using var client = _factory.CreateAuthenticatedClient(learnerId);

        // Act
        var response = await client.GetAsync($"/api/problem-banks/{bankId}/progress");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var data = document.RootElement.GetProperty("data");

        Assert.Equal(2, data.GetProperty("totalProblems").GetInt32());
        Assert.Equal(1, data.GetProperty("solvedProblems").GetInt32());
        Assert.Equal(50, data.GetProperty("completionPercent").GetDouble());
        Assert.Equal(75, data.GetProperty("avgAccuracyPercent").GetDouble());
    }

    [Fact]
    public async Task GetParticipants_WithOwnerToken_ShouldReturnParticipantsOrderedByCompletion()
    {
        // Arrange
        var ownerId = Guid.NewGuid();
        var learnerId = Guid.NewGuid();
        await _factory.EnsureUserAsync(ownerId, "bank_participants_owner");
        await _factory.EnsureUserAsync(learnerId, "bank_participants_learner");
        var bankId = await SeedBankAsync(ownerId, "Participants bank", isPublic: true);
        var problemId = await SeedProblemAsync(ownerId, "Participant problem");
        await LinkProblemAsync(bankId, problemId, 0);
        await SeedSubmissionAsync(learnerId, problemId, "accepted", passedCases: 1, totalCases: 1);
        using var client = _factory.CreateAuthenticatedClient(ownerId);

        // Act
        var response = await client.GetAsync($"/api/problem-banks/{bankId}/participants");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        var participant = Assert.Single(document.RootElement.GetProperty("data").EnumerateArray());
        Assert.Equal(learnerId, participant.GetProperty("user").GetProperty("id").GetGuid());
        Assert.Equal(100, participant.GetProperty("completionPercent").GetDouble());
    }

    [Fact]
    public async Task LikeAndRating_WithValidUser_ShouldToggleLikeAndUpdateRatingStats()
    {
        // Arrange
        var ownerId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        await _factory.EnsureUserAsync(ownerId, "bank_rating_owner");
        await _factory.EnsureUserAsync(userId, "bank_rating_user");
        var bankId = await SeedBankAsync(ownerId, "Rating bank", isPublic: true);
        using var client = _factory.CreateAuthenticatedClient(userId);

        // Act
        var likeResponse = await client.PostAsync($"/api/problem-banks/{bankId}/like", null);
        var unlikeResponse = await client.PostAsync($"/api/problem-banks/{bankId}/like", null);
        var invalidRatingResponse = await client.PostAsJsonAsync($"/api/problem-banks/{bankId}/rating", new
        {
            rating = 6,
            comment = "Invalid"
        });
        var ratingResponse = await client.PostAsJsonAsync($"/api/problem-banks/{bankId}/rating", new
        {
            rating = 5,
            comment = "Rat hay"
        });
        var ratingsResponse = await client.GetAsync($"/api/problem-banks/{bankId}/ratings");

        // Assert
        Assert.Equal(HttpStatusCode.OK, likeResponse.StatusCode);
        using var likeDocument = await ReadDocumentAsync(likeResponse);
        Assert.True(likeDocument.RootElement.GetProperty("data").GetProperty("liked").GetBoolean());

        Assert.Equal(HttpStatusCode.OK, unlikeResponse.StatusCode);
        using var unlikeDocument = await ReadDocumentAsync(unlikeResponse);
        Assert.False(unlikeDocument.RootElement.GetProperty("data").GetProperty("liked").GetBoolean());

        Assert.Equal(HttpStatusCode.BadRequest, invalidRatingResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, ratingResponse.StatusCode);
        using var ratingDocument = await ReadDocumentAsync(ratingResponse);
        Assert.Equal(5, ratingDocument.RootElement.GetProperty("data").GetProperty("myRating").GetInt32());
        Assert.Equal(1, ratingDocument.RootElement.GetProperty("data").GetProperty("ratingCount").GetInt32());

        Assert.Equal(HttpStatusCode.OK, ratingsResponse.StatusCode);
        using var ratingsDocument = await ReadDocumentAsync(ratingsResponse);
        Assert.Single(ratingsDocument.RootElement.GetProperty("data").GetProperty("items").EnumerateArray());
    }

    private async Task<Guid> SeedBankAsync(Guid ownerId, string title, bool isPublic)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var bank = new ProblemBank
        {
            Id = Guid.NewGuid(),
            CreatedBy = ownerId,
            Title = title,
            Description = $"Description for {title}",
            IsPublic = isPublic,
            ReviewStatus = isPublic ? "approved" : "pending",
            CreatedAt = DateTime.Now
        };

        db.ProblemBanks.Add(bank);
        await db.SaveChangesAsync();
        return bank.Id;
    }

    private async Task<Guid> SeedProblemAsync(Guid ownerId, string title)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var problem = new Problem
        {
            Id = Guid.NewGuid(),
            TopicId = Guid.NewGuid(),
            CreatedBy = ownerId,
            Title = title,
            Description = $"Description for {title}",
            Difficulty = "easy",
            IsActive = true,
            ReviewStatus = "approved",
            CreatedAt = DateTime.Now
        };

        db.Problems.Add(problem);
        await db.SaveChangesAsync();
        return problem.Id;
    }

    private async Task LinkProblemAsync(Guid bankId, Guid problemId, int orderIndex)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        db.ProblemBankItems.Add(new ProblemBankItem
        {
            BankId = bankId,
            ProblemId = problemId,
            OrderIndex = orderIndex,
            AddedAt = DateTime.Now
        });
        await db.SaveChangesAsync();
    }

    private async Task SeedSubmissionAsync(Guid userId, Guid problemId, string verdict, short passedCases, short totalCases)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        db.Submissions.Add(new Submission
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ProblemId = problemId,
            Code = "print('test')",
            Language = "python",
            Verdict = verdict,
            PassedCases = passedCases,
            TotalCases = totalCases,
            SubmittedAt = DateTime.Now
        });
        await db.SaveChangesAsync();
    }

    private static async Task<JsonDocument> ReadDocumentAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }
}
