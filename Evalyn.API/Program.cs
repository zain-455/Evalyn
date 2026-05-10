using Evalyn.API.Data;
using Evalyn.API.Infrastructure;
using Evalyn.API.Models.Entities;
using Evalyn.API.Services;
using Evalyn.API.Services.Exams;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ── Database ────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Identity ────────────────────────────────────────────
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// ── JWT Authentication ──────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Missing configuration: Jwt:Key");
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Missing configuration: Jwt:Issuer");
var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Missing configuration: Jwt:Audience");

if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 bytes (256 bits) for HS256.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// ── Domain Services ─────────────────────────────────────
builder.Services.AddScoped<IExamService, ExamService>();
builder.Services.AddScoped<ITestSessionService, TestSessionService>();
builder.Services.AddSingleton<BehavioralAnalyzer>();
builder.Services.AddSingleton<AnomalyDetectionService>();
builder.Services.AddSingleton<CalibrationService>();
builder.Services.AddScoped<PsychometricService>();

// ── AI (Google Gemini) ────────────────────────────────
builder.Services.Configure<GeminiSettings>(builder.Configuration.GetSection("Gemini"));
builder.Services.AddHttpClient<IQuestionGenerationService, GeminiQuestionGenerationService>(client =>
{
    client.BaseAddress = new Uri("https://generativelanguage.googleapis.com/");
});

// ── CORS ────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ── IRT Engine ──────────────────────────────────────────
builder.Services.AddSingleton<IRTSettings>(builder.Configuration.GetSection("IRT").Get<IRTSettings>() ?? new IRTSettings());
builder.Services.AddSingleton<Evalyn.API.Services.IRTEngine>();

// ── Controllers ─────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
        // Back-compat for existing frontend error parsing (err.response.data.error)
        if (!context.ProblemDetails.Extensions.ContainsKey("error"))
            context.ProblemDetails.Extensions["error"] = context.ProblemDetails.Title;
    };
});

var app = builder.Build();

// ── Global Exception Handling (ProblemDetails) ──────────
app.UseExceptionHandler(exceptionApp =>
{
    exceptionApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;

        var isDev = app.Environment.IsDevelopment();

        var (statusCode, title, detail) = exception switch
        {
            ApiException apiEx => (apiEx.StatusCode, apiEx.Message, apiEx.Detail),
            ArgumentException argEx => (StatusCodes.Status400BadRequest, argEx.Message, null),
            System.ComponentModel.DataAnnotations.ValidationException valEx => (StatusCodes.Status400BadRequest, valEx.Message, null),
            InvalidOperationException invOp => (
                StatusCodes.Status500InternalServerError,
                isDev ? invOp.Message : "Server misconfiguration.",
                isDev ? invOp.ToString() : null),
            _ => (StatusCodes.Status500InternalServerError,
                "An unexpected error occurred.",
                isDev ? exception?.ToString() : null)
        };

        var problem = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail
        };

        problem.Extensions["traceId"] = context.TraceIdentifier;
        // Back-compat for existing frontend error parsing (err.response.data.error)
        problem.Extensions["error"] = title;

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(problem);
    });
});

// ── Middleware Pipeline ─────────────────────────────────
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ── Apply pending migrations on startup ────────────────
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

app.Run();
