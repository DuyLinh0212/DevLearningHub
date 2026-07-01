using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DevLearningHub.Api.Entities;
using DevLearningHub.Test.Factories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevLearningHub.Test;

public class QuizSessionApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public QuizSessionApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task StartQuiz_WithValidTokenAndQuizSetHavingQuestions_ShouldReturnInProgressSessionWithoutCorrectFlags()
    {
        var auth = await RegisterAndGetAuthAsync("sessionstart01", "sessionstart01@gmail.com", "Session Start 01");
        var seededQuiz = await SeedQuizSetAsync(auth.UserId);

        var response = await SendWithBearerAsync(HttpMethod.Post, "/api/quiz-sessions", auth.AccessToken, new
        {
            quizSetId = seededQuiz.QuizSetId
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;
        AssertSuccess(root);

        var data = root.GetProperty("data");
        var sessionId = data.GetProperty("sessionId").GetGuid();

        Assert.NotEqual(Guid.Empty, sessionId);
        Assert.Equal(seededQuiz.QuizSetId, data.GetProperty("quizSetId").GetGuid());
        Assert.Equal("Session Quiz", data.GetProperty("title").GetString());
        Assert.Equal(2, data.GetProperty("totalQuestions").GetInt32());

        var questions = data.GetProperty("questions").EnumerateArray().ToList();
        Assert.Equal(2, questions.Count);

        foreach (var question in questions)
        {
            foreach (var option in question.GetProperty("options").EnumerateArray())
            {
                Assert.False(option.TryGetProperty("isCorrect", out _));
            }
        }

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var session = await db.QuizSessions.FirstAsync(s => s.Id == sessionId);

        Assert.Equal(auth.UserId, session.UserId);
        Assert.Equal(seededQuiz.QuizSetId, session.QuizSetId);
        Assert.Equal("in_progress", session.Status);
        Assert.Equal(2, session.TotalQuestions);
    }

    [Fact]
    public async Task StartQuiz_WithQuizSetWithoutQuestions_ShouldReturnBadRequest()
    {
        var auth = await RegisterAndGetAuthAsync("sessionempty01", "sessionempty01@gmail.com", "Session Empty 01");
        var seededQuiz = await SeedQuizSetAsync(auth.UserId, withQuestions: false);

        var response = await SendWithBearerAsync(HttpMethod.Post, "/api/quiz-sessions", auth.AccessToken, new
        {
            quizSetId = seededQuiz.QuizSetId
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        AssertFail(document.RootElement, "Quiz set has no questions.");
    }

    [Fact]
    public async Task SubmitQuiz_WithValidAnswers_ShouldReturnScoreAndPersistAnswers()
    {
        var auth = await RegisterAndGetAuthAsync("sessionsubmit01", "sessionsubmit01@gmail.com", "Session Submit 01");
        var seededQuiz = await SeedQuizSetAsync(auth.UserId);
        var sessionId = await StartQuizAndGetSessionIdAsync(auth.AccessToken, seededQuiz.QuizSetId);

        var response = await SubmitQuizAsync(auth.AccessToken, sessionId, new[]
        {
            new
            {
                questionId = seededQuiz.Questions[0].QuestionId,
                selectedOptionId = seededQuiz.Questions[0].CorrectOptionId
            },
            new
            {
                questionId = seededQuiz.Questions[1].QuestionId,
                selectedOptionId = seededQuiz.Questions[1].WrongOptionId
            }
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;
        AssertSuccess(root);

        var data = root.GetProperty("data");
        Assert.Equal(sessionId, data.GetProperty("sessionId").GetGuid());
        Assert.Equal(seededQuiz.QuizSetId, data.GetProperty("quizSetId").GetGuid());
        Assert.Equal(1, data.GetProperty("score").GetInt32());
        Assert.Equal(2, data.GetProperty("totalQuestions").GetInt32());
        Assert.Equal(0.5, data.GetProperty("accuracy").GetDouble());

        var answers = data.GetProperty("answers").EnumerateArray().ToList();
        Assert.Equal(2, answers.Count);
        Assert.Contains(answers, a => a.GetProperty("questionId").GetGuid() == seededQuiz.Questions[0].QuestionId
            && a.GetProperty("isCorrect").GetBoolean());
        Assert.Contains(answers, a => a.GetProperty("questionId").GetGuid() == seededQuiz.Questions[1].QuestionId
            && !a.GetProperty("isCorrect").GetBoolean());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        var session = await db.QuizSessions.Include(s => s.QuizAnswers).FirstAsync(s => s.Id == sessionId);

        Assert.Equal("completed", session.Status);
        Assert.Equal((short?)1, session.Score);
        Assert.Equal(45, session.TimeTakenSeconds);
        Assert.Equal(2, session.QuizAnswers.Count);
    }

    [Fact]
    public async Task SubmitQuiz_WithEmptyAnswers_ShouldReturnBadRequest()
    {
        var auth = await RegisterAndGetAuthAsync("sessionemptyanswers01", "sessionemptyanswers01@gmail.com", "Session Empty Answers 01");
        var seededQuiz = await SeedQuizSetAsync(auth.UserId);
        var sessionId = await StartQuizAndGetSessionIdAsync(auth.AccessToken, seededQuiz.QuizSetId);

        var response = await SendWithBearerAsync(HttpMethod.Post, $"/api/quiz-sessions/{sessionId}/submit", auth.AccessToken, new
        {
            answers = Array.Empty<object>()
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        AssertFail(document.RootElement, "Answers are required.");
    }

    [Fact]
    public async Task SubmitQuiz_WithCompletedSession_ShouldReturnBadRequest()
    {
        var auth = await RegisterAndGetAuthAsync("sessionresubmit01", "sessionresubmit01@gmail.com", "Session Resubmit 01");
        var seededQuiz = await SeedQuizSetAsync(auth.UserId);
        var sessionId = await StartQuizAndGetSessionIdAsync(auth.AccessToken, seededQuiz.QuizSetId);

        var firstResponse = await SubmitQuizAsync(auth.AccessToken, sessionId, new[]
        {
            new
            {
                questionId = seededQuiz.Questions[0].QuestionId,
                selectedOptionId = seededQuiz.Questions[0].CorrectOptionId
            }
        });

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);

        var secondResponse = await SubmitQuizAsync(auth.AccessToken, sessionId, new[]
        {
            new
            {
                questionId = seededQuiz.Questions[0].QuestionId,
                selectedOptionId = seededQuiz.Questions[0].CorrectOptionId
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, secondResponse.StatusCode);

        using var document = await ReadDocumentAsync(secondResponse);
        AssertFail(document.RootElement, "Session already completed.");
    }

    [Fact]
    public async Task GetResult_WithOwnerSession_ShouldReturnStoredResult()
    {
        var auth = await RegisterAndGetAuthAsync("sessionresult01", "sessionresult01@gmail.com", "Session Result 01");
        var seededQuiz = await SeedQuizSetAsync(auth.UserId);
        var sessionId = await StartQuizAndGetSessionIdAsync(auth.AccessToken, seededQuiz.QuizSetId);

        var submitResponse = await SubmitQuizAsync(auth.AccessToken, sessionId, new[]
        {
            new
            {
                questionId = seededQuiz.Questions[0].QuestionId,
                selectedOptionId = seededQuiz.Questions[0].CorrectOptionId
            },
            new
            {
                questionId = seededQuiz.Questions[1].QuestionId,
                selectedOptionId = seededQuiz.Questions[1].WrongOptionId
            }
        });

        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);

        var response = await SendWithBearerAsync(HttpMethod.Get, $"/api/quiz-sessions/{sessionId}/result", auth.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;
        AssertSuccess(root);

        var data = root.GetProperty("data");
        Assert.Equal(sessionId, data.GetProperty("sessionId").GetGuid());
        Assert.Equal(1, data.GetProperty("score").GetInt32());
        Assert.Equal(0.5, data.GetProperty("accuracy").GetDouble());

        var firstAnswer = data.GetProperty("answers")
            .EnumerateArray()
            .First(a => a.GetProperty("questionId").GetGuid() == seededQuiz.Questions[0].QuestionId);

        Assert.Equal(seededQuiz.Questions[0].CorrectOptionId, firstAnswer.GetProperty("selectedOptionId").GetGuid());
        Assert.Equal(seededQuiz.Questions[0].CorrectOptionId, firstAnswer.GetProperty("correctOptionId").GetGuid());
        Assert.True(firstAnswer.GetProperty("isCorrect").GetBoolean());
    }

    [Fact]
    public async Task GetResult_WithDifferentUser_ShouldReturnNotFound()
    {
        var owner = await RegisterAndGetAuthAsync("sessionowner01", "sessionowner01@gmail.com", "Session Owner 01");
        var other = await RegisterAndGetAuthAsync("sessionother01", "sessionother01@gmail.com", "Session Other 01");
        var seededQuiz = await SeedQuizSetAsync(owner.UserId);
        var sessionId = await StartQuizAndGetSessionIdAsync(owner.AccessToken, seededQuiz.QuizSetId);

        var submitResponse = await SubmitQuizAsync(owner.AccessToken, sessionId, new[]
        {
            new
            {
                questionId = seededQuiz.Questions[0].QuestionId,
                selectedOptionId = seededQuiz.Questions[0].CorrectOptionId
            }
        });

        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);

        var response = await SendWithBearerAsync(HttpMethod.Get, $"/api/quiz-sessions/{sessionId}/result", other.AccessToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetProgress_AfterSubmittingTopicQuiz_ShouldReturnUpdatedProgress()
    {
        var auth = await RegisterAndGetAuthAsync("progressuser01", "progressuser01@gmail.com", "Progress User 01");
        var seededQuiz = await SeedQuizSetAsync(auth.UserId);
        var sessionId = await StartQuizAndGetSessionIdAsync(auth.AccessToken, seededQuiz.QuizSetId);

        var submitResponse = await SubmitQuizAsync(auth.AccessToken, sessionId, new[]
        {
            new
            {
                questionId = seededQuiz.Questions[0].QuestionId,
                selectedOptionId = seededQuiz.Questions[0].CorrectOptionId
            },
            new
            {
                questionId = seededQuiz.Questions[1].QuestionId,
                selectedOptionId = seededQuiz.Questions[1].WrongOptionId
            }
        });

        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);

        var response = await SendWithBearerAsync(HttpMethod.Get, "/api/users/me/progress", auth.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;
        AssertSuccess(root);

        var progress = Assert.Single(root.GetProperty("data").EnumerateArray());
        Assert.Equal(seededQuiz.TopicId, progress.GetProperty("topicId").GetGuid());
        Assert.Equal("Session Topic", progress.GetProperty("topicName").GetString());
        Assert.Equal(1, progress.GetProperty("totalAttempts").GetInt32());
        Assert.Equal(2, progress.GetProperty("totalQuestions").GetInt32());
        Assert.Equal(1, progress.GetProperty("correctAnswers").GetInt32());
        Assert.Equal(1, progress.GetProperty("bestScore").GetInt32());
        Assert.Equal(0.5, progress.GetProperty("accuracy").GetDouble());
    }

    [Fact]
    public async Task GetProgress_AfterSubmittingQuizWithoutTopic_ShouldNotCreateProgress()
    {
        var auth = await RegisterAndGetAuthAsync("progressnotopic01", "progressnotopic01@gmail.com", "Progress No Topic 01");
        var seededQuiz = await SeedQuizSetAsync(auth.UserId, quizSetHasTopic: false);
        var sessionId = await StartQuizAndGetSessionIdAsync(auth.AccessToken, seededQuiz.QuizSetId);

        var submitResponse = await SubmitQuizAsync(auth.AccessToken, sessionId, new[]
        {
            new
            {
                questionId = seededQuiz.Questions[0].QuestionId,
                selectedOptionId = seededQuiz.Questions[0].CorrectOptionId
            }
        });

        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);

        var response = await SendWithBearerAsync(HttpMethod.Get, "/api/users/me/progress", auth.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;
        AssertSuccess(root);
        Assert.Empty(root.GetProperty("data").EnumerateArray());
    }

    private async Task<AuthTestData> RegisterAndGetAuthAsync(string username, string email, string fullName)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            username,
            email,
            password = "123456",
            fullName
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var data = document.RootElement.GetProperty("data");
        var user = data.GetProperty("user");

        return new AuthTestData(
            data.GetProperty("accessToken").GetString()!,
            user.GetProperty("id").GetGuid());
    }

    private async Task<SeededQuizSetData> SeedQuizSetAsync(
        Guid ownerId,
        bool withQuestions = true,
        bool quizSetHasTopic = true)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var topicId = Guid.NewGuid();
        var quizSetId = Guid.NewGuid();
        var now = DateTime.Now;

        db.Topics.Add(new Topic
        {
            Id = topicId,
            Name = "Session Topic",
            Slug = $"session-topic-{Guid.NewGuid():N}",
            Description = "Topic for quiz session tests",
            Icon = "quiz",
            IsActive = true
        });

        db.QuizSets.Add(new QuizSet
        {
            Id = quizSetId,
            CreatedBy = ownerId,
            Title = "Session Quiz",
            Description = "Quiz for session tests",
            Mode = "practice",
            TimeLimitSeconds = 600,
            IsPublic = true,
            TopicId = quizSetHasTopic ? topicId : null,
            Level = "beginner",
            CreatedAt = now
        });

        var seededQuestions = new List<SeededQuestionData>();

        if (withQuestions)
        {
            for (var index = 0; index < 2; index++)
            {
                var questionId = Guid.NewGuid();
                var correctOptionId = Guid.NewGuid();
                var wrongOptionId = Guid.NewGuid();

                db.Questions.Add(new Question
                {
                    Id = questionId,
                    TopicId = topicId,
                    CreatedBy = ownerId,
                    Content = $"Session question {index + 1}",
                    Level = "beginner",
                    Explanation = "Session test explanation",
                    IsActive = true,
                    CreatedAt = now
                });

                db.QuestionOptions.AddRange(
                    new QuestionOption
                    {
                        Id = correctOptionId,
                        QuestionId = questionId,
                        Content = "Correct option",
                        IsCorrect = true,
                        OrderIndex = 0
                    },
                    new QuestionOption
                    {
                        Id = wrongOptionId,
                        QuestionId = questionId,
                        Content = "Wrong option",
                        IsCorrect = false,
                        OrderIndex = 1
                    });

                db.QuizSetQuestions.Add(new QuizSetQuestion
                {
                    QuizSetId = quizSetId,
                    QuestionId = questionId,
                    OrderIndex = (short)index
                });

                seededQuestions.Add(new SeededQuestionData(questionId, correctOptionId, wrongOptionId));
            }
        }

        await db.SaveChangesAsync();

        return new SeededQuizSetData(quizSetId, topicId, seededQuestions);
    }

    private async Task<Guid> StartQuizAndGetSessionIdAsync(string accessToken, Guid quizSetId)
    {
        var response = await SendWithBearerAsync(HttpMethod.Post, "/api/quiz-sessions", accessToken, new
        {
            quizSetId
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        return document.RootElement.GetProperty("data").GetProperty("sessionId").GetGuid();
    }

    private async Task<HttpResponseMessage> SubmitQuizAsync<TAnswer>(
        string accessToken,
        Guid sessionId,
        IEnumerable<TAnswer> answers)
    {
        return await SendWithBearerAsync(HttpMethod.Post, $"/api/quiz-sessions/{sessionId}/submit", accessToken, new
        {
            answers,
            timeTakenSeconds = 45
        });
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

    private sealed record SeededQuizSetData(Guid QuizSetId, Guid TopicId, List<SeededQuestionData> Questions);

    private sealed record SeededQuestionData(Guid QuestionId, Guid CorrectOptionId, Guid WrongOptionId);
}
