using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Evalyn.API.Models.Entities;

namespace Evalyn.API.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Exam> Exams => Set<Exam>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuestionOption> QuestionOptions => Set<QuestionOption>();
    public DbSet<QuestionDomainTag> QuestionDomainTags => Set<QuestionDomainTag>();
    public DbSet<ExamQuestionPoolItem> ExamQuestionPoolItems => Set<ExamQuestionPoolItem>();
    public DbSet<ExamPoolSettings> ExamPoolSettings => Set<ExamPoolSettings>();
    public DbSet<ExamPoolAllowedTag> ExamPoolAllowedTags => Set<ExamPoolAllowedTag>();
    public DbSet<TestSession> TestSessions => Set<TestSession>();
    public DbSet<Response> Responses => Set<Response>();
    public DbSet<BehavioralEvent> BehavioralEvents => Set<BehavioralEvent>();
    public DbSet<BehavioralFeatureVector> BehavioralFeatureVectors => Set<BehavioralFeatureVector>();
    public DbSet<ExamAudience> ExamAudiences => Set<ExamAudience>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // ── User ────────────────────────────────────────
        builder.Entity<ApplicationUser>(e =>
        {
            e.Property(u => u.FullName).HasMaxLength(200);
            e.Property(u => u.Role).HasMaxLength(50);
            e.Property(u => u.Section).HasMaxLength(100);
            e.HasIndex(u => u.Section);
        });

        // ── Exam ────────────────────────────────────────
        builder.Entity<Exam>(e =>
        {
            var utcNullableDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
                v => v,
                v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : null);

            e.HasOne(x => x.CreatedBy)
             .WithMany(u => u.CreatedExams)
             .HasForeignKey(x => x.CreatedById)
             .OnDelete(DeleteBehavior.Restrict);

            e.Property(x => x.Title).HasMaxLength(300);
            e.Property(x => x.Status).HasMaxLength(50);
            e.HasIndex(x => x.Status);

            e.Property(x => x.StartsAtUtc).HasConversion(utcNullableDateTimeConverter);
            e.Property(x => x.EndsAtUtc).HasConversion(utcNullableDateTimeConverter);

            e.HasOne(x => x.PoolSettings)
             .WithOne(s => s.Exam)
             .HasForeignKey<ExamPoolSettings>(s => s.ExamId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── ExamQuestionPoolItem (many-to-many link) ─────
        builder.Entity<ExamQuestionPoolItem>(e =>
        {
            e.HasKey(x => new { x.ExamId, x.QuestionId });

            e.HasOne(x => x.Exam)
             .WithMany(ex => ex.QuestionPoolItems)
             .HasForeignKey(x => x.ExamId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Question)
             .WithMany()
             .HasForeignKey(x => x.QuestionId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(x => x.ExamId);
            e.HasIndex(x => x.QuestionId);
            e.HasIndex(x => new { x.ExamId, x.FixedFormOrder });
        });

        // ── ExamPoolSettings ────────────────────────────
        builder.Entity<ExamPoolSettings>(e =>
        {
            e.HasKey(x => x.ExamId);
        });

        // ── ExamPoolAllowedTag ──────────────────────────
        builder.Entity<ExamPoolAllowedTag>(e =>
        {
            e.HasOne(x => x.PoolSettings)
             .WithMany(s => s.AllowedTags)
             .HasForeignKey(x => x.ExamId)
             .OnDelete(DeleteBehavior.Cascade);

            e.Property(x => x.DomainName).HasMaxLength(100);
            e.Property(x => x.SubDomain).HasMaxLength(100);
            e.HasIndex(x => new { x.ExamId, x.DomainName, x.SubDomain });
        });

        // ── Question ────────────────────────────────────
        builder.Entity<Question>(e =>
        {
            e.HasOne(q => q.Exam)
             .WithMany(ex => ex.Questions)
             .HasForeignKey(q => q.ExamId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne<ApplicationUser>()
             .WithMany()
             .HasForeignKey(q => q.CreatedById)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.Restrict);

            e.Property(q => q.QuestionType).HasMaxLength(20);
            e.Property(q => q.DifficultyLabel).HasMaxLength(20);
            e.HasIndex(q => q.ExamId);
            e.HasIndex(q => q.CreatedById);
            e.HasIndex(q => new { q.ExamId, q.FixedFormOrder });
        });

        // ── QuestionOption ──────────────────────────────
        builder.Entity<QuestionOption>(e =>
        {
            e.HasOne(o => o.Question)
             .WithMany(q => q.Options)
             .HasForeignKey(o => o.QuestionId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(o => o.QuestionId);
        });

        // ── QuestionDomainTag ───────────────────────────
        builder.Entity<QuestionDomainTag>(e =>
        {
            e.HasOne(t => t.Question)
             .WithMany(q => q.DomainTags)
             .HasForeignKey(t => t.QuestionId)
             .OnDelete(DeleteBehavior.Cascade);

            e.Property(t => t.DomainName).HasMaxLength(100);
            e.Property(t => t.SubDomain).HasMaxLength(100);
            e.HasIndex(t => new { t.QuestionId, t.DomainName });
        });

        // ── TestSession ─────────────────────────────────
        builder.Entity<TestSession>(e =>
        {
            e.HasOne(s => s.User)
             .WithMany(u => u.TestSessions)
             .HasForeignKey(s => s.UserId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(s => s.Exam)
             .WithMany(ex => ex.TestSessions)
             .HasForeignKey(s => s.ExamId)
             .OnDelete(DeleteBehavior.Restrict);

            e.Property(s => s.Status).HasMaxLength(50);
            e.Property(s => s.IntegrityLabel).HasMaxLength(20);
            e.HasIndex(s => new { s.UserId, s.ExamId });

            e.HasOne(s => s.BehavioralFeatureVector)
             .WithOne(f => f.TestSession)
             .HasForeignKey<BehavioralFeatureVector>(f => f.TestSessionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── BehavioralFeatureVector (7D features) ───────
        builder.Entity<BehavioralFeatureVector>(e =>
        {
            e.HasKey(x => x.TestSessionId);
            e.HasIndex(x => x.ComputedAt);
        });

        // ── Response ────────────────────────────────────
        builder.Entity<Response>(e =>
        {
            e.HasOne(r => r.TestSession)
             .WithMany(s => s.Responses)
             .HasForeignKey(r => r.TestSessionId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(r => r.Question)
             .WithMany(q => q.Responses)
             .HasForeignKey(r => r.QuestionId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(r => r.SelectedOption)
             .WithMany()
             .HasForeignKey(r => r.SelectedOptionId)
             .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(r => r.TestSessionId);
        });

        // ── BehavioralEvent ─────────────────────────────
        builder.Entity<BehavioralEvent>(e =>
        {
            e.HasOne(b => b.TestSession)
             .WithMany(s => s.BehavioralEvents)
             .HasForeignKey(b => b.TestSessionId)
             .OnDelete(DeleteBehavior.Cascade);

            e.Property(b => b.EventType).HasMaxLength(50);
            e.HasIndex(b => new { b.TestSessionId, b.EventType });
        });

        // ── ExamAudience ────────────────────────────────
        builder.Entity<ExamAudience>(e =>
        {
            e.HasOne(x => x.Exam)
             .WithMany(ex => ex.Audiences)
             .HasForeignKey(x => x.ExamId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Student)
             .WithMany()
             .HasForeignKey(x => x.StudentId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.Restrict);

            e.Property(x => x.Section).HasMaxLength(100);
            e.HasIndex(x => x.ExamId);
            e.HasIndex(x => x.Section);
            e.HasIndex(x => x.StudentId);
        });
    }
}
