using DevLearningHub.Api.Dtos.Community;
using DevLearningHub.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Community;

// Shared vote toggle logic for posts and comments.
internal static class CommunityVotes
{
    public const string PostTarget = "post";
    public const string CommentTarget = "comment";

    public const string Up = "up";
    public const string Down = "down";

    public static bool IsValidVoteType(string? voteType)
    {
        return voteType is Up or Down;
    }

    // Apply a vote toggle: same type again clears it, a different type switches it.
    // Returns the recomputed up/down counts and the caller's current vote.
    public static async Task<VoteResultResponse> ApplyAsync(
        DevLearningHubContext db,
        Guid userId,
        string targetType,
        Guid targetId,
        string voteType)
    {
        var existing = await db.Votes.FirstOrDefaultAsync(v =>
            v.UserId == userId && v.TargetType == targetType && v.TargetId == targetId);

        string? myVote;
        if (existing == null)
        {
            db.Votes.Add(new Vote
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TargetType = targetType,
                TargetId = targetId,
                VoteType = voteType,
                CreatedAt = DateTime.UtcNow
            });
            myVote = voteType;
        }
        else if (existing.VoteType == voteType)
        {
            db.Votes.Remove(existing);
            myVote = null;
        }
        else
        {
            existing.VoteType = voteType;
            myVote = voteType;
        }

        await db.SaveChangesAsync();

        var upvotes = await db.Votes.CountAsync(v =>
            v.TargetType == targetType && v.TargetId == targetId && v.VoteType == Up);
        var downvotes = await db.Votes.CountAsync(v =>
            v.TargetType == targetType && v.TargetId == targetId && v.VoteType == Down);

        return new VoteResultResponse
        {
            Upvotes = upvotes,
            Downvotes = downvotes,
            MyVote = myVote
        };
    }

    // Look up the current user's vote on a target, if any.
    public static async Task<string?> GetMyVoteAsync(
        DevLearningHubContext db,
        Guid userId,
        string targetType,
        Guid targetId)
    {
        return await db.Votes
            .Where(v => v.UserId == userId && v.TargetType == targetType && v.TargetId == targetId)
            .Select(v => v.VoteType)
            .FirstOrDefaultAsync();
    }
}
