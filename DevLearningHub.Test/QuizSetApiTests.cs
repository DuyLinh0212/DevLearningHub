using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class QuizSetApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public QuizSetApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetQuizSets_WithoutToken_ShouldReturnOnlyPublicQuizSets()
    {
        var publicQuizSetId = await SeedQuizSetAsync(
            title: "Public quiz set 7501",
            isPublic: true);

        await SeedQuizSetAsync(
            title: "Private quiz set 7501",
            isPublic: false);

        var response = await _client.GetAsync("/api/quiz-sets");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);

        var quizSets = root.GetProperty("data").EnumerateArray().ToList();

        Assert.Contains(quizSets, quizSet => quizSet.GetProperty("id").GetGuid() == publicQuizSetId);
        Assert.DoesNotContain(quizSets, quizSet => quizSet.GetProperty("title").GetString() == "Private quiz set 7501");
    }

    [Fact]
    public async Task CreateQuizSet_WithValidPayload_ShouldReturnCreatedQuizSet()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "quizsetcreator7502",
            email: "quizsetcreator7502@gmail.com",
            fullName: "Quiz Set Creator 7502");

        var topicId = await SeedTopicAsync(
            name: "Quiz Set Topic 7502",
            slug: "quiz-set-topic-7502");

        var response = await CreateQuizSetAsync(
            auth.AccessToken,
            topicId,
            title: "Created quiz set 7502",
            isPublic: true);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);

        var data = root.GetProperty("data");

        Assert.False(data.GetProperty("id").GetGuid() == Guid.Empty);
        Assert.Equal("Created quiz set 7502", data.GetProperty("title").GetString());
        Assert.Equal("practice", data.GetProperty("mode").GetString());
        Assert.Equal(900, data.GetProperty("timeLimitSeconds").GetInt32());
        Assert.True(data.GetProperty("isPublic").GetBoolean());
        Assert.Equal(topicId, data.GetProperty("topicId").GetGuid());
        Assert.Equal("beginner", data.GetProperty("level").GetString());
        Assert.Equal(0, data.GetProperty("questionCount").GetInt32());
    }

    [Fact]
    public async Task CreateQuizSet_WithQuestions_ShouldCreateAndAssignQuestions()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "quizsetquestions7510",
            email: "quizsetquestions7510@gmail.com",
            fullName: "Quiz Set Questions 7510");

        var topicId = await SeedTopicAsync(
            name: "Quiz Set Topic 7510",
            slug: "quiz-set-topic-7510");

        var request = new
        {
            title = "Quiz set with questions 7510",
            description = "Created with manual or imported questions.",
            mode = "practice",
            timeLimitSeconds = 900,
            isPublic = true,
            topicId,
            level = "beginner",
            questions = new[]
            {
                new
                {
                    topicId,
                    content = "Question created with quiz set 7510",
                    level = "beginner",
                    explanation = "Two is the correct answer.",
                    options = new[]
                    {
                        new { content = "Two", isCorrect = true, orderIndex = (byte)0 },
                        new { content = "Three", isCorrect = false, orderIndex = (byte)1 }
                    }
                }
            }
        };

        var response = await SendWithBearerAsync(HttpMethod.Post, "/api/quiz-sets", auth.AccessToken, request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var data = document.RootElement.GetProperty("data");
        var quizSetId = data.GetProperty("id").GetGuid();

        Assert.Equal(1, data.GetProperty("questionCount").GetInt32());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var link = db.QuizSetQuestions.Single(link => link.QuizSetId == quizSetId);
        var question = db.Questions.Single(question => question.Id == link.QuestionId);
        var options = db.QuestionOptions.Where(option => option.QuestionId == question.Id).ToList();

        Assert.Equal(topicId, question.TopicId);
        Assert.Equal("Question created with quiz set 7510", question.Content);
        Assert.Equal(2, options.Count);
        Assert.Single(options, option => option.IsCorrect);
    }

    [Fact]
    public async Task CreateQuizSet_WithTopicName_ShouldCreateTopicAndUseItForQuestions()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "quizsettopicname7511",
            email: "quizsettopicname7511@gmail.com",
            fullName: "Quiz Set Topic Name 7511");

        var request = new
        {
            title = "Quiz set with topic name 7511",
            mode = "practice",
            timeLimitSeconds = 600,
            isPublic = true,
            topic = "Automatically Created Topic 7511",
            level = "beginner",
            questions = new[]
            {
                new
                {
                    content = "Question using an automatically created topic 7511",
                    options = new[]
                    {
                        new { content = "Correct", isCorrect = true },
                        new { content = "Wrong", isCorrect = false }
                    }
                }
            }
        };

        var response = await SendWithBearerAsync(HttpMethod.Post, "/api/quiz-sets", auth.AccessToken, request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var quizSetId = document.RootElement.GetProperty("data").GetProperty("id").GetGuid();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var topic = db.Topics.Single(topic => topic.Name == "Automatically Created Topic 7511");
        var quizSet = db.QuizSets.Single(quizSet => quizSet.Id == quizSetId);
        var questionId = db.QuizSetQuestions.Single(link => link.QuizSetId == quizSetId).QuestionId;
        var question = db.Questions.Single(question => question.Id == questionId);

        Assert.Equal(topic.Id, quizSet.TopicId);
        Assert.Equal(topic.Id, question.TopicId);
    }

    [Fact]
    public async Task UpdateQuizSet_WithOwnerToken_ShouldReturnUpdatedQuizSet()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "quizsetupdater7503",
            email: "quizsetupdater7503@gmail.com",
            fullName: "Quiz Set Updater 7503");

        var topicId = await SeedTopicAsync(
            name: "Quiz Set Topic 7503",
            slug: "quiz-set-topic-7503");

        var createResponse = await CreateQuizSetAsync(
            auth.AccessToken,
            topicId,
            title: "Before update quiz set 7503",
            isPublic: false);

        var quizSetId = await ReadDataGuidAsync(createResponse, "id");

        var updateRequest = new
        {
            title = "After update quiz set 7503",
            description = "Updated description.",
            mode = "exam",
            timeLimitSeconds = 1200,
            isPublic = true,
            topicId,
            level = "intermediate"
        };

        var response = await SendWithBearerAsync(
            HttpMethod.Put,
            $"/api/quiz-sets/{quizSetId}",
            auth.AccessToken,
            updateRequest);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);

        var data = root.GetProperty("data");

        Assert.Equal(quizSetId, data.GetProperty("id").GetGuid());
        Assert.Equal("After update quiz set 7503", data.GetProperty("title").GetString());
        Assert.Equal("exam", data.GetProperty("mode").GetString());
        Assert.Equal(1200, data.GetProperty("timeLimitSeconds").GetInt32());
        Assert.True(data.GetProperty("isPublic").GetBoolean());
        Assert.Equal("intermediate", data.GetProperty("level").GetString());
    }

    [Fact]
    public async Task AssignQuestion_WithOwnerTokenAndActiveQuestion_ShouldReturnAssignedTrue()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "quizsetassigner7504",
            email: "quizsetassigner7504@gmail.com",
            fullName: "Quiz Set Assigner 7504");

        var topicId = await SeedTopicAsync(
            name: "Quiz Set Topic 7504",
            slug: "quiz-set-topic-7504");

        var quizSetId = await CreateQuizSetAndGetIdAsync(auth.AccessToken, topicId, "Assign quiz set 7504", true);
        var questionId = await SeedQuestionAsync(topicId, auth.UserId, "Assign question 7504", isActive: true);

        var response = await AssignQuestionAsync(auth.AccessToken, quizSetId, questionId, orderIndex: 0);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);
        Assert.True(root.GetProperty("data").GetProperty("assigned").GetBoolean());
    }

    [Fact]
    public async Task AssignQuestion_WithDuplicateQuestion_ShouldReturnBadRequest()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "quizsetduplicate7505",
            email: "quizsetduplicate7505@gmail.com",
            fullName: "Quiz Set Duplicate 7505");

        var topicId = await SeedTopicAsync(
            name: "Quiz Set Topic 7505",
            slug: "quiz-set-topic-7505");

        var quizSetId = await CreateQuizSetAndGetIdAsync(auth.AccessToken, topicId, "Duplicate assign quiz set 7505", true);
        var questionId = await SeedQuestionAsync(topicId, auth.UserId, "Duplicate assign question 7505", isActive: true);

        var firstResponse = await AssignQuestionAsync(auth.AccessToken, quizSetId, questionId, orderIndex: 0);
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);

        var secondResponse = await AssignQuestionAsync(auth.AccessToken, quizSetId, questionId, orderIndex: 1);

        Assert.Equal(HttpStatusCode.BadRequest, secondResponse.StatusCode);

        using var document = await ReadDocumentAsync(secondResponse);
        var root = document.RootElement;

        AssertFail(root, "Question already assigned.");
    }

    [Fact]
    public async Task GetQuizSet_WithPublicQuizSet_ShouldReturnDetailAndOrderedQuestions()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "quizsetdetail7506",
            email: "quizsetdetail7506@gmail.com",
            fullName: "Quiz Set Detail 7506");

        var topicId = await SeedTopicAsync(
            name: "Quiz Set Topic 7506",
            slug: "quiz-set-topic-7506");

        var quizSetId = await CreateQuizSetAndGetIdAsync(auth.AccessToken, topicId, "Detail quiz set 7506", true);
        var firstQuestionId = await SeedQuestionAsync(topicId, auth.UserId, "First detail question 7506", isActive: true);
        var secondQuestionId = await SeedQuestionAsync(topicId, auth.UserId, "Second detail question 7506", isActive: true);

        await AssignQuestionAsync(auth.AccessToken, quizSetId, secondQuestionId, orderIndex: 2);
        await AssignQuestionAsync(auth.AccessToken, quizSetId, firstQuestionId, orderIndex: 1);

        var response = await _client.GetAsync($"/api/quiz-sets/{quizSetId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);

        var data = root.GetProperty("data");

        Assert.Equal(quizSetId, data.GetProperty("id").GetGuid());
        Assert.Equal("Detail quiz set 7506", data.GetProperty("title").GetString());

        var questions = data.GetProperty("questions").EnumerateArray().ToList();

        Assert.Equal(2, questions.Count);
        Assert.Equal(firstQuestionId, questions[0].GetProperty("questionId").GetGuid());
        Assert.Equal(secondQuestionId, questions[1].GetProperty("questionId").GetGuid());
    }

    [Fact]
    public async Task GetQuizSet_WithPrivateQuizSetAndNonOwnerToken_ShouldReturnForbidden()
    {
        var ownerAuth = await RegisterAndGetAuthAsync(
            username: "quizsetowner7507",
            email: "quizsetowner7507@gmail.com",
            fullName: "Quiz Set Owner 7507");

        var otherAuth = await RegisterAndGetAuthAsync(
            username: "quizsetother7507",
            email: "quizsetother7507@gmail.com",
            fullName: "Quiz Set Other 7507");

        var topicId = await SeedTopicAsync(
            name: "Quiz Set Topic 7507",
            slug: "quiz-set-topic-7507");

        var quizSetId = await CreateQuizSetAndGetIdAsync(ownerAuth.AccessToken, topicId, "Private quiz set 7507", false);

        var response = await SendWithBearerAsync(
            HttpMethod.Get,
            $"/api/quiz-sets/{quizSetId}",
            otherAuth.AccessToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertFail(root, "Forbidden.");
    }

    [Fact]
    public async Task DeleteQuizSet_WithoutSessions_ShouldReturnDeletedTrue()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "quizsetdeleter7508",
            email: "quizsetdeleter7508@gmail.com",
            fullName: "Quiz Set Deleter 7508");

        var topicId = await SeedTopicAsync(
            name: "Quiz Set Topic 7508",
            slug: "quiz-set-topic-7508");

        var quizSetId = await CreateQuizSetAndGetIdAsync(auth.AccessToken, topicId, "Delete quiz set 7508", true);

        var response = await SendWithBearerAsync(HttpMethod.Delete, $"/api/quiz-sets/{quizSetId}", auth.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);
        Assert.True(root.GetProperty("data").GetProperty("deleted").GetBoolean());
    }

    [Fact]
    public async Task DeleteQuizSet_WithExistingSession_ShouldReturnBadRequest()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "quizsetsession7509",
            email: "quizsetsession7509@gmail.com",
            fullName: "Quiz Set Session 7509");

        var topicId = await SeedTopicAsync(
            name: "Quiz Set Topic 7509",
            slug: "quiz-set-topic-7509");

        var quizSetId = await CreateQuizSetAndGetIdAsync(auth.AccessToken, topicId, "Session quiz set 7509", true);

        await SeedQuizSessionAsync(auth.UserId, quizSetId);

        var response = await SendWithBearerAsync(HttpMethod.Delete, $"/api/quiz-sets/{quizSetId}", auth.AccessToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertFail(root, "Quiz set has sessions and cannot be deleted.");
    }

    private async Task<AuthTestData> RegisterAndGetAuthAsync(string username, string email, string fullName)
    {
        var request = new
        {
            username,
            email,
            password = "123456",
            fullName
        };

        var response = await _client.PostAsJsonAsync("/api/auth/register", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var data = document.RootElement.GetProperty("data");
        var user = data.GetProperty("user");

        return new AuthTestData(
            data.GetProperty("accessToken").GetString()!,
            user.GetProperty("id").GetGuid());
    }

    private async Task<HttpResponseMessage> CreateQuizSetAsync(
        string accessToken,
        Guid topicId,
        string title,
        bool isPublic)
    {
        var request = new
        {
            title,
            description = $"Description for {title}",
            mode = "practice",
            timeLimitSeconds = 900,
            isPublic,
            topicId,
            level = "beginner"
        };

        return await SendWithBearerAsync(HttpMethod.Post, "/api/quiz-sets", accessToken, request);
    }

    private async Task<Guid> CreateQuizSetAndGetIdAsync(
        string accessToken,
        Guid topicId,
        string title,
        bool isPublic)
    {
        var response = await CreateQuizSetAsync(accessToken, topicId, title, isPublic);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        return await ReadDataGuidAsync(response, "id");
    }

    private async Task<HttpResponseMessage> AssignQuestionAsync(
        string accessToken,
        Guid quizSetId,
        Guid questionId,
        short orderIndex)
    {
        var request = new
        {
            questionId,
            orderIndex
        };

        return await SendWithBearerAsync(
            HttpMethod.Post,
            $"/api/quiz-sets/{quizSetId}/questions",
            accessToken,
            request);
    }

    private async Task<Guid> SeedTopicAsync(string name, string slug)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var existing = db.Topics.FirstOrDefault(topic => topic.Slug == slug);
        if (existing != null)
        {
            existing.Name = name;
            existing.IsActive = true;
            await db.SaveChangesAsync();
            return existing.Id;
        }

        var topic = new Topic
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = slug,
            Description = $"Description for {name}",
            Icon = "code",
            IsActive = true
        };

        db.Topics.Add(topic);
        await db.SaveChangesAsync();

        return topic.Id;
    }

    private async Task<Guid> SeedQuestionAsync(Guid topicId, Guid createdBy, string content, bool isActive)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var question = new Question
        {
            Id = Guid.NewGuid(),
            TopicId = topicId,
            CreatedBy = createdBy,
            Content = content,
            Level = "beginner",
            Explanation = $"Explanation for {content}",
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow
        };

        db.Questions.Add(question);
        db.QuestionOptions.AddRange(
            new QuestionOption
            {
                Id = Guid.NewGuid(),
                QuestionId = question.Id,
                Content = "Correct option",
                IsCorrect = true,
                OrderIndex = 0
            },
            new QuestionOption
            {
                Id = Guid.NewGuid(),
                QuestionId = question.Id,
                Content = "Wrong option",
                IsCorrect = false,
                OrderIndex = 1
            });

        await db.SaveChangesAsync();

        return question.Id;
    }

    private async Task<Guid> SeedQuizSetAsync(string title, bool isPublic)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var quizSet = new QuizSet
        {
            Id = Guid.NewGuid(),
            CreatedBy = Guid.NewGuid(),
            Title = title,
            Description = $"Description for {title}",
            Mode = "practice",
            TimeLimitSeconds = 900,
            IsPublic = isPublic,
            TopicId = null,
            Level = "beginner",
            CreatedAt = DateTime.UtcNow
        };

        db.QuizSets.Add(quizSet);
        await db.SaveChangesAsync();

        return quizSet.Id;
    }

    private async Task SeedQuizSessionAsync(Guid userId, Guid quizSetId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        db.QuizSessions.Add(new QuizSession
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            QuizSetId = quizSetId,
            Score = null,
            TotalQuestions = 1,
            TimeTakenSeconds = null,
            Status = "in_progress",
            StartedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();
    }

    private async Task<Guid> ReadDataGuidAsync(HttpResponseMessage response, string propertyName)
    {
        using var document = await ReadDocumentAsync(response);
        return document.RootElement.GetProperty("data").GetProperty(propertyName).GetGuid();
    }

    private async Task<HttpResponseMessage> SendWithBearerAsync(
        HttpMethod method,
        string requestUri,
        string accessToken,
        object? body = null)
    {
        using var request = new HttpRequestMessage(method, requestUri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await _client.SendAsync(request);
    }

    private static async Task<JsonDocument> ReadDocumentAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }

    private static void AssertSuccess(JsonElement root)
    {
        Assert.True(root.GetProperty("success").GetBoolean());
    }

    private static void AssertFail(JsonElement root, string expectedMessage)
    {
        Assert.False(root.GetProperty("success").GetBoolean());
        Assert.Contains(expectedMessage, root.GetProperty("message").GetString());
    }

    private sealed record AuthTestData(string AccessToken, Guid UserId);
}
