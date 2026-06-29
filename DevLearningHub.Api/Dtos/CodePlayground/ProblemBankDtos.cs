using System;
using System.Collections.Generic;

namespace DevLearningHub.Api.Dtos.CodePlayground;

// Lightweight user info shown alongside a bank, rating or participant row.
public class ProblemBankUserSummary
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
}

// ----- Requests -----

public class CreateProblemBankRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPublic { get; set; } = true;
}

public class UpdateProblemBankRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPublic { get; set; } = true;
}

public class AddProblemToBankRequest
{
    public Guid ProblemId { get; set; }
    public int? OrderIndex { get; set; }
}

public class RateProblemBankRequest
{
    public byte Rating { get; set; }
    public string? Comment { get; set; }
}

// ----- Responses -----

// Summary card for a bank in list views.
public class ProblemBankResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
    public ProblemBankUserSummary Creator { get; set; } = new();
    public int ProblemCount { get; set; }
    public int LikeCount { get; set; }
    public double AvgRating { get; set; }
    public int RatingCount { get; set; }
    // Whether the current (authenticated) user liked it / their star value (null if none).
    public bool MyLiked { get; set; }
    public byte? MyRating { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// One exercise inside a bank.
public class ProblemBankProblemItem
{
    public Guid ProblemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int OrderIndex { get; set; }
    public DateTime AddedAt { get; set; }
}

// Full bank detail = summary + the list of exercises it contains.
public class ProblemBankDetailResponse : ProblemBankResponse
{
    public List<ProblemBankProblemItem> Problems { get; set; } = new();
}

// One review row.
public class ProblemBankRatingResponse
{
    public ProblemBankUserSummary User { get; set; } = new();
    public byte Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// Best accuracy a user reached on a single exercise in the bank.
public class ProblemBankProblemAccuracy
{
    public Guid ProblemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool Solved { get; set; }
    // Best accuracy across attempts, 0-100 (null if never attempted).
    public double? BestAccuracyPercent { get; set; }
}

// Current user's progress through one bank.
public class ProblemBankProgressResponse
{
    public Guid BankId { get; set; }
    public int TotalProblems { get; set; }
    public int SolvedProblems { get; set; }
    public double CompletionPercent { get; set; }
    // Average of per-problem best accuracy over problems the user attempted.
    public double AvgAccuracyPercent { get; set; }
    public List<ProblemBankProblemAccuracy> Problems { get; set; } = new();
}

// A learner who attempted at least one exercise in the bank.
public class ProblemBankParticipantResponse
{
    public ProblemBankUserSummary User { get; set; } = new();
    public int SolvedCount { get; set; }
    public int TotalProblems { get; set; }
    public double CompletionPercent { get; set; }
    public double AvgAccuracyPercent { get; set; }
}
