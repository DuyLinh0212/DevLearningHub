namespace API_DEVLEARNINGHUB.Services;

// JWT settings bound from configuration.
public class JwtOptions
{
    public string Issuer { get; set; } = "DevLearningHub";

    public string Audience { get; set; } = "DevLearningHub";

    public string Key { get; set; } = string.Empty;

    public int AccessTokenMinutes { get; set; } = 30;

    public int RefreshTokenDays { get; set; } = 14;
}
