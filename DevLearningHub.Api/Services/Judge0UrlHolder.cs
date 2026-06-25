namespace DevLearningHub.Api.Services;

// Singleton that holds the active Judge0 base URL so admins can change it at runtime.
public sealed class Judge0UrlHolder
{
    private string _url;

    public Judge0UrlHolder(string defaultUrl)
    {
        _url = defaultUrl;
    }

    public string Url => _url;

    public void SetUrl(string url)
    {
        _url = url.TrimEnd('/');
    }
}
