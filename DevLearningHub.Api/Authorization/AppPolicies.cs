namespace DevLearningHub.Api.Authorization;

public static class AppPolicies
{
    public const string AdminOnly = "AdminOnly";
    // Allows users with either the Moderator or Admin role.
    public const string ModeratorOrAdmin = "ModeratorOrAdmin";
}
