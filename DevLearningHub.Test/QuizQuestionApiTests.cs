using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class QuizQuestionApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public QuizQuestionApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetTopics_ShouldReturnOnlyActiveTopicsOrderedByName()
    {
        var csharpTopicId = await SeedTopicAsync(
            name: "CSharp Topic 7401",
            slug: "csharp-topic-7401",
            isActive: true);

        await SeedTopicAsync(
            name: "Archived Topic 7401",
            slug: "archived-topic-7401",
            isActive: false);

        var response = await _client.GetAsync("/api/topics");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);

        var topics = root.GetProperty("data").EnumerateArray().ToList();

        Assert.Contains(topics, topic => topic.GetProperty("id").GetGuid() == csharpTopicId);
        Assert.DoesNotContain(topics, topic => topic.GetProperty("slug").GetString() == "archived-topic-7401");

        var names = topics.Select(topic => topic.GetProperty("name").GetString()).ToList();
        Assert.Equal(names.OrderBy(name => name).ToList(), names);
    }

    [Fact]
    public async Task GetRoadmaps_ShouldReturnRoadmapsAndTopicsOrderedByOrderIndex()
    {
        var firstTopicId = await SeedTopicAsync(
            name: "Roadmap Topic First 7402",
            slug: "roadmap-topic-first-7402",
            isActive: true);

        var secondTopicId = await SeedTopicAsync(
            name: "Roadmap Topic Second 7402",
            slug: "roadmap-topic-second-7402",
            isActive: true);

        await SeedRoadmapAsync(
            title: "Second Roadmap 7402",
            level: "intermediate",
            orderIndex: 2,
            topics: new[]
            {
                (secondTopicId, (short)2),
                (firstTopicId, (short)1)
            });

        await SeedRoadmapAsync(
            title: "First Roadmap 7402",
            level: "beginner",
            orderIndex: 1,
            topics: new[]
            {
                (secondTopicId, (short)2),
                (firstTopicId, (short)1)
            });

        var response = await _client.GetAsync("/api/roadmaps");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);

        var roadmaps = root
            .GetProperty("data")
            .EnumerateArray()
            .Where(roadmap => roadmap.GetProperty("title").GetString()!.Contains("7402"))
            .ToList();

        Assert.Equal(2, roadmaps.Count);
        Assert.Equal("First Roadmap 7402", roadmaps[0].GetProperty("title").GetString());
        Assert.Equal("Second Roadmap 7402", roadmaps[1].GetProperty("title").GetString());

        var roadmapTopics = roadmaps[0].GetProperty("topics").EnumerateArray().ToList();

        Assert.Equal(firstTopicId, roadmapTopics[0].GetProperty("topicId").GetGuid());
        Assert.Equal(secondTopicId, roadmapTopics[1].GetProperty("topicId").GetGuid());
    }

    [Fact]
    public async Task GetQuestions_WithoutIncludeInactive_ShouldReturnOnlyActiveQuestions()
    {
        var topicId = await SeedTopicAsync(
            name: "Question Topic 7403",
            slug: "question-topic-7403",
            isActive: true);

        var activeQuestionId = await SeedQuestionAsync(
            topicId,
            content: "Active question 7403",
            level: "beginner",
            isActive: true);

        await SeedQuestionAsync(
            topicId,
            content: "Inactive question 7403",
            level: "beginner",
            isActive: false);

        var response = await _client.GetAsync($"/api/questions?topicId={topicId}&level=beginner");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);

        var questions = root.GetProperty("data").EnumerateArray().ToList();

        Assert.Contains(questions, question => question.GetProperty("id").GetGuid() == activeQuestionId);
        Assert.DoesNotContain(questions, question => question.GetProperty("content").GetString() == "Inactive question 7403");
    }

    [Fact]
    public async Task CreateQuestion_WithValidPayload_ShouldReturnQuestionWithOptions()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "questioncreator7404",
            email: "questioncreator7404@gmail.com",
            fullName: "Question Creator 7404");

        var topicId = await SeedTopicAsync(
            name: "Create Question Topic 7404",
            slug: "create-question-topic-7404",
            isActive: true);

        var response = await CreateQuestionAsync(auth.AccessToken, topicId, "Valid create question 7404");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);

        var data = root.GetProperty("data");

        Assert.Equal(topicId, data.GetProperty("topicId").GetGuid());
        Assert.Equal("Valid create question 7404", data.GetProperty("content").GetString());
        Assert.Equal("beginner", data.GetProperty("level").GetString());
        Assert.True(data.GetProperty("isActive").GetBoolean());

        var options = data.GetProperty("options").EnumerateArray().ToList();

        Assert.Equal(3, options.Count);
        Assert.Contains(options, option => option.GetProperty("isCorrect").GetBoolean());
    }

    [Fact]
    public async Task CreateQuestion_WithoutCorrectOption_ShouldReturnBadRequest()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "questioninvalid7405",
            email: "questioninvalid7405@gmail.com",
            fullName: "Question Invalid 7405");

        var topicId = await SeedTopicAsync(
            name: "Invalid Question Topic 7405",
            slug: "invalid-question-topic-7405",
            isActive: true);

        var request = new
        {
            topicId,
            content = "Invalid create question 7405",
            level = "beginner",
            explanation = "No correct option.",
            options = new[]
            {
                new { content = "Wrong 1", isCorrect = false, orderIndex = (byte)0 },
                new { content = "Wrong 2", isCorrect = false, orderIndex = (byte)1 }
            }
        };

        var response = await SendWithBearerAsync(HttpMethod.Post, "/api/questions", auth.AccessToken, request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertFail(root, "At least two options and one correct answer are required.");
    }

    [Fact]
    public async Task UpdateQuestion_WithOwnerToken_ShouldReplaceQuestionAndOptions()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "questionupdater7406",
            email: "questionupdater7406@gmail.com",
            fullName: "Question Updater 7406");

        var topicId = await SeedTopicAsync(
            name: "Update Question Topic 7406",
            slug: "update-question-topic-7406",
            isActive: true);

        var createResponse = await CreateQuestionAsync(auth.AccessToken, topicId, "Before update question 7406");
        var questionId = await ReadDataGuidAsync(createResponse, "id");

        var request = new
        {
            topicId,
            content = "After update question 7406",
            level = "intermediate",
            explanation = "Updated explanation.",
            isActive = true,
            options = new[]
            {
                new { content = "Updated correct", isCorrect = true, orderIndex = (byte)0 },
                new { content = "Updated wrong", isCorrect = false, orderIndex = (byte)1 }
            }
        };

        var response = await SendWithBearerAsync(HttpMethod.Put, $"/api/questions/{questionId}", auth.AccessToken, request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);

        var data = root.GetProperty("data");

        Assert.Equal(questionId, data.GetProperty("id").GetGuid());
        Assert.Equal("After update question 7406", data.GetProperty("content").GetString());
        Assert.Equal("intermediate", data.GetProperty("level").GetString());

        var options = data.GetProperty("options").EnumerateArray().ToList();

        Assert.Equal(2, options.Count);
        Assert.Contains(options, option => option.GetProperty("content").GetString() == "Updated correct");
        Assert.DoesNotContain(options, option => option.GetProperty("content").GetString() == "Answer A");
    }

    [Fact]
    public async Task DeleteQuestion_WithOwnerToken_ShouldSoftDeleteAndHideFromDefaultList()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "questiondeleter7407",
            email: "questiondeleter7407@gmail.com",
            fullName: "Question Deleter 7407");

        var topicId = await SeedTopicAsync(
            name: "Delete Question Topic 7407",
            slug: "delete-question-topic-7407",
            isActive: true);

        var createResponse = await CreateQuestionAsync(auth.AccessToken, topicId, "Delete question 7407");
        var questionId = await ReadDataGuidAsync(createResponse, "id");

        var deleteResponse = await SendWithBearerAsync(HttpMethod.Delete, $"/api/questions/{questionId}", auth.AccessToken);

        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

        using (var deleteDocument = await ReadDocumentAsync(deleteResponse))
        {
            var deleteRoot = deleteDocument.RootElement;
            AssertSuccess(deleteRoot);
            Assert.True(deleteRoot.GetProperty("data").GetProperty("deleted").GetBoolean());
        }

        var listResponse = await _client.GetAsync($"/api/questions?topicId={topicId}");

        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        using var document = await ReadDocumentAsync(listResponse);
        var root = document.RootElement;

        AssertSuccess(root);
        Assert.DoesNotContain(
            root.GetProperty("data").EnumerateArray(),
            question => question.GetProperty("id").GetGuid() == questionId);
    }

    [Fact]
    public async Task ImportQuestions_WithRawArrayPayload_ShouldReturnCreatedAndSkippedSummary()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "questionimporter7408",
            email: "questionimporter7408@gmail.com",
            fullName: "Question Importer 7408");

        var topicId = await SeedTopicAsync(
            name: "Import Question Topic 7408",
            slug: "import-question-topic-7408",
            isActive: true);

        var invalidTopicId = Guid.NewGuid();

        var requests = new[]
        {
            new
            {
                topicId,
                content = "Imported valid question 7408",
                level = "beginner",
                explanation = "Valid import.",
                options = new[]
                {
                    new { content = "Correct", isCorrect = true, orderIndex = (byte)0 },
                    new { content = "Wrong", isCorrect = false, orderIndex = (byte)1 }
                }
            },
            new
            {
                topicId = invalidTopicId,
                content = "Imported invalid topic question 7408",
                level = "beginner",
                explanation = "Invalid import.",
                options = new[]
                {
                    new { content = "Correct", isCorrect = true, orderIndex = (byte)0 },
                    new { content = "Wrong", isCorrect = false, orderIndex = (byte)1 }
                }
            }
        };

        var response = await SendWithBearerAsync(HttpMethod.Post, "/api/questions/import", auth.AccessToken, requests);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertSuccess(root);

        var data = root.GetProperty("data");

        Assert.Equal(1, data.GetProperty("createdCount").GetInt32());
        Assert.Equal(1, data.GetProperty("skippedCount").GetInt32());

        var errors = data.GetProperty("errors").EnumerateArray().Select(error => error.GetString()).ToList();

        Assert.Contains(errors, error => error!.Contains("Topic not found"));
    }

    [Fact]
    public async Task ImportQuestions_WithWebJsonPayload_ShouldCreateTopicAndQuestion()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "webjsonimporter7410",
            email: "webjsonimporter7410@gmail.com",
            fullName: "Web Json Importer 7410");

        var requests = new[]
        {
            new
            {
                text = "Which password is the strongest?",
                topic = "Information Security 7410",
                level = "beginner",
                points = 2,
                options = new[] { "12345678", "Strong!Password#7410" },
                correctIndex = 1,
                explanation = "Long and complex passwords are harder to guess."
            }
        };

        var response = await SendWithBearerAsync(HttpMethod.Post, "/api/questions/import", auth.AccessToken, requests);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var data = document.RootElement.GetProperty("data");

        Assert.Equal(1, data.GetProperty("createdCount").GetInt32());
        Assert.Equal(0, data.GetProperty("skippedCount").GetInt32());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var topic = db.Topics.Single(topic => topic.Name == "Information Security 7410");
        var question = db.Questions.Single(question => question.Content == "Which password is the strongest?");
        var options = db.QuestionOptions.Where(option => option.QuestionId == question.Id).OrderBy(option => option.OrderIndex).ToList();

        Assert.Equal(topic.Id, question.TopicId);
        Assert.Equal(2, options.Count);
        Assert.False(options[0].IsCorrect);
        Assert.True(options[1].IsCorrect);
    }

    [Fact]
    public async Task ImportQuestions_WithEmptyList_ShouldReturnBadRequest()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "questionemptyimport7409",
            email: "questionemptyimport7409@gmail.com",
            fullName: "Question Empty Import 7409");

        var response = await SendWithBearerAsync(
            HttpMethod.Post,
            "/api/questions/import",
            auth.AccessToken,
            Array.Empty<object>());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;

        AssertFail(root, "Import list is empty.");
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

    private async Task<HttpResponseMessage> CreateQuestionAsync(string accessToken, Guid topicId, string content)
    {
        var request = new
        {
            topicId,
            content,
            level = "beginner",
            explanation = "Question explanation.",
            options = new[]
            {
                new { content = "Answer A", isCorrect = true, orderIndex = (byte)0 },
                new { content = "Answer B", isCorrect = false, orderIndex = (byte)1 },
                new { content = "Answer C", isCorrect = false, orderIndex = (byte)2 }
            }
        };

        return await SendWithBearerAsync(HttpMethod.Post, "/api/questions", accessToken, request);
    }

    private async Task<Guid> SeedTopicAsync(string name, string slug, bool isActive)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var existing = db.Topics.FirstOrDefault(topic => topic.Slug == slug);
        if (existing != null)
        {
            existing.Name = name;
            existing.IsActive = isActive;
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
            IsActive = isActive
        };

        db.Topics.Add(topic);
        await db.SaveChangesAsync();

        return topic.Id;
    }

    private async Task SeedRoadmapAsync(
        string title,
        string level,
        short orderIndex,
        IEnumerable<(Guid TopicId, short OrderIndex)> topics)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var roadmapId = Guid.NewGuid();

        db.Roadmaps.Add(new Roadmap
        {
            Id = roadmapId,
            Title = title,
            Level = level,
            Description = $"Description for {title}",
            ReviewStatus = "approved",
            OrderIndex = orderIndex
        });

        foreach (var topic in topics)
        {
            db.RoadmapTopics.Add(new RoadmapTopic
            {
                RoadmapId = roadmapId,
                TopicId = topic.TopicId,
                OrderIndex = topic.OrderIndex
            });
        }

        await db.SaveChangesAsync();
    }

    private async Task<Guid> SeedQuestionAsync(Guid topicId, string content, string level, bool isActive)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var question = new Question
        {
            Id = Guid.NewGuid(),
            TopicId = topicId,
            CreatedBy = Guid.NewGuid(),
            Content = content,
            Level = level,
            Explanation = $"Explanation for {content}",
            IsActive = isActive,
            CreatedAt = DateTime.Now
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
