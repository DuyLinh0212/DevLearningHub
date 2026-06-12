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

public class ForumApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public ForumApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreatePost_WithValidPayload_ShouldReturnCreatedPostWithTags()
    {
        var auth = await RegisterAndGetAuthAsync(
            username: "forumcreator9001",
            email: "forumcreator9001@gmail.com",
            fullName: "Forum Creator 9001");

        var tagId = await SeedTagAsync("CSharp 9001", "csharp-9001");

        var response = await SendWithBearerAsync(HttpMethod.Post, "/api/posts", auth.AccessToken, new
        {
            title = "How to test forum API 9001?",
            bodyMarkdown = "I need help writing xUnit tests for forum endpoints.",
            imageUrl = "https://example.com/forum.png",
            tagIds = new[] { tagId }
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;
        AssertSuccess(root);

        var data = root.GetProperty("data");
        Assert.False(data.GetProperty("id").GetGuid() == Guid.Empty);
        Assert.Equal("How to test forum API 9001?", data.GetProperty("title").GetString());
        Assert.Equal("I need help writing xUnit tests for forum endpoints.", data.GetProperty("bodyMarkdown").GetString());
        Assert.Equal("https://example.com/forum.png", data.GetProperty("imageUrl").GetString());
        Assert.Equal(auth.UserId, data.GetProperty("author").GetProperty("id").GetGuid());
        Assert.Equal(0, data.GetProperty("upvotes").GetInt32());
        Assert.Equal(0, data.GetProperty("downvotes").GetInt32());
        Assert.Single(data.GetProperty("tags").EnumerateArray());
        Assert.Equal("csharp-9001", data.GetProperty("tags")[0].GetProperty("slug").GetString());
    }

    [Fact]
    public async Task GetPosts_WithSearchAndTag_ShouldReturnMatchingVisiblePostsOnly()
    {
        var author = await RegisterAndGetAuthAsync(
            username: "forumfeed9002",
            email: "forumfeed9002@gmail.com",
            fullName: "Forum Feed 9002");

        var tagId = await SeedTagAsync("Angular 9002", "angular-9002");
        var matchingPostId = await SeedPostAsync(author.UserId, "Angular question 9002", "Need Angular help", false, tagId);
        await SeedPostAsync(author.UserId, "Hidden Angular question 9002", "Need Angular help", true, tagId);
        await SeedPostAsync(author.UserId, "SQL question 9002", "Need database help", false);

        var response = await _client.GetAsync("/api/posts?search=Angular&tag=angular-9002");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        var root = document.RootElement;
        AssertSuccess(root);

        var data = root.GetProperty("data");
        var items = data.GetProperty("items").EnumerateArray().ToList();

        Assert.Equal(1, data.GetProperty("totalCount").GetInt32());
        Assert.Single(items);
        Assert.Equal(matchingPostId, items[0].GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task GetPost_ShouldIncrementViewCount()
    {
        var author = await RegisterAndGetAuthAsync(
            username: "forumdetail9003",
            email: "forumdetail9003@gmail.com",
            fullName: "Forum Detail 9003");

        var postId = await SeedPostAsync(author.UserId, "View count post 9003", "Body", false);

        var firstResponse = await _client.GetAsync($"/api/posts/{postId}");
        var secondResponse = await _client.GetAsync($"/api/posts/{postId}");

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);

        using var firstDocument = await ReadDocumentAsync(firstResponse);
        using var secondDocument = await ReadDocumentAsync(secondResponse);

        Assert.Equal(1, firstDocument.RootElement.GetProperty("data").GetProperty("viewCount").GetInt32());
        Assert.Equal(2, secondDocument.RootElement.GetProperty("data").GetProperty("viewCount").GetInt32());
    }

    [Fact]
    public async Task UpdatePost_WithNonOwnerToken_ShouldReturnForbidden()
    {
        var owner = await RegisterAndGetAuthAsync(
            username: "forumpostowner9004",
            email: "forumpostowner9004@gmail.com",
            fullName: "Forum Post Owner 9004");
        var other = await RegisterAndGetAuthAsync(
            username: "forumpostother9004",
            email: "forumpostother9004@gmail.com",
            fullName: "Forum Post Other 9004");

        var postId = await SeedPostAsync(owner.UserId, "Owner only post 9004", "Body", false);

        var response = await SendWithBearerAsync(HttpMethod.Put, $"/api/posts/{postId}", other.AccessToken, new
        {
            title = "Other user update",
            bodyMarkdown = "This should not be allowed."
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        AssertFail(document.RootElement, "Forbidden.");
    }

    [Fact]
    public async Task VotePost_WithSameVoteTwice_ShouldToggleVoteOff()
    {
        var author = await RegisterAndGetAuthAsync(
            username: "forumvoteauthor9005",
            email: "forumvoteauthor9005@gmail.com",
            fullName: "Forum Vote Author 9005");
        var voter = await RegisterAndGetAuthAsync(
            username: "forumvoter9005",
            email: "forumvoter9005@gmail.com",
            fullName: "Forum Voter 9005");

        var postId = await SeedPostAsync(author.UserId, "Vote toggle post 9005", "Body", false);

        var firstResponse = await SendWithBearerAsync(HttpMethod.Post, $"/api/posts/{postId}/vote", voter.AccessToken, new
        {
            voteType = "up"
        });
        var secondResponse = await SendWithBearerAsync(HttpMethod.Post, $"/api/posts/{postId}/vote", voter.AccessToken, new
        {
            voteType = "up"
        });

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);

        using var firstDocument = await ReadDocumentAsync(firstResponse);
        using var secondDocument = await ReadDocumentAsync(secondResponse);

        Assert.Equal(1, firstDocument.RootElement.GetProperty("data").GetProperty("upvotes").GetInt32());
        Assert.Equal("up", firstDocument.RootElement.GetProperty("data").GetProperty("myVote").GetString());
        Assert.Equal(0, secondDocument.RootElement.GetProperty("data").GetProperty("upvotes").GetInt32());
        Assert.Equal(JsonValueKind.Null, secondDocument.RootElement.GetProperty("data").GetProperty("myVote").ValueKind);
    }

    [Fact]
    public async Task AddComment_WithReply_ShouldReturnNestedCommentTree()
    {
        var author = await RegisterAndGetAuthAsync(
            username: "forumcommentauthor9006",
            email: "forumcommentauthor9006@gmail.com",
            fullName: "Forum Comment Author 9006");
        var commenter = await RegisterAndGetAuthAsync(
            username: "forumcommenter9006",
            email: "forumcommenter9006@gmail.com",
            fullName: "Forum Commenter 9006");

        var postId = await SeedPostAsync(author.UserId, "Nested comment post 9006", "Body", false);

        var commentResponse = await SendWithBearerAsync(HttpMethod.Post, $"/api/posts/{postId}/comments", commenter.AccessToken, new
        {
            bodyMarkdown = "Root comment 9006"
        });
        Assert.Equal(HttpStatusCode.OK, commentResponse.StatusCode);
        var rootCommentId = await ReadDataGuidAsync(commentResponse, "id");

        var replyResponse = await SendWithBearerAsync(HttpMethod.Post, $"/api/posts/{postId}/comments", author.AccessToken, new
        {
            bodyMarkdown = "Reply comment 9006",
            parentId = rootCommentId
        });
        Assert.Equal(HttpStatusCode.OK, replyResponse.StatusCode);

        var treeResponse = await _client.GetAsync($"/api/posts/{postId}/comments");
        Assert.Equal(HttpStatusCode.OK, treeResponse.StatusCode);

        using var document = await ReadDocumentAsync(treeResponse);
        var comments = document.RootElement.GetProperty("data").EnumerateArray().ToList();

        Assert.Single(comments);
        Assert.Equal(rootCommentId, comments[0].GetProperty("id").GetGuid());
        Assert.Single(comments[0].GetProperty("replies").EnumerateArray());
        Assert.Equal("Reply comment 9006", comments[0].GetProperty("replies")[0].GetProperty("bodyMarkdown").GetString());
    }

    [Fact]
    public async Task AcceptComment_ByPostAuthor_ShouldToggleAcceptedAnswer()
    {
        var author = await RegisterAndGetAuthAsync(
            username: "forumacceptauthor9007",
            email: "forumacceptauthor9007@gmail.com",
            fullName: "Forum Accept Author 9007");
        var commenter = await RegisterAndGetAuthAsync(
            username: "forumacceptcommenter9007",
            email: "forumacceptcommenter9007@gmail.com",
            fullName: "Forum Accept Commenter 9007");

        var postId = await SeedPostAsync(author.UserId, "Accept answer post 9007", "Body", false);
        var commentId = await SeedCommentAsync(postId, commenter.UserId, "Candidate answer 9007");

        var acceptResponse = await SendWithBearerAsync(HttpMethod.Post, $"/api/comments/{commentId}/accept", author.AccessToken);
        var toggleResponse = await SendWithBearerAsync(HttpMethod.Post, $"/api/comments/{commentId}/accept", author.AccessToken);

        Assert.Equal(HttpStatusCode.OK, acceptResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, toggleResponse.StatusCode);

        using var acceptDocument = await ReadDocumentAsync(acceptResponse);
        using var toggleDocument = await ReadDocumentAsync(toggleResponse);

        Assert.True(acceptDocument.RootElement.GetProperty("data").GetProperty("isAccepted").GetBoolean());
        Assert.False(toggleDocument.RootElement.GetProperty("data").GetProperty("isAccepted").GetBoolean());
    }

    [Fact]
    public async Task DeleteComment_ShouldDeleteCommentAndReplies()
    {
        var author = await RegisterAndGetAuthAsync(
            username: "forumdeleteauthor9008",
            email: "forumdeleteauthor9008@gmail.com",
            fullName: "Forum Delete Author 9008");

        var postId = await SeedPostAsync(author.UserId, "Delete comment subtree post 9008", "Body", false);
        var rootCommentId = await SeedCommentAsync(postId, author.UserId, "Root to delete 9008");
        await SeedCommentAsync(postId, author.UserId, "Reply to delete 9008", rootCommentId);

        var response = await SendWithBearerAsync(HttpMethod.Delete, $"/api/comments/{rootCommentId}", author.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await ReadDocumentAsync(response);
        AssertSuccess(document.RootElement);
        Assert.Equal(2, document.RootElement.GetProperty("data").GetProperty("count").GetInt32());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();
        Assert.False(db.Comments.Any(comment => comment.PostId == postId));
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

    private async Task<Guid> SeedTagAsync(string name, string slug)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var existing = db.Tags.FirstOrDefault(tag => tag.Slug == slug);
        if (existing != null)
        {
            return existing.Id;
        }

        var tag = new Tag
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = slug,
            ColorHex = "#6366f1"
        };

        db.Tags.Add(tag);
        await db.SaveChangesAsync();

        return tag.Id;
    }

    private async Task<Guid> SeedPostAsync(
        Guid authorId,
        string title,
        string body,
        bool isHidden,
        Guid? tagId = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var post = new Post
        {
            Id = Guid.NewGuid(),
            AuthorId = authorId,
            Title = title,
            BodyMarkdown = body,
            Upvotes = 0,
            Downvotes = 0,
            ViewCount = 0,
            IsHidden = isHidden,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (tagId.HasValue)
        {
            var tag = await db.Tags.FirstAsync(tag => tag.Id == tagId.Value);
            post.Tags.Add(tag);
        }

        db.Posts.Add(post);
        await db.SaveChangesAsync();

        return post.Id;
    }

    private async Task<Guid> SeedCommentAsync(
        Guid postId,
        Guid authorId,
        string body,
        Guid? parentId = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevLearningHubContext>();

        var comment = new Comment
        {
            Id = Guid.NewGuid(),
            PostId = postId,
            AuthorId = authorId,
            ParentId = parentId,
            BodyMarkdown = body,
            Upvotes = 0,
            Downvotes = 0,
            IsAccepted = false,
            IsHidden = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Comments.Add(comment);
        await db.SaveChangesAsync();

        return comment.Id;
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
