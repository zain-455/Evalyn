using Evalyn.API.Constants;
using Evalyn.API.Models.DTOs;
using Evalyn.API.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace Evalyn.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private const string RefreshCookieName = "evalyn_refresh";

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _config;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IConfiguration config)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _config = config;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        // Validate role
        var validRoles = new[] { Roles.Admin, Roles.Instructor, Roles.Student };
        if (!validRoles.Contains(request.Role))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Role must be Admin, Instructor, or Student.");

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FullName = request.FullName,
            Role = request.Role,
            Institution = request.Institution,
            Identifier = request.Identifier,
            Section = request.Section ?? string.Empty
        };

        var result = await _userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
        {
            var details = new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["errors"] = result.Errors.Select(e => e.Description).ToArray()
            })
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Registration failed."
            };

            return BadRequest(details);
        }

        await IssueRefreshTokenAsync(user);
        var (token, expiry) = GenerateJwtToken(user);

        return Ok(new AuthResponse(token, user.Email!, user.FullName, user.Role, expiry));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid email or password.");

        var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: false);
        if (!result.Succeeded)
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid email or password.");

        await IssueRefreshTokenAsync(user);
        var (token, expiry) = GenerateJwtToken(user);

        return Ok(new AuthResponse(token, user.Email!, user.FullName, user.Role, expiry));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Refresh()
    {
        if (!Request.Cookies.TryGetValue(RefreshCookieName, out var refreshToken) || string.IsNullOrWhiteSpace(refreshToken))
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Refresh token missing.");

        var refreshHash = HashRefreshToken(refreshToken);

        var now = DateTime.UtcNow;
        var user = await _userManager.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u =>
                u.RefreshTokenHash == refreshHash &&
                u.RefreshTokenExpiresAt.HasValue &&
                u.RefreshTokenExpiresAt.Value > now);

        if (user == null)
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Refresh token invalid or expired.");

        // Rotate refresh token
        await IssueRefreshTokenAsync(user);

        var (token, expiry) = GenerateJwtToken(user);
        return Ok(new AuthResponse(token, user.Email!, user.FullName, user.Role, expiry));
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout()
    {
        // Best-effort: clear server-side refresh token even if access token is missing/expired.
        ApplicationUser? user = null;

        if (User?.Identity?.IsAuthenticated == true)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrWhiteSpace(userId))
                user = await _userManager.FindByIdAsync(userId);
        }

        if (user == null && Request.Cookies.TryGetValue(RefreshCookieName, out var refreshToken) && !string.IsNullOrWhiteSpace(refreshToken))
        {
            var refreshHash = HashRefreshToken(refreshToken);
            user = await _userManager.Users.FirstOrDefaultAsync(u => u.RefreshTokenHash == refreshHash);
        }

        if (user != null)
        {
            user.RefreshTokenHash = null;
            user.RefreshTokenExpiresAt = null;
            await _userManager.UpdateAsync(user);
        }

        Response.Cookies.Delete(RefreshCookieName, new CookieOptions
        {
            Path = "/api/auth",
            Secure = HttpContext.Request.IsHttps,
            SameSite = HttpContext.Request.IsHttps ? SameSiteMode.None : SameSiteMode.Lax
        });

        return Ok();
    }

    private (string token, DateTime expiresAt) GenerateJwtToken(ApplicationUser user)
    {
        var jwtKey = _config["Jwt:Key"]
            ?? throw new InvalidOperationException("Missing configuration: Jwt:Key");
        if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
            throw new InvalidOperationException("Jwt:Key must be at least 32 bytes (256 bits) for HS256.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email!),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var lifetime = GetAccessTokenLifetime();
        var expiresAt = DateTime.UtcNow.Add(lifetime);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? throw new InvalidOperationException("Missing configuration: Jwt:Issuer"),
            audience: _config["Jwt:Audience"] ?? throw new InvalidOperationException("Missing configuration: Jwt:Audience"),
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds
        );

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    private int GetTokenExpiryHours()
    {
        return int.TryParse(_config["Jwt:ExpiresInHours"], out int hours) ? hours : 24;
    }

    private TimeSpan GetAccessTokenLifetime()
    {
        if (int.TryParse(_config["Jwt:AccessTokenMinutes"], out var minutes) && minutes > 0)
            return TimeSpan.FromMinutes(minutes);

        return TimeSpan.FromHours(GetTokenExpiryHours());
    }

    private int GetRefreshTokenDays()
    {
        if (int.TryParse(_config["Jwt:RefreshTokenDays"], out var days) && days > 0)
            return days;
        return 7;
    }

    private async Task IssueRefreshTokenAsync(ApplicationUser user)
    {
        var rawToken = GenerateSecureToken(48);
        var hash = HashRefreshToken(rawToken);
        var expiresAt = DateTime.UtcNow.AddDays(GetRefreshTokenDays());

        // Ensure we update the tracked user entity
        var tracked = await _userManager.FindByIdAsync(user.Id);
        if (tracked == null)
            throw new InvalidOperationException("User not found.");

        tracked.RefreshTokenHash = hash;
        tracked.RefreshTokenExpiresAt = expiresAt;
        await _userManager.UpdateAsync(tracked);

        Response.Cookies.Append(RefreshCookieName, rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = HttpContext.Request.IsHttps,
            SameSite = HttpContext.Request.IsHttps ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = expiresAt,
            Path = "/api/auth"
        });
    }

    private static string GenerateSecureToken(int numBytes)
    {
        var bytes = RandomNumberGenerator.GetBytes(numBytes);
        return Base64UrlEncoder.Encode(bytes);
    }

    private static string HashRefreshToken(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(bytes);
        return Convert.ToBase64String(hash);
    }
}
