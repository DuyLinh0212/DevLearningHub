using DevLearningHub.Api.Dtos.Auth;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DevLearningHub.Api.Controllers.Auth;

[ApiController]
[Route("api/auth")]
// Auth endpoints: register, login, refresh, logout.
public class AuthController : ControllerBase
{
    private const string DefaultUserRoleName = "user";

    private readonly DevLearningHubContext _db;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly JwtOptions _jwtOptions;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        DevLearningHubContext db,
        IPasswordHasher<User> passwordHasher,
        ITokenService tokenService,
        IOptions<JwtOptions> jwtOptions,
        ILogger<AuthController> logger)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
        _jwtOptions = jwtOptions.Value;
        _logger = logger;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    // Create account and issue access/refresh tokens.
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register(RegisterRequest request)
    {
        var username = request.Username.Trim();
        var email = request.Email.Trim().ToLowerInvariant();

        var exists = await _db.Users.AnyAsync(u => u.Username == username || u.Email == email);
        if (exists)
        {
            return Conflict(ApiResponse<AuthResponse>.Fail("Username or email already exists."));
        }

        var now = DateTime.Now;
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            FullName = request.FullName?.Trim(),
            XpPoints = 0,
            IsActive = true,
            IsLocked = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        var defaultRole = await GetOrCreateDefaultUserRoleAsync(now);
        await _db.SaveChangesAsync();

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        await EnsureDefaultUserRoleAsync(user.Id, defaultRole.Id, now);

        await WriteAuditAsync(user.Id, "auth.register", "user", user.Id, null);

        var response = await BuildAuthResponseAsync(user);
        return Ok(ApiResponse<AuthResponse>.Ok(response));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    // Validate credentials, then issue access/refresh tokens.
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login(LoginRequest request)
    {
        var identifier = request.UsernameOrEmail.Trim().ToLowerInvariant();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == identifier || u.Email.ToLower() == identifier);
        if (user == null || string.IsNullOrWhiteSpace(user.PasswordHash))
        {
            return Unauthorized(ApiResponse<AuthResponse>.Fail("Invalid credentials."));
        }

        if (!user.IsActive)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<AuthResponse>.Fail("Account is inactive."));
        }

        if (user.IsLocked)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<AuthResponse>.Fail("Account is locked."));
        }

        var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            return Unauthorized(ApiResponse<AuthResponse>.Fail("Invalid credentials."));
        }

        user.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();

        await WriteAuditAsync(user.Id, "auth.login", "user", user.Id, null);

        var response = await BuildAuthResponseAsync(user);
        return Ok(ApiResponse<AuthResponse>.Ok(response));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    // Rotate refresh token and issue new access token.
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Refresh(RefreshTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest(ApiResponse<AuthResponse>.Fail("Refresh token is required."));
        }

        var tokenHash = _tokenService.HashRefreshToken(request.RefreshToken);

        var storedToken = await _db.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash && rt.RevokedAt == null);

        if (storedToken == null || storedToken.ExpiresAt <= DateTime.Now)
        {
            return Unauthorized(ApiResponse<AuthResponse>.Fail("Refresh token is invalid or expired."));
        }

        if (!storedToken.User.IsActive || storedToken.User.IsLocked)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<AuthResponse>.Fail("Account is inactive or locked."));
        }

        storedToken.RevokedAt = DateTime.Now;

        var response = await BuildAuthResponseAsync(storedToken.User);
        await WriteAuditAsync(storedToken.UserId, "auth.refresh", "user", storedToken.UserId, null);

        return Ok(ApiResponse<AuthResponse>.Ok(response));
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    // Revoke refresh token.
    public async Task<ActionResult<ApiResponse<object>>> Logout(LogoutRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest(ApiResponse<object>.Fail("Refresh token is required."));
        }

        var tokenHash = _tokenService.HashRefreshToken(request.RefreshToken);
        var storedToken = await _db.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash && rt.RevokedAt == null);

        if (storedToken == null)
        {
            return Ok(ApiResponse<object>.Ok(new { revoked = false }, "Token already revoked."));
        }

        storedToken.RevokedAt = DateTime.Now;
        await _db.SaveChangesAsync();

        await WriteAuditAsync(storedToken.UserId, "auth.logout", "user", storedToken.UserId, null);

        return Ok(ApiResponse<object>.Ok(new { revoked = true }));
    }

    private async Task<Role> GetOrCreateDefaultUserRoleAsync(DateTime now)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r =>
            r.Name.ToLower() == DefaultUserRoleName);

        if (role != null)
        {
            if (!role.IsActive)
            {
                role.IsActive = true;
                role.UpdatedAt = now;
            }

            return role;
        }

        role = new Role
        {
            Id = Guid.NewGuid(),
            Name = DefaultUserRoleName,
            Description = "Nguoi dung thuong",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Roles.Add(role);

        return role;
    }

    private async Task EnsureDefaultUserRoleAsync(Guid userId, Guid roleId, DateTime assignedAt)
    {
        var alreadyAssigned = await _db.UserRoles.AnyAsync(ur =>
            ur.UserId == userId &&
            ur.RoleId == roleId);

        if (alreadyAssigned)
        {
            return;
        }

        _db.UserRoles.Add(new UserRole
        {
            UserId = userId,
            RoleId = roleId,
            AssignedAt = assignedAt
        });

        await _db.SaveChangesAsync();
    }

    private async Task<AuthResponse> BuildAuthResponseAsync(User user)
    {
        // Load role names for claims.
        var roles = await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => ur.UserId == user.Id)
            .Select(ur => ur.Role.Name)
            .ToListAsync();

        var expiresAt = DateTime.Now.AddMinutes(_jwtOptions.AccessTokenMinutes);
        var accessToken = _tokenService.CreateAccessToken(user, roles, expiresAt);

        var refreshTokenValue = _tokenService.CreateRefreshToken();
        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = _tokenService.HashRefreshToken(refreshTokenValue),
            ExpiresAt = DateTime.Now.AddDays(_jwtOptions.RefreshTokenDays),
            CreatedAt = DateTime.Now
        };

        _db.RefreshTokens.Add(refreshToken);
        await _db.SaveChangesAsync();

        return new AuthResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshTokenValue,
            ExpiresAt = expiresAt,
            User = new UserProfileResponse
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                FullName = user.FullName,
                AvatarUrl = user.AvatarUrl,
                XpPoints = user.XpPoints
            }
        };
    }

    private async Task WriteAuditAsync(Guid actorId, string action, string? targetType, Guid? targetId, string? detail)
    {
        // Store audit log with request IP for traceability.
        var audit = new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = actorId,
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            Detail = detail,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            CreatedAt = DateTime.Now
        };

        _db.AuditLogs.Add(audit);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Audit log written for {Action} by {ActorId}", action, actorId);
    }
}
