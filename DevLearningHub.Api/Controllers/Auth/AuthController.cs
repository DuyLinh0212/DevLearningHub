using System.Security.Cryptography;
using DevLearningHub.Api.Dtos.Auth;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Entities;
using DevLearningHub.Api.Services;
using Google.Apis.Auth;
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
    private readonly IPermissionService _permissionService;
    private readonly IAuditService _audit;
    private readonly JwtOptions _jwtOptions;
    private readonly ILogger<AuthController> _logger;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly GoogleOptions _googleOptions;

    public AuthController(
        DevLearningHubContext db,
        IPasswordHasher<User> passwordHasher,
        ITokenService tokenService,
        IPermissionService permissionService,
        IAuditService audit,
        IOptions<JwtOptions> jwtOptions,
        ILogger<AuthController> logger,
        IEmailService emailService,
        IConfiguration configuration,
        IOptions<GoogleOptions> googleOptions)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
        _permissionService = permissionService;
        _audit = audit;
        _jwtOptions = jwtOptions.Value;
        _logger = logger;
        _emailService = emailService;
        _configuration = configuration;
        _googleOptions = googleOptions.Value;
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

    [HttpPost("google")]
    [AllowAnonymous]
    // Verify a Google Identity Services ID token, then log in or provision the user.
    public async Task<ActionResult<ApiResponse<AuthResponse>>> GoogleLogin(GoogleLoginRequest request)
    {
        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { _googleOptions.ClientId }
            });
        }
        catch (InvalidJwtException)
        {
            return Unauthorized(ApiResponse<AuthResponse>.Fail("Google ID token không hợp lệ."));
        }

        var email = payload.Email.Trim().ToLowerInvariant();
        var now = DateTime.Now;

        var user = await _db.Users.FirstOrDefaultAsync(u => u.GoogleId == payload.Subject)
            ?? await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            var username = await GenerateUniqueUsernameFromEmailAsync(email);
            user = new User
            {
                Id = Guid.NewGuid(),
                Username = username,
                Email = email,
                GoogleId = payload.Subject,
                FullName = payload.Name,
                AvatarUrl = payload.Picture,
                XpPoints = 0,
                IsActive = true,
                IsLocked = false,
                CreatedAt = now,
                UpdatedAt = now
            };

            var defaultRole = await GetOrCreateDefaultUserRoleAsync(now);
            await _db.SaveChangesAsync();

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            await EnsureDefaultUserRoleAsync(user.Id, defaultRole.Id, now);
            await WriteAuditAsync(user.Id, "auth.register_google", "user", user.Id, null);
        }
        else if (user.GoogleId == null)
        {
            // Link an existing password-based account to this Google identity.
            user.GoogleId = payload.Subject;
            user.UpdatedAt = now;
            await _db.SaveChangesAsync();
        }

        if (!user.IsActive)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<AuthResponse>.Fail("Account is inactive."));
        }

        if (user.IsLocked)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<AuthResponse>.Fail("Account is locked."));
        }

        await WriteAuditAsync(user.Id, "auth.google_login", "user", user.Id, null);

        var response = await BuildAuthResponseAsync(user);
        return Ok(ApiResponse<AuthResponse>.Ok(response));
    }

    private async Task<string> GenerateUniqueUsernameFromEmailAsync(string email)
    {
        var baseUsername = new string(email.Split('@')[0].Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        if (string.IsNullOrEmpty(baseUsername)) baseUsername = "user";

        var candidate = baseUsername;
        var suffix = 0;
        while (await _db.Users.AnyAsync(u => u.Username == candidate))
        {
            suffix++;
            candidate = $"{baseUsername}{suffix}";
        }

        return candidate;
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

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> ForgotPassword(ForgotPasswordRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Always return success to prevent email enumeration.
        if (user == null || !user.IsActive || user.IsLocked)
            return Ok(ApiResponse<object>.Ok(new { }, "If the email exists, a reset link has been sent."));

        // Invalidate any existing unused tokens for this user.
        var existing = await _db.PasswordResetTokens
            .Where(t => t.UserId == user.Id && !t.IsUsed && t.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();
        foreach (var t in existing) t.IsUsed = true;

        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var tokenHash = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken)));

        _db.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddMinutes(30),
            IsUsed = false,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var clientUrl = _configuration["App:ClientUrl"] ?? "http://localhost:4200";
        var resetLink = $"{clientUrl}/reset-password?token={rawToken}";
        var displayName = user.FullName ?? user.Username;

        var html = $@"
<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px'>
  <h2 style='color:#7c3aed'>DevLearningHub</h2>
  <p>Xin chào <strong>{displayName}</strong>,</p>
  <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
  <p>Nhấn vào nút bên dưới để đặt lại mật khẩu. Link có hiệu lực trong <strong>30 phút</strong>.</p>
  <a href='{resetLink}'
     style='display:inline-block;margin:16px 0;padding:12px 24px;background:#7c3aed;color:#fff;
            text-decoration:none;border-radius:6px;font-weight:bold'>
    Đặt lại mật khẩu
  </a>
  <p style='color:#888;font-size:0.85rem'>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
</div>";

        await _emailService.SendAsync(user.Email, displayName, "Đặt lại mật khẩu – DevLearningHub", html);

        return Ok(ApiResponse<object>.Ok(new { }, "If the email exists, a reset link has been sent."));
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> ResetPassword(ResetPasswordRequest request)
    {
        var tokenHash = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(request.Token)));

        var resetToken = await _db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && !t.IsUsed);

        if (resetToken == null || resetToken.ExpiresAt <= DateTime.UtcNow)
            return BadRequest(ApiResponse<object>.Fail("Token không hợp lệ hoặc đã hết hạn."));

        var user = resetToken.User;
        user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
        user.UpdatedAt = DateTime.Now;

        resetToken.IsUsed = true;

        // Revoke all existing refresh tokens for security.
        var refreshTokens = await _db.RefreshTokens
            .Where(rt => rt.UserId == user.Id && rt.RevokedAt == null)
            .ToListAsync();
        foreach (var rt in refreshTokens) rt.RevokedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        await WriteAuditAsync(user.Id, "auth.reset_password", "user", user.Id, null);

        return Ok(ApiResponse<object>.Ok(new { }, "Mật khẩu đã được đặt lại thành công."));
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

        // Effective permissions = role permissions + per-user grants - per-user denies.
        var permissions = await _permissionService.GetEffectivePermissionsAsync(user.Id);

        var expiresAt = DateTime.Now.AddMinutes(_jwtOptions.AccessTokenMinutes);
        var accessToken = _tokenService.CreateAccessToken(user, roles, permissions, expiresAt);

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

    private Task WriteAuditAsync(Guid actorId, string action, string? targetType, Guid? targetId, string? detail)
    {
        // Delegate to the shared audit service; pass the actor explicitly because during
        // login/register the request principal is not authenticated yet.
        return _audit.LogAsync(action, targetType, targetId, detail, actorId);
    }
}
