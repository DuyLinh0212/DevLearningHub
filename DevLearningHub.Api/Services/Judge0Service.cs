using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DevLearningHub.Api.Services;

public interface IJudge0Service
{
    Task<Judge0Result> RunAsync(string sourceCode, int languageId, string stdin);
    Task<List<Judge0Result>> SubmitBatchAsync(List<Judge0Submission> submissions);
}

public sealed class Judge0Submission
{
    public string SourceCode { get; set; } = string.Empty;
    public int LanguageId { get; set; }
    public string Stdin { get; set; } = string.Empty;
    public string ExpectedOutput { get; set; } = string.Empty;
}

public sealed class Judge0Result
{
    public string? Token { get; set; }
    public string? Stdout { get; set; }
    public string? Stderr { get; set; }
    public string? CompileOutput { get; set; }
    public string Status { get; set; } = string.Empty;
    public int StatusId { get; set; }
    public double? Time { get; set; }
    public int? Memory { get; set; }
}

public sealed class Judge0Service : IJudge0Service
{
    private static readonly JsonSerializerOptions _json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        NumberHandling = JsonNumberHandling.AllowReadingFromString
    };

    private readonly IHttpClientFactory _httpFactory;
    private readonly Judge0UrlHolder _urlHolder;

    public Judge0Service(IHttpClientFactory httpFactory, Judge0UrlHolder urlHolder)
    {
        _httpFactory = httpFactory;
        _urlHolder = urlHolder;
    }

    public async Task<Judge0Result> RunAsync(string sourceCode, int languageId, string stdin)
    {
        var client = _httpFactory.CreateClient("judge0");
        var url = $"{_urlHolder.Url}/submissions?base64_encoded=false&wait=true";

        var body = new
        {
            source_code = sourceCode,
            language_id = languageId,
            stdin
        };

        var response = await client.PostAsJsonAsync(url, body, _json);
        response.EnsureSuccessStatusCode();

        var raw = await response.Content.ReadFromJsonAsync<Judge0RawResult>(_json)
                  ?? new Judge0RawResult();

        return MapResult(raw);
    }

    public async Task<List<Judge0Result>> SubmitBatchAsync(List<Judge0Submission> submissions)
    {
        var client = _httpFactory.CreateClient("judge0");

        var batchBody = new
        {
            submissions = submissions.Select(s => new
            {
                source_code = s.SourceCode,
                language_id = s.LanguageId,
                stdin = s.Stdin,
                expected_output = s.ExpectedOutput
            }).ToArray()
        };

        var postUrl = $"{_urlHolder.Url}/submissions/batch?base64_encoded=false";
        var postResponse = await client.PostAsJsonAsync(postUrl, batchBody, _json);
        postResponse.EnsureSuccessStatusCode();

        var jsonRoot = await postResponse.Content.ReadFromJsonAsync<JsonElement>(_json);
        var tokens = new List<Judge0TokenResponse>();
        if (jsonRoot.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in jsonRoot.EnumerateArray())
            {
                var tok = item.Deserialize<Judge0TokenResponse>(_json);
                if (tok != null) tokens.Add(tok);
            }
        }
        else if (jsonRoot.ValueKind == JsonValueKind.Object)
        {
            var tok = jsonRoot.Deserialize<Judge0TokenResponse>(_json);
            if (tok != null) tokens.Add(tok);
        }

        var tokenList = string.Join(",", tokens.Select(t => t.Token));

        // Poll until all submissions are done (max 10 attempts, 2s apart).
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var getUrl = $"{_urlHolder.Url}/submissions/batch?tokens={tokenList}&base64_encoded=false";
            var getResponse = await client.GetAsync(getUrl);
            getResponse.EnsureSuccessStatusCode();

            var batch = await getResponse.Content.ReadFromJsonAsync<Judge0BatchResponse>(_json)
                        ?? new Judge0BatchResponse();

            var allDone = batch.Submissions.All(s => s.Status?.Id > 2);
            if (allDone)
            {
                return batch.Submissions.Select(MapResult).ToList();
            }

            await Task.Delay(2000);
        }

        // Return whatever we have after timeout.
        var finalUrl = $"{_urlHolder.Url}/submissions/batch?tokens={tokenList}&base64_encoded=false";
        var final = await client.GetAsync(finalUrl);
        var finalBatch = await final.Content.ReadFromJsonAsync<Judge0BatchResponse>(_json)
                         ?? new Judge0BatchResponse();

        return finalBatch.Submissions.Select(MapResult).ToList();
    }

    private static Judge0Result MapResult(Judge0RawResult raw)
    {
        return new Judge0Result
        {
            Token = raw.Token,
            Stdout = raw.Stdout,
            Stderr = raw.Stderr,
            CompileOutput = raw.CompileOutput,
            StatusId = raw.Status?.Id ?? 0,
            Status = raw.Status?.Description ?? "Unknown",
            Time = raw.Time,
            Memory = raw.Memory
        };
    }

    // Internal deserialization types.
    private sealed class Judge0RawResult
    {
        public string? Token { get; set; }
        public string? Stdout { get; set; }
        public string? Stderr { get; set; }
        public string? CompileOutput { get; set; }
        public Judge0StatusRaw? Status { get; set; }
        public double? Time { get; set; }
        public int? Memory { get; set; }
    }

    private sealed class Judge0StatusRaw
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
    }

    private sealed class Judge0TokenResponse
    {
        public string Token { get; set; } = string.Empty;
    }

    private sealed class Judge0BatchResponse
    {
        public List<Judge0RawResult> Submissions { get; set; } = new();
    }
}
