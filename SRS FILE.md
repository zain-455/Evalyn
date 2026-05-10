# Software Requirements Specification (SRS)
## Evalyn â€” Intelligent Adaptive Assessment & Behavioral Integrity Platform

| Field | Value |
|---|---|
| **Document Version** | 3.0 (Final) |
| **Date** | 2026-05-09 |
| **Project** | Final Year Project (FYP) |
| **Author** | zain-455 |
| **Status** | Complete |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [User Roles & Personas](#3-user-roles--personas)
4. [Functional Requirements â€” Authentication & Authorization](#4-functional-requirements--authentication--authorization)
5. [Functional Requirements â€” Exam Management](#5-functional-requirements--exam-management)
6. [Functional Requirements â€” Question Bank & AI Generation](#6-functional-requirements--question-bank--ai-generation)
7. [Functional Requirements â€” Adaptive Test Engine (IRT)](#7-functional-requirements--adaptive-test-engine-irt)
8. [Functional Requirements â€” Behavioral Telemetry & Integrity](#8-functional-requirements--behavioral-telemetry--integrity)
9. [Functional Requirements â€” Psychometric Analytics](#9-functional-requirements--psychometric-analytics)
10. [Functional Requirements â€” Calibration Pipeline](#10-functional-requirements--calibration-pipeline)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [System Architecture](#12-system-architecture)
13. [Data Model & Database Schema](#13-data-model--database-schema)
14. [API Reference](#14-api-reference)
15. [Frontend Routes & UI Screens](#15-frontend-routes--ui-screens)
16. [Security Design](#16-security-design)
17. [Third-Party Integrations](#17-third-party-integrations)
18. [Constraints & Assumptions](#18-constraints--assumptions)
19. [Risks & Mitigations](#19-risks--mitigations)
20. [Weaknesses & Critical Improvement Areas](#20-weaknesses--critical-improvement-areas)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) document provides an exhaustive, authoritative description of the **Evalyn** platform â€” a full-stack, AI-enhanced, psychometrically-grounded online examination system built as a Final Year Project (FYP). It documents every functional requirement, every non-functional constraint, the complete data model, all API endpoints, frontend routing, security architecture, third-party integrations, and known weaknesses.

This document supersedes all prior PRD/SRS drafts. It is intended for:
- FYP examiners and supervisors evaluating system scope and rigor
- Developers extending or maintaining the system
- Testers designing test plans

### 1.2 Scope

Evalyn is a web-based adaptive examination platform offering:

1. **Adaptive Testing** using Item Response Theory (IRT) â€” questions are selected in real-time based on the student's estimated ability (Î¸), maximizing measurement precision while minimizing the number of questions needed.
2. **Behavioral Integrity Monitoring** â€” passive, webcam-free proctoring using browser-level telemetry (tab switches, copy-paste, idle gaps, mouse entropy, timing patterns), a 7-dimensional feature vector, rule-based scoring, and an ML-powered anomaly detection layer (ML.NET Randomized PCA).
3. **AI-Assisted Question Authoring** â€” Google Gemini 1.5 Flash generates exam-ready MCQs with psychometric parameter suggestions (difficulty, discrimination) and domain tagging from a natural-language topic prompt.
4. **Psychometric Analytics Dashboards** â€” instructors see item analysis (p-value, point-biserial, distractor analysis), Test Information Function (TIF) curves, reliability metrics (Cronbach's Alpha, Adaptive Marginal Reliability), and integrity histograms. Students see their ability estimate (Î¸), Standard Error of Measurement (SEM), 95% confidence interval, percentile rank, and domain radar chart.
5. **IRT Calibration Pipeline** â€” a Joint Maximum Likelihood Estimation (JMLE) engine updates item parameters (difficulty b, discrimination a) from accumulated real response data, using Newton-Raphson optimization with weak Bayesian priors.

### 1.3 Definitions & Acronyms

| Term | Definition |
|---|---|
| **IRT** | Item Response Theory â€” a psychometric framework modelling the relationship between a latent ability trait (Î¸) and the probability of a correct response |
| **Î¸ (theta)** | Latent ability estimate for a student; ranges [-4, +4] |
| **b parameter** | IRT item difficulty; the Î¸ level at which a student has 50% probability of answering correctly |
| **a parameter** | IRT item discrimination; measures how well an item differentiates students of different ability levels |
| **MAP** | Maximum A Posteriori â€” Bayesian theta estimation used for the first â‰¤5 responses |
| **MLE** | Maximum Likelihood Estimation â€” theta estimation used after 5+ responses |
| **CAT** | Computerized Adaptive Test |
| **TIF** | Test Information Function â€” sum of Fisher Information across all items at a given Î¸ level |
| **SEM** | Standard Error of Measurement â€” 1/âˆšTIF(Î¸) |
| **PCA** | Principal Component Analysis |
| **JMLE** | Joint Maximum Likelihood Estimation â€” calibration approach fixing Î¸ values to estimate item parameters |
| **JWT** | JSON Web Token |
| **RBAC** | Role-Based Access Control |
| **MCQ** | Multiple Choice Question |
| **p-value** | Item facility index â€” proportion of students answering correctly |
| **Point-Biserial** | Correlation between dichotomous item score and total ability score |
| **Cronbach's Î±** | Internal consistency reliability coefficient for fixed-form tests |
| **CORS** | Cross-Origin Resource Sharing |

### 1.4 References

- Lord, F.M. (1980). *Applications of Item Response Theory to Practical Testing Problems.* Erlbaum.
- Embretson & Reise (2000). *Item Response Theory for Psychologists.*
- Microsoft ML.NET Documentation â€” Randomized PCA Anomaly Detection
- Google Gemini API Documentation â€” `gemini-1.5-flash` model
- ASP.NET Core 10 Identity & JWT Bearer Documentation
- React Router v6 Documentation

---

## 2. Overall Description

### 2.1 Product Perspective

Evalyn is a **standalone web application** with a decoupled frontend-backend architecture:

- **Backend**: ASP.NET Core 10 Web API (`Evalyn.API`) running on .NET 10.0
- **Frontend**: React 18 SPA (`evalyn-client`) built with Vite 6
- **Database**: Microsoft SQL Server (via Entity Framework Core 10 with Code-First migrations)
- **AI Layer**: Google Gemini 1.5 Flash (REST API via `HttpClient`)
- **ML Layer**: ML.NET 4.0.2 (in-process, per-exam Randomized PCA models)

The two tiers communicate over a REST/JSON API with JWT Bearer authentication. The frontend runs on `http://localhost:5173` during development; the API runs on `https://localhost:7xxx`. CORS is configured to permit credentials from the frontend origin.

### 2.2 Product Functions (High-Level Summary)

| # | Function | Description |
|---|---|---|
| F-01 | Registration & Login | JWT + Refresh Token auth with role-based access |
| F-02 | Exam Creation | Instructors define exams (adaptive or fixed-form), with scheduling and audience targeting |
| F-03 | Question Management | CRUD for questions with IRT params, options, domain tags |
| F-04 | Question Bank | Global bank of reusable questions; attach to any exam via pool |
| F-05 | AI Question Generation | Gemini-powered MCQ generation from a topic prompt |
| F-06 | Exam Pool Configuration | Filter pool by difficulty range, tags, calibration status |
| F-07 | Adaptive Test Delivery | Real-time CAT using Fisher Information maximization + MAP/MLE Î¸ estimation |
| F-08 | Fixed-Form Test Delivery | Sequential delivery with pre-defined question order |
| F-09 | Behavioral Telemetry | Passive capture of 8 event types; 7D feature vector extraction |
| F-10 | Integrity Scoring | Rule-based multi-signal scoring (0â€“100) with label (High/Medium/Low) |
| F-11 | ML Anomaly Detection | Unsupervised Randomized PCA model per exam; blended integrity score |
| F-12 | Item Calibration | JMLE Newton-Raphson re-estimation of b and a from response data |
| F-13 | Exam Analytics | Per-exam item analysis, TIF, reliability, integrity histogram |
| F-14 | Student Performance | Î¸ trajectory, domain radar, SEM, CI, percentile |
| F-15 | Instructor Dashboard | Aggregate stats, flagged sessions, distribution charts |
| F-16 | Student Management | Instructor views enrolled students and their session summaries |

### 2.3 Operating Environment

| Component | Technology |
|---|---|
| Backend Runtime | .NET 10.0 (ASP.NET Core Web API) |
| Frontend Runtime | React 18.3 + Vite 6 |
| Database | Microsoft SQL Server (local development: ZAIN-PC instance) |
| ORM | Entity Framework Core 10 (Code-First, Migrations) |
| Auth | ASP.NET Core Identity + JWT Bearer (HS256, 15-min access token, 7-day refresh token) |
| AI | Google Gemini 1.5 Flash via REST (generativelanguage.googleapis.com) |
| ML | ML.NET 4.0.2 â€” Randomized PCA AnomalyDetection trainer |
| State Management | TanStack React Query v5 |
| HTTP Client (FE) | Axios 1.7 |
| Charts | Recharts 2.13 |
| Date Handling | date-fns 4.1, flatpickr 4.6 |
| Routing (FE) | React Router DOM v6 |

### 2.4 Design & Implementation Constraints

- The system must operate entirely without webcam or audio capture.
- The ML model requires a **cold-start minimum of 20 completed sessions** per exam before anomaly scoring activates.
- Item calibration requires a **minimum of 30 responses** per question before JMLE estimation is attempted.
- Theta is clamped to the range **[-4.0, +4.0]** at all times.
- The AI generation service is dependent on an external third-party API (Google Gemini); failures must degrade gracefully.
- JWT access tokens expire in **15 minutes**; refresh tokens expire in **7 days** and rotate on each use.

---

## 3. User Roles & Personas

### 3.1 Role Hierarchy

```
Admin
  â””â”€â”€ Instructor
        â””â”€â”€ Student
```

Roles are stored as a plain string in `ApplicationUser.Role` and in JWT claims (`ClaimTypes.Role`). ASP.NET Core Identity is used for password hashing, user storage, and sign-in management. Authorization is enforced at both API controller and route level.

### 3.2 Student

**Profile**: An enrolled learner taking assessments.

**Capabilities**:
- Register and log in
- View assigned/available exams (filtered by section or individual assignment)
- Start an adaptive or fixed-form exam session
- Answer one question at a time; receive immediate next question
- View exam result after completion: score, Î¸, SEM, CI, percentile, domain skill map, integrity flags
- View performance page: Î¸ history chart, domain radar chart, cohort comparison
- View assessment history: list of all past sessions with status and scores

**Restrictions**:
- Cannot access instructor or admin pages
- Cannot see correct answers for questions before attempting
- Cannot retake an exam that already has a completed session

### 3.3 Instructor

**Profile**: An educator who creates and manages assessments.

**Capabilities**:
- Register and log in
- Create, edit, publish, and archive exams
- Add questions manually to an exam (with full IRT parameter control)
- Generate questions via AI (Gemini) with topic/difficulty/count parameters
- Manage a global Question Bank of reusable questions
- Attach Question Bank items to exams via pool configuration
- Configure exam pool: difficulty range filters, tag filters, calibration requirement
- Publish/archive exams; set start/end scheduling windows
- Target exams to specific sections, multiple sections, or individual students
- View per-exam analytics: item analysis, TIF, reliability, student results table, integrity histogram
- View instructor dashboard: aggregate stats, flagged sessions, distributions
- View and manage enrolled students; see student assessment summaries
- Trigger item calibration for eligible questions
- View AI-generated questions before saving them to the bank

**Restrictions**:
- Can only edit/delete their own exams and questions
- Cannot modify pool settings on a Published exam (Admin override exists)

### 3.4 Admin

**Profile**: A platform administrator with full system access.

**Capabilities**:
- All Instructor capabilities
- Access platform-level overview analytics (total users, exams, sessions, global integrity stats)
- Override exam status on Published exams
- Attach questions to any exam regardless of ownership
- Access all student data across all instructors

---

---

## 4. Functional Requirements — Authentication & Authorization

### 4.1 Overview

Authentication is handled via **ASP.NET Core Identity** for user management and **JWT Bearer** tokens for stateless API authentication. A two-token scheme is used: a short-lived **access token** (15 minutes, sent in Authorization header) and a long-lived **refresh token** (7 days, stored in an `HttpOnly` cookie named `evalyn_refresh`).

### 4.2 Registration (FR-AUTH-01)

**Endpoint**: `POST /api/auth/register`

**Request Fields**:

| Field | Type | Validation | Description |
|---|---|---|---|
| `Email` | string | Required, valid email, max 256 chars | Unique user identifier |
| `Password` | string | Required, min 6 chars, must contain digit + uppercase + lowercase | Hashed via ASP.NET Identity (PBKDF2) |
| `FullName` | string | Required, 2–120 chars | Display name |
| `Institution` | string | Required, 2–120 chars | University or organization |
| `Identifier` | string | Required, 2–80 chars | Student ID or employee number |
| `Role` | string | Must be "Student", "Instructor", or "Admin" | Role assignment |
| `Section` | string? | Optional, max 30 chars | Used for exam audience targeting |

**Password Policy** (enforced by ASP.NET Identity):
- Minimum length: 6
- Requires digit: true
- Requires uppercase: true
- Requires lowercase: true
- Requires non-alphanumeric: false
- Unique email enforced: true

**Response (200 OK)**:
```json
{
  "token": "<JWT access token>",
  "email": "user@example.com",
  "fullName": "John Doe",
  "role": "Student",
  "expiresAt": "2026-05-09T16:30:00Z"
}
```

**On registration success**: A refresh token is automatically issued (stored in `evalyn_refresh` HttpOnly cookie), and a JWT access token is returned in the response body.

**Error Cases**:
- `400` — Email already in use, password too weak, invalid role, missing required fields

### 4.3 Login (FR-AUTH-02)

**Endpoint**: `POST /api/auth/login`

**Request Fields**:

| Field | Type | Validation |
|---|---|---|
| `Email` | string | Required, valid email |
| `Password` | string | Required, min 6 chars |

**Behavior**: Uses `SignInManager.CheckPasswordSignInAsync` (no account lockout in current version). On success, rotates refresh token and issues new access token.

**Error Cases**:
- `401` — Invalid email or password (generic message to prevent user enumeration)

### 4.4 Token Refresh (FR-AUTH-03)

**Endpoint**: `POST /api/auth/refresh`

**Behavior**:
- Reads `evalyn_refresh` cookie from the HTTP request
- Computes SHA-256 hash of the raw token
- Queries the database for a user with a matching `RefreshTokenHash` and non-expired `RefreshTokenExpiresAt`
- If found: rotates refresh token (new raw token stored in cookie, old hash overwritten) and returns new access token
- If not found or expired: returns `401`

**Token Rotation**: Every refresh call invalidates the previous refresh token. This prevents refresh token reuse attacks.

### 4.5 Logout (FR-AUTH-04)

**Endpoint**: `POST /api/auth/logout`

**Behavior**:
- Attempts to identify the user via access token or refresh token cookie (best-effort)
- If identified: clears `RefreshTokenHash` and `RefreshTokenExpiresAt` in the database
- Deletes the `evalyn_refresh` cookie
- Returns `200 OK` regardless (idempotent)

### 4.6 JWT Token Structure

**Algorithm**: HMAC-SHA256 (HS256)
**Key minimum length**: 32 bytes (256 bits) — enforced at startup
**Access token lifetime**: 15 minutes (configurable via `Jwt:AccessTokenMinutes`)
**Refresh token lifetime**: 7 days (configurable via `Jwt:RefreshTokenDays`)

**Claims included**:
- `ClaimTypes.NameIdentifier` — user GUID (ASP.NET Identity Id)
- `ClaimTypes.Email` — user email
- `ClaimTypes.Name` — full name
- `ClaimTypes.Role` — "Student" / "Instructor" / "Admin"
- `jti` — unique token identifier (UUID v4)

**Clock skew**: Zero (enforced via `ClockSkew = TimeSpan.Zero`)

### 4.7 Role-Based Access Control (FR-AUTH-05)

| Resource | Student | Instructor | Admin |
|---|---|---|---|
| Take exam | ? | ? | ? |
| View own results | ? | ? | ? |
| Create/edit exams | ? | ? (own only) | ? (any) |
| Manage questions | ? | ? (own only) | ? (any) |
| View exam analytics | ? | ? (own exams) | ? (all) |
| View student management | ? | ? | ? |
| Platform overview | ? | ? | ? |
| Calibrate questions | ? | ? | ? |
| Attach any bank question | ? | ? (own + global) | ? (any) |

---

## 5. Functional Requirements — Exam Management

### 5.1 Create Exam (FR-EXAM-01)

**Endpoint**: `POST /api/exams`
**Access**: Instructor, Admin

**Request Fields**:

| Field | Type | Validation | Default |
|---|---|---|---|
| `Title` | string | Required, 3–160 chars | — |
| `Description` | string? | Optional, max 2000 chars | null |
| `DurationMinutes` | int | 1–1440 | — |
| `IsAdaptive` | bool | — | true |
| `MaxQuestions` | int | 1–500 | — |
| `AudienceType` | string | "SECTION", "MULTI_SECTION", or "INDIVIDUAL" | "SECTION" |
| `Sections` | List<string>? | Optional — section identifiers | null |
| `StudentIds` | List<string>? | Optional — specific student GUIDs for INDIVIDUAL type | null |
| `StartsAtUtc` | DateTime? | Optional scheduling window start | null |
| `EndsAtUtc` | DateTime? | Optional scheduling window end | null |

**Exam Statuses**: `Draft` ? `Published` ? `Archived`

**Audience Types**:
- `SECTION` — exam visible to all students in one section
- `MULTI_SECTION` — exam visible to students across multiple named sections
- `INDIVIDUAL` — exam targeted to a specific list of student IDs

### 5.2 List Exams (FR-EXAM-02)

**Endpoint**: `GET /api/exams`
**Access**: Instructor/Admin (own exams), Student (visible exams)

For **students**: returns `StudentExamListResponse` including session state fields:
- `SessionId`, `SessionStatus`, `SessionStartedAt`, `TotalCorrect`, `TotalQuestions`, `PercentileRank`, `CompletedAt`

This allows the student Assessments page to categorize exams as: **Available** (no session), **Completed** (session status = Completed), or **In Progress**.

For **instructors**: returns `ExamListResponse` with exam metadata and question counts.

### 5.3 Exam Lifecycle (FR-EXAM-03)

| Transition | Endpoint | Description |
|---|---|---|
| Draft ? Published | `PUT /api/exams/{id}/publish` | Makes exam visible to students |
| Published ? Archived | `PUT /api/exams/{id}/archive` | Hides exam from students |
| Any ? Deleted | `DELETE /api/exams/{id}` | Hard delete (Instructor only, own exams) |

**Constraints**:
- Cannot modify pool settings on a Published exam (Admin can override)
- Cannot attach/detach bank questions on a Published exam (Admin can override)

### 5.4 Exam Audience Targeting (FR-EXAM-04)

The `ExamAudience` table stores the mapping between exams and their target audience. Each record contains:

| Column | Description |
|---|---|
| `ExamId` | Foreign key to Exam |
| `Section` | Section name (for SECTION / MULTI_SECTION) |
| `StudentId` | Foreign key to ApplicationUser (for INDIVIDUAL) |
| `AudienceType` | "SECTION", "MULTI_SECTION", or "INDIVIDUAL" |

When a student calls `GET /api/exams`, the API filters exams where the student's `Section` matches a `Section` audience record, **OR** the student's `Id` matches a `StudentId` audience record.

### 5.5 Exam Pool Configuration (FR-EXAM-05)

**Purpose**: Configure which questions from the global Question Bank are eligible for inclusion in this exam's adaptive pool.

**Endpoint**: `GET/PUT /api/exams/{examId}/pool`

**Pool Settings** (`ExamPoolSettings` entity):

| Field | Type | Default | Description |
|---|---|---|---|
| `AllowAIGenerated` | bool | true | Include AI-generated questions in pool |
| `RequireCalibrated` | bool | false | Restrict to calibrated questions only |
| `MinDifficulty` | double | -4.0 | Lower bound on IRT b parameter |
| `MaxDifficulty` | double | 4.0 | Upper bound on IRT b parameter |
| `AllowedTags` | List<ExamPoolAllowedTag> | [] | Restrict to questions with matching domain/subdomain tags |

**Attaching Bank Questions**:
- `POST /api/exams/{examId}/pool/attach` — attach specific question IDs from the global bank
- `DELETE /api/exams/{examId}/pool/attach/{questionId}` — detach a specific question

**Effective Pool**: Computed by `ExamPoolCalculator.BuildEffectivePool(exam)` which unions the exam's own questions with bank-attached questions, applying all pool setting filters.

---

## 6. Functional Requirements — Question Bank & AI Generation

### 6.1 Question Types Supported

| Type | Min Options | Description |
|---|---|---|
| `MCQ` | 2 (typically 4) | Standard multiple choice with one correct answer |
| `True / False` | 2 | Exactly two options: "True" and "False" |
| `Short answer` | 1 | Single option containing the correct answer text |

### 6.2 Question Fields

| Field | Type | Validation | Description |
|---|---|---|---|
| `QuestionText` | string | Required, 5–5000 chars | The question stem |
| `QuestionType` | string | Required, max 30 chars | MCQ / True / False / Short answer |
| `IRT_Difficulty` | double | -4.0 to 4.0 | IRT b parameter (logit scale) |
| `IRT_Discrimination` | double | 0.2 to 3.0 | IRT a parameter |
| `DifficultyLabel` | string | Easy / Medium / Hard | Human-readable label |
| `IsAIGenerated` | bool | — | True if created by Gemini AI |
| `IsCalibrated` | bool | — | True after JMLE calibration from real data |
| `TimesAdministered` | int | — | Total response count |
| `TimesCorrect` | int | — | Correct response count |
| `Options` | List<QuestionOption> | 1–10 items, exactly 1 correct | Answer choices |
| `DomainTags` | List<QuestionDomainTag> | Optional | Domain/subdomain taxonomy tags |

**IRT Seeding Logic**: If an instructor creates a question with placeholder IRT values (difficulty=0, discrimination=1.0), the system automatically seeds from the difficulty label:
- Easy ? b=-1.5, a=0.9
- Hard ? b=1.5, a=1.1
- Medium ? b=0.0, a=1.0

### 6.3 Exam-Owned Questions (FR-QUEST-01)

Questions with `ExamId != null` belong to a specific exam. These are CRUD-managed via:

- `GET /api/exams/{examId}/questions` — list all questions for an exam
- `POST /api/exams/{examId}/questions` — add a question to an exam
- `PUT /api/exams/{examId}/questions/{id}` — update a question
- `DELETE /api/exams/{examId}/questions/{id}` — delete a question

**Fixed-form ordering**: Each question has a `FixedFormOrder` integer. In fixed-form exams, questions are presented in this order. Auto-assigned on creation as max(existing)+1.

**Adaptive ordering**: In adaptive mode, questions are listed by `IRT_Difficulty` ascending for display purposes; actual delivery order is determined by the IRT engine.

### 6.4 Global Question Bank (FR-QUEST-02)

Questions with `ExamId == null` belong to the global question bank. They are created by instructors and identified by `CreatedById`.

**Endpoint**: `GET /api/questionbank` — returns all bank questions owned by the requesting instructor (plus system/legacy global questions where `CreatedById == null`).

Instructors can add any global bank question to any of their exams' pools via the attach endpoint.

### 6.5 AI Question Generation (FR-AI-01)

**Endpoint**: `POST /api/ai/generate-questions`
**Access**: Instructor, Admin

**Request**:

| Field | Type | Validation | Default |
|---|---|---|---|
| `Topic` | string | Required, 3–200 chars | — |
| `Difficulty` | string | "easy", "medium", "hard", "mixed" | "medium" |
| `Count` | int | 1–10 | 5 |
| `Domain` | string? | Optional — domain name for tagging | null |
| `SubDomain` | string? | Optional — sub-domain for tagging | null |
| `QuestionType` | string? | "MCQ", "True / False", "Short answer" | "MCQ" |

**AI Provider**: Google Gemini 1.5 Flash via `generativelanguage.googleapis.com`

**System Prompt Enforcement**:
- Returns ONLY valid JSON arrays (no markdown, no code fences)
- Each object must contain: `questionText`, `options[]` (with `text` and `isCorrect`), `suggestedDifficulty` (-3 to 3), `suggestedDiscrimination` (0.5 to 2.5), optional `domainTags[]`

**Server-Side Validation** (`QuestionGenerationJson.ParseQuestionsJson`):
- Verifies JSON array structure
- Verifies each question has at least one option
- Enforces exactly-one correct answer (auto-fixes multi-correct by keeping first)
- Clamps difficulty to [-4, 4] and discrimination to [0.2, 3.0]
- Strips any code fences if Gemini adds them despite instructions

**Difficulty Instructions by Level**:
- `easy` — skew suggestedDifficulty toward lower values
- `hard` — skew toward higher values
- `mixed` — balanced distribution (~? each)
- `medium` — cluster around zero

**AI generation does NOT automatically save questions**. The instructor reviews each generated question in the UI and explicitly saves the ones they approve to the question bank or exam.

### 6.6 Question Bank Management UI (FR-QUEST-03)

The `QuestionBank.jsx` page allows instructors to:
- View all their global bank questions with IRT parameters, difficulty labels, and domain tags
- Create new bank questions manually
- Edit existing questions
- Delete questions (with confirmation modal)
- Filter by difficulty label, domain, and calibration status
- Launch AI generation flow from the same page


---

## 7. Functional Requirements — Adaptive Test Engine (IRT)

### 7.1 Overview

Evalyn implements a **2-Parameter Logistic (2PL) Item Response Theory** model for computerized adaptive testing. The engine selects the optimal next question based on Fisher Information maximization at the student's current ability estimate (?), and updates ? after each response using MAP (first =5 responses) or MLE (6+ responses) via Newton-Raphson optimization.

### 7.2 IRT Model — Probability Function

The probability of a correct response is modeled by the 2PL logistic function:

```
P(? | a, b) = 1 / (1 + exp(-a(? - b)))
```

Where:
- `?` = student ability estimate (latent trait, range: [-4, +4])
- `a` = discrimination parameter (range: [0.2, 3.0])
- `b` = difficulty parameter (range: [-4.0, +4.0])

**Numerical stability guards** (implemented in `IRTEngine.ProbCorrect`):
- If `z = a(? - b) > 35` ? return 1.0 (prevent exp overflow)
- If `z < -35` ? return 0.0

### 7.3 Fisher Information

```
I(?) = a² × P(?) × (1 - P(?))
```

Used for:
1. **Question selection** — maximize information at current ?
2. **SEM calculation** — SEM(?) = 1 / vS I_i(?)
3. **TIF computation** — sum of all item information functions across the pool

### 7.4 Theta Estimation (FR-IRT-01)

**Phase 1 — MAP (Maximum A Posteriori)**: Used when `responses.Count <= MapThreshold` (default: 5)

Applies a Gaussian prior `? ~ N(0, 1)` to regularize early estimates:
```
First derivative:  S a_i(u_i - P_i) - (? - 0) / 1.0
Second derivative: -S a_i² P_i(1-P_i) - 1.0
```

**Phase 2 — MLE (Maximum Likelihood)**: Used after 5+ responses (no prior applied).

**Algorithm**: Newton-Raphson iteration (max 25 iterations, tolerance 0.001):
```
?_new = ?_old - (L'(?) / L''(?))
```

**Edge case handling**:
- All correct ? ? = max(b_i) + 0.5 (bounded by ThetaMax=4.0)
- All wrong ? ? = min(b_i) - 0.5 (bounded by ThetaMin=-4.0)
- Singular Hessian (|L''| < 1e-10) ? return previous ? (no update)

**Step-size damping**: If |??| > MaxStepSize (default 1.0), clamp the step:
```
?_new = ?_old + sign(??) × MaxStepSize
```

**Theta bounds**: Always clamped to [ThetaMin, ThetaMax] = [-4.0, +4.0]

### 7.5 IRT Configuration (IRTSettings)

| Setting | Default | Description |
|---|---|---|
| `ThetaMin` | -4.0 | Lower bound for theta |
| `ThetaMax` | 4.0 | Upper bound for theta |
| `MaxStepSize` | 1.0 | Maximum theta update per response |
| `MapThreshold` | 5 | Responses before switching to MLE |
| `PriorMean` | 0.0 | Prior mean for MAP estimation |
| `PriorSd` | 1.0 | Prior standard deviation |
| `ExposureTopK` | 3 | Top-K candidates for random selection |

### 7.6 Question Selection Algorithm (FR-IRT-02)

1. Filter out already-answered questions (`answeredIds` HashSet)
2. Filter out questions with `IRT_Discrimination <= 0` (invalid)
3. **Prefer calibrated questions**: if any `IsCalibrated == true` exist in the pool, restrict to those
4. Compute Fisher Information at current ? for each remaining candidate
5. Rank by descending information
6. Take top-K candidates (K = `ExposureTopK` = 3) — randomization within top-K prevents item over-exposure
7. Return one randomly selected question from the top-K

### 7.7 SEM Calculation (FR-IRT-03)

After each response:
```
SEM = 1 / v(S a_i² × P_i × (1-P_i))
```

If total information < 1e-10 (no valid information), SEM defaults to `PriorSd` (1.0).

The SEM is stored in `TestSession.ThetaSEM` and used to compute the 95% confidence interval:
```
CI = [? - 1.96×SEM, ? + 1.96×SEM]
```

### 7.8 Percentile Mapping (FR-IRT-04)

Theta is mapped to a percentile using the standard normal CDF:
```
Percentile = 100 × F(?) = 100 × 0.5 × (1 + erf(? / v2))
```

The `erf` function is approximated using Abramowitz & Stegun's polynomial approximation (max error < 1.5×10?7).

### 7.9 Test Session Flow (FR-IRT-05)

```
Student calls POST /api/testsessions/start/{examId}
  ? Creates TestSession (Status=InProgress, ThetaEstimate=0.0)
  ? Selects first question via IRTEngine
  ? Returns StartExamResponse with first QuestionDto

Student calls POST /api/testsessions/{sessionId}/answer  (per question)
  ? Validates session belongs to student
  ? Records Response (IsCorrect, TimeTakenMs, ThetaAtTime, QuestionOrder)
  ? Updates ThetaEstimate via IRTEngine.EstimateTheta
  ? Updates ThetaSEM
  ? Selects next question (or signals completion if MaxQuestions reached)
  ? Returns SubmitAnswerResponse{IsCorrect, CurrentTheta, NextQuestion, IsComplete}

When IsComplete == true OR MaxQuestions reached:
  ? Session Status ? Completed
  ? BehavioralAnalyzer.Analyze() called ? IntegrityResult computed
  ? AnomalyDetectionService.ScoreSessionAsync() called (if model available)
  ? If ML score available: BlendScores(ruleScore, mlScore) applied
  ? BehavioralFeatureVector saved to DB
  ? PercentileRank computed and stored
  ? AnomalyDetectionService.MaybeRetrainAsync() triggered
```

### 7.10 Fixed-Form Test Delivery (FR-IRT-06)

When `Exam.IsAdaptive == false`:
- Questions are delivered in `FixedFormOrder` sequence
- No IRT-based selection — next question is simply the next in order
- Theta is still estimated after each response (for score reporting)
- `MaxQuestions` is the total number of questions in the exam
- Cronbach's Alpha reliability is computed (not Adaptive Marginal Reliability)

### 7.11 Session Resume Logic (FR-IRT-07)

If a student calls `POST /api/testsessions/start/{examId}` and an `InProgress` session already exists:
- The system **resumes** the existing session (does not create a new one)
- Returns `IsResumed: true` in `StartExamResponse`
- Provides the next unanswered question based on existing responses
- Remaining time is calculated from `StartedAt + DurationMinutes - UtcNow`

---

## 8. Functional Requirements — Behavioral Telemetry & Integrity

### 8.1 Overview

Evalyn monitors student behavior during exams using **passive browser-level telemetry** — no webcam, microphone, or screen recording is required. The system captures 8 event types, extracts a 7-dimensional feature vector, applies a rule-based integrity scoring algorithm, and (when sufficient training data exists) overlays an ML anomaly score.

### 8.2 Behavioral Event Types (FR-BEH-01)

| Event Type | Description | EventData Fields |
|---|---|---|
| `TabSwitch` | Browser tab lost/gained focus via tab switch | `{ timestamp }` |
| `CopyPaste` | Paste event detected (Ctrl+V / right-click paste) | `{ type: "paste" }` |
| `RightClick` | Right-click context menu invoked | `{ x, y }` |
| `IdlePeriod` | Mouse/keyboard inactive for >60 seconds | `{ durationMs }` |
| `MouseMovement` | Periodic mouse movement summary | `{ angleEntropy, speed }` |
| `MouseMovementSummary` | Aggregated mouse entropy summary | `{ angleEntropy }` |
| `KeystrokePattern` | Keystroke timing summary | `{ intervals[] }` |
| `FocusLost` | Browser window focus lost (Alt+Tab, minimize, etc.) | `{ timestamp }` |

**Event logging endpoints**:
- `POST /api/testsessions/{sessionId}/events` — single event
- `POST /api/testsessions/{sessionId}/events/batch` — batch of events (reduces HTTP overhead)

### 8.3 7-Dimensional Feature Vector (FR-BEH-02)

Extracted by `BehavioralAnalyzer.ExtractFeatures()` upon session completion:

| Feature | Description | How Computed |
|---|---|---|
| `TabSwitchesPerMinute` | Rate of tab switches | Count / session duration in minutes |
| `PasteCount` | Total paste events | Count of `CopyPaste` events |
| `RightClickCount` | Total right-click events | Count of `RightClick` events |
| `IdleSeconds` | Total idle time | Sum of `durationMs` from `IdlePeriod` events / 1000 |
| `FocusLostCount` | Number of focus loss events | Count of `FocusLost` events |
| `TimingCv` | Coefficient of variation in response times | s(times) / µ(times) across all responses |
| `MouseAngleEntropy` | Average mouse trajectory randomness | Average `angleEntropy` across `MouseMovementSummary` events |

The feature vector is stored in `BehavioralFeatureVector` (1:1 with `TestSession`).

### 8.4 Rule-Based Integrity Scoring (FR-BEH-03)

**Base score**: 100.0 (starts at maximum)

Penalties are applied for each detected signal:

| Signal | Threshold | Penalty | Severity |
|---|---|---|---|
| `FastAnswers` | Answers < 3000ms | 8 pts each, max 30 pts | Medium (=3: High) |
| `UniformTiming` | Timing CV < 0.15 (bot-like) | 20 pts | High |
| `TabSwitches` | > 5 tab switches | 5 pts per extra, max 25 pts | Medium (>10: High) |
| `CopyPaste` | Any paste events | 15 pts each, max 30 pts | High |
| `IdlePeriods` | > 2 idle events | 5 pts each, max 15 pts | Medium |
| `SpeedAnomaly` | Second half > 3× faster than first half | 15 pts | Medium |
| `FocusLost` | > 3 focus loss events | 3 pts each, max 10 pts | Low |

**Final score** clamped to [0, 100].

**Integrity Label**:
- `>= 80` ? "High"
- `50–79` ? "Medium"
- `< 50` ? "Low"

Each triggered signal generates an `IntegrityFlagDetail` record with: `Signal`, `Description`, `Severity`, `Evidence` (timestamps, counts, values). These are returned in `TestResultResponse.IntegrityFlags`.

### 8.5 ML Anomaly Detection (FR-BEH-04)

**Model**: ML.NET `RandomizedPca` anomaly detection trainer
**Dimensionality**: 7 features (matches the feature vector)
**PCA rank**: 5 (number of principal components retained)
**Oversampling**: 20 (for numerical stability)

**Pipeline**:
1. `NormalizeMeanVariance` applied to each of the 7 features individually
2. `Concatenate` all 7 normalized features into a single "Features" vector
3. `RandomizedPca` trainer fit on the features vector

**Training trigger** (per-exam model, stored in `ConcurrentDictionary`):
- Initial training: when completed session count = 20
- Retrain thresholds: at 20, 50, 100, then every 50 sessions thereafter
- Cold-start fallback: returns `null` (no ML score) when < 20 sessions

**Score blending** (`AnomalyDetectionService.BlendScores`):
```
mlIntegrityScore = (1 - mlAnomalyScore) × 100
blendedScore = 0.6 × ruleScore + 0.4 × mlIntegrityScore
```

60% weight to rule-based (explainability) + 40% to ML (adaptive power).

**Flagged session threshold**: `IntegrityScore < 70` OR `IntegrityLabel == "Low"` OR `AnomalyScore >= 0.75`

---

## 9. Functional Requirements — Psychometric Analytics

### 9.1 Exam Analytics (FR-ANALYTICS-01)

**Endpoint**: `GET /api/analytics/exam/{examId}`
**Access**: Instructor, Admin

Returns a comprehensive analytics object for a specific exam:

#### 9.1.1 Summary Metrics

| Field | Description |
|---|---|
| `TotalSessions` | Number of completed test sessions |
| `AvgTheta` | Mean ability estimate across all students |
| `AvgIntegrity` | Mean integrity score |
| `AvgPercentile` | Mean percentile rank |
| `TotalQuestions` | Number of effective questions in pool |

#### 9.1.2 Item Analysis

For each question in the effective pool:

| Metric | Description | Formula |
|---|---|---|
| `PValue` | Item facility (difficulty) | Correct / Total responses |
| `PointBiserial` | Discrimination index | Pearson correlation between correct (0/1) and final ? |
| `AvgTimeTakenMs` | Mean time spent | Average of `TimeTakenMs` across responses |
| `TotalAnswered` | Number of responses | Count |
| `TotalCorrect` | Correct responses | Count |
| `Distractors` | Per-option analysis | SelectionRate, AvgThetaAtSelection, IsHighAbilityDistractor flag |

**Point-Biserial formula** (statistically correct version):
```
r_pbis = ((M1 - M0) / Sx) × v((n1 × n0) / (n × (n-1)))
```
Where M1/M0 = mean ? of correct/incorrect responders, Sx = sample SD of all ? values.

**High-Ability Distractor flag** criteria (all must be true):
- Option is not the correct answer
- Selected by = 3 students
- Selection rate = 5%
- Average ? at selection = cohort ? + 0.5 (OR within 0.15 of correct-answer selectee avg ?)

#### 9.1.3 Test Information Function (TIF)

Computed across ? range [-4, +4] in 0.25 steps:
```
TIF(?) = S a_i² × P_i(?) × (1 - P_i(?))
SEM(?) = 1 / vTIF(?)
Reliability(?) = TIF(?) / (TIF(?) + 1)
```

Returns arrays of `{ Theta, Information }` and `{ Theta, SEM, Reliability }` for charting.

#### 9.1.4 Reliability Metrics

| Metric | Condition | Formula |
|---|---|---|
| `AdaptiveMarginalReliability` | Adaptive exams | 1 - (mean(SEM²) / Var(?)) |
| `CronbachAlpha` | Fixed-form exams, =2 sessions, =2 items | Standard KR-20/a formula |

#### 9.1.5 Integrity Histogram

Bins integrity scores into 10 decile buckets (0–10, 10–20, ..., 90–100). Each bucket reports total count and flagged count.

#### 9.1.6 ML Model Status

Reports `IsTrained`, `TrainedOnSessionCount`, and `MinSessionsRequired` (20).

### 9.2 Instructor Dashboard (FR-ANALYTICS-02)

**Endpoint**: `GET /api/analytics/instructor-dashboard`
**Access**: Instructor, Admin

Returns:

| Section | Contents |
|---|---|
| `Stats` | TotalExams, ActiveExams, TotalQuestions, TotalStudentsTested, AvgClassIntegrity |
| `RecentExams` | Last 4 exams by creation date with session counts |
| `FlaggedSessions` | Up to 5 most recent sessions with IntegrityScore < 70 or label "Low" |
| `IntegrityDistribution` | Count of sessions in ranges: 0-20, 21-40, 41-60, 61-80, 81-100 |
| `ThetaDistribution` | Count of sessions in ? ranges: -3 to -2, -2 to -1, ..., 2 to 3 |
| `QuestionBankHealth` | Per-exam average IRT discrimination (sorted descending) |
| `VolumeLast7Days` | Daily submission count for the past 7 days |

### 9.3 Student Performance Analytics (FR-ANALYTICS-03)

**Endpoint**: `GET /api/analytics/student-profile`
**Access**: Student (own data only)

Returns:

| Field | Description |
|---|---|
| `radarStats` | Up to 6 domain areas with user % and cohort % (for radar chart) |
| `abilityHistory` | Array of `{ date, theta }` for line chart |
| `currentTheta` | Latest ? estimate |
| `percentile` | Latest percentile rank |
| `sem` | Latest SEM |
| `confidenceInterval` | [? - 1.96×SEM, ? + 1.96×SEM] |

**Cohort comparison**: Each domain's user accuracy is compared against the platform-wide average for that domain across all completed sessions.

### 9.4 Platform Overview (FR-ANALYTICS-04)

**Endpoint**: `GET /api/analytics/platform`
**Access**: Admin only

Returns global platform statistics: total users, exams, sessions, completed sessions, average integrity score, flagged session count, and most recent 10 completed sessions.

---

## 10. Functional Requirements — Calibration Pipeline

### 10.1 Overview (FR-CAL-01)

The `CalibrationService` implements **Joint Maximum Likelihood Estimation (JMLE)** for re-estimating IRT item parameters (b=difficulty, a=discrimination) from accumulated real response data.

**Minimum responses per question**: 30 (below this, calibration is skipped)

### 10.2 Calibration Algorithm

**Input**: List of `(IsCorrect, ThetaAtTime)` pairs for a question from completed sessions.

**Optimization**: Newton-Raphson on the 2PL log-likelihood with weak Bayesian priors:
- Prior on a: `a ~ N(1.0, 0.5)` — prevents discrimination from collapsing to 0
- Prior on b: `b ~ N(0.0, 2.0)` — centers difficulty near zero

**Gradient computation** (per response):
```
residual = u - P(?|a,b)
?L/?a += residual × (? - b)
?L/?b += residual × (-a)
```

**Hessian** (using observed information):
```
?²L/?a² -= P×Q × (?-b)²
?²L/?b² -= P×Q × a²
?²L/?a?b -= P×Q × (-a) × (?-b)
```

**Newton-Raphson update** (2×2 system):
```
[?a, ?b] = -H?¹ × ?L
```

**Step damping**: Each update clamped to ±0.5 per iteration.

**Convergence**: |?L/?a| < 0.001 AND |?L/?b| < 0.001, OR max 50 iterations.

**Bounds**: a ? [0.2, 3.0], b ? [-4.0, 4.0] after each update.

**Singular Hessian fallback**: If |det(H)| < 1e-12, falls back to gradient ascent with step=0.01.

**Standard errors** (from observed Fisher Information):
```
SE(a) = 1 / vI_aa,  SE(b) = 1 / vI_bb
```

### 10.3 Calibration Endpoints (FR-CAL-02)

| Endpoint | Description |
|---|---|
| `POST /api/calibration/exam/{examId}` | Calibrate all eligible questions in a specific exam |
| `POST /api/calibration/global` | Calibrate all eligible global bank questions |
| `POST /api/calibration/question/{id}` | Calibrate a single question by ID |

### 10.4 Post-Calibration Updates

After calibration:
- `Question.IRT_Difficulty` ? updated b estimate
- `Question.IRT_Discrimination` ? updated a estimate
- `Question.IsCalibrated` ? set to `true`
- `Question.TimesAdministered` ? updated count
- `Question.TimesCorrect` ? updated count
- `Question.DifficultyLabel` ? re-derived: b < -1.5 = "Easy", b > 1.5 = "Hard", else "Medium"


---

## 11. Non-Functional Requirements

### 11.1 Performance (NFR-PERF)

| Requirement | Target | Notes |
|---|---|---|
| Next-question API response time | = 300ms average (excluding network) | IRT computation is O(n) in pool size |
| Login/registration response | = 500ms | Includes PBKDF2 hash verification |
| AI question generation | = 8s average end-to-end | Dependent on Gemini API latency |
| Exam analytics load | = 2s for exams with = 500 responses | Computed on-demand; no caching layer |
| ML model training (per exam) | < 5s for = 1000 sessions | In-memory ML.NET Randomized PCA |
| Behavioral event batch submission | = 200ms | Simple DB insert batch |

### 11.2 Reliability & Availability (NFR-REL)

| Requirement | Target |
|---|---|
| API uptime during demo sessions | = 95% |
| Graceful degradation if Gemini API is unavailable | Return 503 with descriptive error; do not crash |
| Graceful degradation if ML model not yet trained | Return null anomaly score; rule-based integrity still computed |
| Graceful degradation if calibration insufficient data | Skip question; return descriptive message |
| Session state persistence | Incomplete sessions resumable after browser close |
| Transaction integrity | All DB writes use EF Core SaveChangesAsync; partial writes prevented |

### 11.3 Security (NFR-SEC)

| Requirement | Implementation |
|---|---|
| Password storage | ASP.NET Identity PBKDF2 with HMAC-SHA512, 10,000 iterations |
| Access token lifetime | 15 minutes (short-lived, limits exposure on compromise) |
| Refresh token storage | HttpOnly cookie (not accessible via JavaScript) |
| Refresh token hashing | SHA-256 hash stored server-side; raw token only in cookie |
| Refresh token rotation | Every use invalidates the previous token |
| JWT signing | HMAC-SHA256 with minimum 256-bit key |
| CORS | Restricted to `localhost:5173` and `localhost:3000` with credentials |
| Role enforcement | Applied at both API attribute level and service logic level |
| Input validation | Data annotations on all DTOs; server-side JSON validation for AI output |
| Error messages | Generic 401 messages to prevent user enumeration |
| SQL injection | Fully prevented by EF Core parameterized queries |
| API key storage | Gemini API key in `appsettings.json` (should be moved to User Secrets / environment variables in production) |

### 11.4 Usability (NFR-USE)

- Responsive dark-theme glassmorphism UI
- Role-specific dashboards with no cross-role data leakage in the UI
- Toast notifications (`react-hot-toast`) for all async operations
- Error boundaries (`ErrorBoundary.jsx`) to prevent full-app crashes on component errors
- Lazy-loaded routes with React Suspense for fast initial load
- Clear distinction between "Available", "Completed", and "In Progress" exam states for students

### 11.5 Maintainability (NFR-MAINT)

- Decoupled service layer: `IExamService`, `ITestSessionService`, `IQuestionGenerationService` interfaces
- Singleton vs. Scoped service registration appropriately managed to prevent DbContext threading issues
- Code-First EF Core migrations for reproducible schema evolution
- All constants centralized in `AppConstants.cs` (Roles, ExamStatuses, TestSessionStatuses)
- Behavioral analyzer fully unit-testable (no external dependencies)

### 11.6 Scalability Constraints (NFR-SCALE)

> **Note**: Evalyn is designed as an FYP prototype, not a production-scale system. The following limitations apply:

- ML models are stored **in-process in memory** (lost on application restart)
- No distributed caching layer (Redis, etc.)
- No message queue for async background processing
- No horizontal scaling support (session affinity would be required for ML models)
- SQL Server used locally; not configured for high-availability clustering

---

## 12. System Architecture

### 12.1 High-Level Architecture

```
+-------------------------------------------------------------+
¦                     BROWSER (Client)                         ¦
¦  React 18 SPA (Vite 6)    http://localhost:5173              ¦
¦  +----------+  +--------+  +----------+  +--------------+  ¦
¦  ¦  Auth    ¦  ¦ Exam   ¦  ¦ Student  ¦  ¦  Instructor  ¦  ¦
¦  ¦  Pages   ¦  ¦ Builder¦  ¦ Dashboard¦  ¦  Dashboard   ¦  ¦
¦  +----------+  +--------+  +----------+  +--------------+  ¦
¦         ? Axios + JWT Bearer (Authorization header)          ¦
+-------------------------------------------------------------+
                              ¦
                    REST/JSON + Cookies
                              ¦
+-------------------------------------------------------------+
¦                  Evalyn.API (ASP.NET Core 10)                ¦
¦                   https://localhost:7xxx                      ¦
¦  +------------+  +--------------+  +---------------------+  ¦
¦  ¦Controllers ¦  ¦   Services   ¦  ¦  Infrastructure     ¦  ¦
¦  ¦ Auth       ¦  ¦ IRTEngine    ¦  ¦  JWT Middleware      ¦  ¦
¦  ¦ Exams      ¦  ¦ PsychSvc     ¦  ¦  CORS Policy        ¦  ¦
¦  ¦ Questions  ¦  ¦ BehavAnalyze ¦  ¦  EF Core DbContext   ¦  ¦
¦  ¦ TestSess.  ¦  ¦ AnomalyDetSvc¦  ¦  Identity           ¦  ¦
¦  ¦ Analytics  ¦  ¦ CalibSvc     ¦  ¦                     ¦  ¦
¦  ¦ AI         ¦  ¦ GeminiSvc    ¦  ¦                     ¦  ¦
¦  ¦ Calibration¦  ¦ ExamService  ¦  ¦                     ¦  ¦
¦  +------------+  +--------------+  +---------------------+  ¦
¦         ? EF Core                         ? HttpClient       ¦
+-------------------------------------------------------------+
                       ¦                          ¦
         +-------------+              +-----------+
         ?                            ?
+-----------------+        +----------------------+
¦   SQL Server    ¦        ¦   Google Gemini API  ¦
¦  EvalynVSCode   ¦        ¦  gemini-1.5-flash    ¦
¦  (Local MSSQL)  ¦        ¦  (External REST)     ¦
+-----------------+        +----------------------+
```

### 12.2 Backend Layer Breakdown

| Layer | Files | Responsibility |
|---|---|---|
| **Controllers** | `AuthController`, `ExamsController`, `QuestionsController`, `TestSessionsController`, `AnalyticsController`, `ExamPoolController`, `QuestionBankController`, `StudentsController`, `AIController`, `CalibrationController` | HTTP routing, request validation, response mapping |
| **Services — Domain** | `IRTEngine`, `PsychometricService`, `BehavioralAnalyzer`, `AnomalyDetectionService`, `CalibrationService` | Core business logic and algorithms |
| **Services — Application** | `ExamService` (IExamService), `TestSessionService` (ITestSessionService) | Orchestration between domain services and data layer |
| **Services — External** | `GeminiQuestionGenerationService` (IQuestionGenerationService) | Gemini AI integration |
| **Data** | `AppDbContext`, `AppDbContextFactory` | EF Core DbContext, model configuration |
| **Models/Entities** | 13 entity classes | Database table mapping |
| **Models/DTOs** | `DTOs.cs` (single file with all 30+ DTOs) | API request/response contracts |
| **Constants** | `AppConstants.cs` | Roles, ExamStatuses, TestSessionStatuses |
| **Infrastructure** | `ApiException`, `ExamPoolCalculator` | Custom exceptions, helper utilities |

### 12.3 Frontend Layer Breakdown

| Layer | Files | Responsibility |
|---|---|---|
| **Pages/Auth** | `AuthPage.jsx`, `Login.jsx`, `Register.jsx` | Authentication UI |
| **Pages/Student** | `StudentDashboard.jsx`, `TakeExam.jsx`, `ExamResult.jsx`, `Assessments.jsx`, `Performance.jsx`, `History.jsx` | Student-facing screens |
| **Pages/Instructor** | `InstructorDashboard.jsx`, `ExamBuilder.jsx`, `ExamList.jsx`, `CreateExam.jsx`, `AIQuestionGen.jsx`, `QuestionBank.jsx`, `StudentManagement.jsx`, `AnalyticsDashboard.jsx`, `ExamAnalytics.jsx` | Instructor-facing screens |
| **Components/Common** | `Layout.jsx`, `ErrorBoundary.jsx` | Shell layout, error handling |
| **Components/ExamBuilder** | `ExamSettingsPanel.jsx`, `QuestionSelectionModal.jsx`, `SelectedQuestionList.jsx`, `DeleteConfirmationModal.jsx`, `ExamBuilderContext.jsx` | Exam builder sub-components |
| **Context** | `AuthContext.jsx` | Global auth state (user object, loading state) |
| **Services** | `api.js`, `authTokenStore.js` | Axios instance with interceptors, token storage |
| **Constants** | `appConstants.js` | Roles enum for frontend route guards |

### 12.4 Service Lifetimes (DI Registration)

| Service | Lifetime | Rationale |
|---|---|---|
| `AppDbContext` | Scoped | Per-request DB connection |
| `IExamService` | Scoped | Depends on DbContext |
| `ITestSessionService` | Scoped | Depends on DbContext |
| `PsychometricService` | Scoped | Depends on DbContext |
| `BehavioralAnalyzer` | Singleton | Stateless; no DB dependency |
| `AnomalyDetectionService` | Singleton | Holds in-memory ML models; must be singleton |
| `CalibrationService` | Singleton | Uses IServiceScopeFactory to create DbContext scopes |
| `IRTEngine` | Singleton | Stateless; settings injected |
| `GeminiQuestionGenerationService` | Transient (via HttpClient factory) | New instance per HTTP call |

---

## 13. Data Model & Database Schema

### 13.1 Entity Relationship Summary

```
ApplicationUser (ASP.NET Identity)
    ¦
    +-- CreatedExams (1:N) --? Exam
    ¦                              ¦
    ¦                              +-- Questions (1:N) --? Question
    ¦                              ¦                           ¦
    ¦                              ¦                           +-- QuestionOptions (1:N)
    ¦                              ¦                           +-- QuestionDomainTags (1:N)
    ¦                              ¦                           +-- Responses (1:N)
    ¦                              ¦
    ¦                              +-- ExamQuestionPoolItems (1:N) --? [links to global Questions]
    ¦                              +-- ExamPoolSettings (1:1)
    ¦                              ¦       +-- ExamPoolAllowedTags (1:N)
    ¦                              +-- ExamAudiences (1:N)
    ¦                              +-- TestSessions (1:N)
    ¦
    +-- TestSessions (1:N) --? TestSession
                                    ¦
                                    +-- Responses (1:N)
                                    +-- BehavioralEvents (1:N)
                                    +-- BehavioralFeatureVector (1:1)
```

### 13.2 Full Entity Specifications

#### ApplicationUser
Extends `IdentityUser` (ASP.NET Core Identity).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | string (GUID) | PK (inherited) | Identity-managed GUID |
| `Email` | string | Unique, max 256 | Login identifier |
| `UserName` | string | = Email | Identity requirement |
| `PasswordHash` | string | — | PBKDF2 hash |
| `FullName` | string | Max 200 | Display name |
| `Role` | string | Max 50 | "Student" / "Instructor" / "Admin" |
| `Institution` | string | — | University or organization |
| `Identifier` | string | — | Student ID or employee number |
| `Section` | string | Max 100, Indexed | Used for exam audience matching |
| `CreatedAt` | DateTime | UTC | Account creation time |
| `RefreshTokenHash` | string? | Nullable | SHA-256 hash of current refresh token |
| `RefreshTokenExpiresAt` | DateTime? | Nullable | Expiry of refresh token |

#### Exam

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | int | PK, auto-increment | — |
| `Title` | string | Max 300, Required | Exam title |
| `Description` | string | Max 2000, Optional | — |
| `CreatedById` | string | FK ? ApplicationUser, Restrict delete | Owner |
| `DurationMinutes` | int | 1–1440 | Allowed exam duration |
| `IsAdaptive` | bool | — | True = CAT, False = fixed-form |
| `MaxQuestions` | int | 1–500 | Max questions per session |
| `Status` | string | Max 50, Indexed | "Draft" / "Published" / "Archived" |
| `AudienceType` | string | — | "SECTION" / "MULTI_SECTION" / "INDIVIDUAL" |
| `StartsAtUtc` | DateTime? | UTC converter applied | Scheduling window open |
| `EndsAtUtc` | DateTime? | UTC converter applied | Scheduling window close |
| `CreatedAt` | DateTime | UTC | — |

#### Question

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | int | PK | — |
| `ExamId` | int? | FK ? Exam (Cascade delete), Indexed | null = global bank question |
| `FixedFormOrder` | int? | Indexed with ExamId | Delivery order in fixed-form |
| `CreatedById` | string? | FK ? ApplicationUser (Restrict), Indexed | For bank question ownership |
| `QuestionText` | string | Max 5000 | Stem text |
| `QuestionType` | string | Max 20 | "MCQ" / "True / False" / "Short answer" |
| `IsAIGenerated` | bool | — | Source flag |
| `IRT_Difficulty` | double | [-4, 4] | b parameter |
| `IRT_Discrimination` | double | [0.2, 3.0] | a parameter |
| `IRT_Guessing` | double | [0, 1] | c parameter (stored, unused in 1PL/2PL) |
| `DifficultyLabel` | string | Max 20 | "Easy" / "Medium" / "Hard" |
| `TimesAdministered` | int | — | Calibration tracking |
| `TimesCorrect` | int | — | Calibration tracking |
| `IsCalibrated` | bool | — | True after JMLE calibration |

#### QuestionOption

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | int | PK | — |
| `QuestionId` | int | FK ? Question (Cascade), Indexed | — |
| `OptionText` | string | Max 1000 | Answer choice text |
| `IsCorrect` | bool | — | Exactly one per question |

#### QuestionDomainTag

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | int | PK | — |
| `QuestionId` | int | FK ? Question (Cascade) | — |
| `DomainName` | string | Max 100 | Top-level domain (e.g. "Mathematics") |
| `SubDomain` | string | Max 100 | Sub-domain (e.g. "Algebra") |

#### TestSession

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | int | PK | — |
| `UserId` | string | FK ? ApplicationUser (Restrict) | Student |
| `ExamId` | int | FK ? Exam (Restrict) | — |
| `ThetaEstimate` | double | — | Final ability estimate |
| `ThetaSEM` | double | — | Standard Error of Measurement |
| `PercentileRank` | double | — | F(?) × 100 |
| `IntegrityScore` | double | [0, 100] | Blended integrity score |
| `IntegrityLabel` | string | Max 20 | "High" / "Medium" / "Low" |
| `AnomalyScore` | double? | [0, 1], Nullable | ML PCA anomaly score |
| `TotalCorrect` | int | — | Count of correct responses |
| `TotalQuestions` | int | — | Count of answered questions |
| `StartedAt` | DateTime | UTC | — |
| `CompletedAt` | DateTime? | UTC, Nullable | — |
| `Status` | string | Max 50 | "InProgress" / "Completed" / "Abandoned" |

#### Response

| Column | Type | Description |
|---|---|---|
| `Id` | int | PK |
| `TestSessionId` | int | FK ? TestSession (Cascade) |
| `QuestionId` | int | FK ? Question (Restrict) |
| `SelectedOptionId` | int? | FK ? QuestionOption (SetNull) |
| `IsCorrect` | bool | — |
| `ThetaAtTime` | double | ? estimate when this question was answered |
| `TimeTakenMs` | int | Time spent on this question (ms) |
| `QuestionOrder` | int | Position in session (1-based) |
| `AnsweredAt` | DateTime | UTC |

#### BehavioralEvent

| Column | Type | Description |
|---|---|---|
| `Id` | int | PK |
| `TestSessionId` | int | FK ? TestSession (Cascade) |
| `EventType` | string | Max 50; one of 8 event types |
| `EventData` | string | JSON payload with event-specific data |
| `Timestamp` | DateTime | UTC event time |

#### BehavioralFeatureVector (1:1 with TestSession)

| Column | Type | Description |
|---|---|---|
| `TestSessionId` | int | PK and FK ? TestSession (Cascade) |
| `TabSwitchesPerMinute` | double | Feature 1 |
| `PasteCount` | int | Feature 2 |
| `RightClickCount` | int | Feature 3 |
| `IdleSeconds` | double | Feature 4 |
| `FocusLostCount` | int | Feature 5 |
| `TimingCv` | double | Feature 6 — coefficient of variation |
| `MouseAngleEntropy` | double | Feature 7 |
| `ComputedAt` | DateTime | UTC — when features were extracted |

#### ExamPoolSettings (1:1 with Exam)

| Column | Type | Description |
|---|---|---|
| `ExamId` | int | PK and FK ? Exam (Cascade) |
| `AllowAIGenerated` | bool | Default true |
| `RequireCalibrated` | bool | Default false |
| `MinDifficulty` | double | Default -4.0 |
| `MaxDifficulty` | double | Default 4.0 |

#### ExamPoolAllowedTag

| Column | Type | Description |
|---|---|---|
| `Id` | int | PK |
| `ExamId` | int | FK ? ExamPoolSettings (Cascade) |
| `DomainName` | string | Max 100 |
| `SubDomain` | string | Max 100 |

#### ExamQuestionPoolItem (Many-to-Many link)

| Column | Type | Description |
|---|---|---|
| `ExamId` | int | PK component; FK ? Exam (Cascade) |
| `QuestionId` | int | PK component; FK ? Question (Restrict) |
| `FixedFormOrder` | int? | Ordering for fixed-form delivery |
| `AttachedAt` | DateTime | When this question was attached |

#### ExamAudience

| Column | Type | Description |
|---|---|---|
| `Id` | int | PK |
| `ExamId` | int | FK ? Exam (Cascade) |
| `Section` | string | Max 100; for SECTION type |
| `StudentId` | string? | FK ? ApplicationUser (Restrict); for INDIVIDUAL type |
| `AudienceType` | string | "SECTION" / "MULTI_SECTION" / "INDIVIDUAL" |


---

## 14. API Reference

### 14.1 Authentication Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login, receive JWT |
| POST | `/api/auth/refresh` | Public | Refresh access token via cookie |
| POST | `/api/auth/logout` | Public | Invalidate refresh token |

### 14.2 Exam Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/exams` | Authenticated | List exams (role-filtered) |
| POST | `/api/exams` | Instructor, Admin | Create exam |
| GET | `/api/exams/{id}` | Instructor, Admin | Get exam details |
| PUT | `/api/exams/{id}` | Instructor (own), Admin | Update exam metadata |
| DELETE | `/api/exams/{id}` | Instructor (own), Admin | Delete exam |
| PUT | `/api/exams/{id}/publish` | Instructor (own), Admin | Publish exam |
| PUT | `/api/exams/{id}/archive` | Instructor (own), Admin | Archive exam |

### 14.3 Question Endpoints (Exam-Scoped)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/exams/{examId}/questions` | Instructor, Admin | List all questions for exam |
| POST | `/api/exams/{examId}/questions` | Instructor (owner), Admin | Add question to exam |
| PUT | `/api/exams/{examId}/questions/{id}` | Instructor (owner), Admin | Update question |
| DELETE | `/api/exams/{examId}/questions/{id}` | Instructor (owner), Admin | Delete question |

### 14.4 Question Bank Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/questionbank` | Instructor, Admin | List global bank questions |
| POST | `/api/questionbank` | Instructor, Admin | Create global bank question |
| PUT | `/api/questionbank/{id}` | Instructor (own), Admin | Update bank question |
| DELETE | `/api/questionbank/{id}` | Instructor (own), Admin | Delete bank question |

### 14.5 Exam Pool Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/exams/{examId}/pool` | Instructor, Admin | Get pool settings + counts |
| PUT | `/api/exams/{examId}/pool` | Instructor (owner), Admin | Update pool settings |
| GET | `/api/exams/{examId}/pool/attached` | Instructor, Admin | List attached bank questions |
| GET | `/api/exams/{examId}/pool/questions` | Instructor, Admin | List effective pool (all filtered questions) |
| POST | `/api/exams/{examId}/pool/attach` | Instructor (owner), Admin | Attach bank questions |
| DELETE | `/api/exams/{examId}/pool/attach/{questionId}` | Instructor (owner), Admin | Detach bank question |

### 14.6 Test Session Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/testsessions/start/{examId}` | Student | Start or resume exam session |
| POST | `/api/testsessions/{sessionId}/answer` | Student | Submit answer, get next question |
| POST | `/api/testsessions/{sessionId}/events` | Student | Log single behavioral event |
| POST | `/api/testsessions/{sessionId}/events/batch` | Student | Log batch of behavioral events |
| GET | `/api/testsessions/{sessionId}/result` | Student, Instructor, Admin | Get session result with analytics |
| GET | `/api/testsessions/my` | Student | Get student's own session history |

### 14.7 Analytics Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/analytics/exam/{examId}` | Instructor, Admin | Full per-exam psychometric analytics |
| GET | `/api/analytics/instructor-dashboard` | Instructor, Admin | Instructor dashboard aggregate stats |
| GET | `/api/analytics/platform` | Admin | Platform-level overview |
| GET | `/api/analytics/student-profile` | Student | Student's own performance profile |

### 14.8 AI Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/ai/generate-questions` | Instructor, Admin | Generate MCQs via Gemini |

### 14.9 Calibration Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/calibration/exam/{examId}` | Instructor, Admin | Batch calibrate exam questions |
| POST | `/api/calibration/global` | Admin | Batch calibrate all global bank questions |
| POST | `/api/calibration/question/{id}` | Instructor, Admin | Calibrate single question |

### 14.10 Student Management Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/students` | Instructor, Admin | List all students with session summaries |
| GET | `/api/students/{id}` | Instructor, Admin | Get specific student detail |

### 14.11 Standard Error Response Format

All errors return RFC 7807 `application/problem+json`:

```json
{
  "status": 400,
  "title": "Descriptive error message",
  "detail": "Additional detail (dev mode only)",
  "traceId": "0HN7...",
  "error": "Descriptive error message"
}
```

The `error` field duplicates `title` for backward compatibility with frontend error parsing (`err.response.data.error`).

---

## 15. Frontend Routes & UI Screens

### 15.1 Route Structure

| Path | Component | Access | Description |
|---|---|---|---|
| `/login` | `AuthPage` | Public (redirect if logged in) | Login form |
| `/register` | `AuthPage` | Public (redirect if logged in) | Registration form |
| `/` | Role-based redirect | Authenticated | ? StudentDashboard or InstructorDashboard |
| `/assessments` | `Assessments` | Student | Available/In-Progress/Completed/Missed exams |
| `/exam/:examId` | `TakeExam` | Student | Live exam taking interface |
| `/result/:sessionId` | `ExamResult` | Student, Instructor, Admin | Post-exam result with analytics |
| `/performance` | `Performance` | Student | Ability history, domain radar, SEM, CI |
| `/history` | `History` | Student | All past sessions table |
| `/instructor/exams` | `ExamList` | Instructor, Admin | List of all created exams |
| `/instructor/exams/create` | `CreateExam` | Instructor, Admin | Create new exam wizard |
| `/instructor/exams/:examId` | `ExamBuilder` | Instructor, Admin | Full exam editor (questions, pool, settings) |
| `/instructor/exams/:examId/ai` | `AIQuestionGen` | Instructor, Admin | AI generation for specific exam |
| `/instructor/ai-question-gen` | `AIQuestionGen` | Instructor, Admin | Global AI generation for bank |
| `/instructor/analytics/:examId` | `ExamAnalytics` | Instructor, Admin | Per-exam psychometric analytics |
| `/instructor/analytics` | `AnalyticsDashboard` | Instructor, Admin | Instructor dashboard |
| `/instructor/students` | `StudentManagement` | Instructor, Admin | Student roster with session data |
| `/instructor/question-bank` | `QuestionBank` | Instructor, Admin | Global question bank management |

### 15.2 Route Guards

All protected routes use a `ProtectedRoute` HOC that:
1. Reads `user` from `AuthContext`
2. If loading ? renders null (prevents flash)
3. If no user ? redirects to `/login`
4. If user.role not in allowed roles ? redirects to `/`

### 15.3 Student UI Screens

**StudentDashboard**: Shows summary stats (exams taken, avg score, overall ?), near-deadline assessments card, recent results list.

**TakeExam**: Question-by-question interface with timer countdown, progress indicator, answer selection with radio buttons. Behavioral telemetry captured passively via event listeners (tab visibility, clipboard, focus, right-click, mouse movement, idle detection). Events batched and submitted periodically.

**ExamResult**: Full result breakdown — score percentage, ? estimate, SEM, CI, percentile, domain skill map (table with correct/total per domain), integrity flags with severity badges.

**Assessments**: Three-section layout — **Available** (green card, Start button), **In Progress** (amber card, Resume button), **Completed** (with score, percentile, completion date), **Missed** (past end time, not attempted).

**Performance**: Recharts LineChart for ? history, RadarChart for domain comparison (user vs cohort), SEM and CI display panel.

**History**: Tabular list of all sessions with status, date, score, ?, integrity label.

### 15.4 Instructor UI Screens

**InstructorDashboard**: Stats cards (Total Exams, Active Exams, Total Questions, Students Tested, Avg Integrity), recent exams list, flagged sessions list, integrity distribution bar chart, theta distribution chart, volume chart (7-day).

**ExamList**: Table of all exams with status badges, question count, adaptive/fixed badge, date, and action buttons (View, Analytics, Archive).

**CreateExam**: Multi-field form — title, description, duration, adaptive/fixed toggle, max questions, audience type, section targeting, scheduling date pickers.

**ExamBuilder**: Tabbed interface — (1) Questions tab: add/edit/delete questions with full IRT parameter controls; (2) Pool tab: pool settings panel, attach/detach bank questions, view effective pool; (3) Settings tab: exam metadata editing, publish/archive controls.

**QuestionBank**: Full-page question list with search/filter, create button, inline edit/delete with confirmation modal, AI generation launcher.

**AIQuestionGen**: Topic input, difficulty selector, count slider, question type selector, domain/subdomain optional fields. Generates question cards that can be individually approved and saved.

**ExamAnalytics**: Item analysis table with sortable columns (p-value, point-biserial, discrimination, avg time), distractor analysis expandable per question, TIF line chart, reliability curve, student results table, integrity histogram, ML model status indicator.

**StudentManagement**: Searchable student roster with institution, section, sessions count, and expandable assessment history per student.

---

## 16. Security Design

### 16.1 Token Architecture

```
Authentication Flow:
1. POST /api/auth/login ? returns JWT in body + refresh token in HttpOnly cookie
2. Frontend stores JWT in memory (AuthContext state) - NOT localStorage
3. Each API call: Authorization: Bearer <JWT>
4. When JWT expires (15 min): POST /api/auth/refresh ? rotated JWT + new cookie
5. Logout: clears cookie server-side, clears AuthContext state client-side
```

### 16.2 Refresh Token Security

- Raw token: 48 bytes of `RandomNumberGenerator.GetBytes()`, Base64Url encoded
- Stored server-side: SHA-256 hash only (never raw token in DB)
- Stored client-side: HttpOnly, Secure (on HTTPS), SameSite=None (HTTPS) or Lax (HTTP dev)
- Cookie Path restricted to `/api/auth` (not accessible to other API calls)
- Rotation: every refresh call invalidates the previous token
- Expiry: 7 days

### 16.3 Input Validation

| Layer | Mechanism |
|---|---|
| API DTOs | `[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]` data annotations |
| Model binding | ASP.NET automatically returns 400 for annotation violations |
| AI output | Custom `QuestionGenerationJson.ParseQuestionsJson` with structural validation |
| IRT parameters | Range-clamped in service layer before use |
| Behavioral events | `EventType` max 60 chars, `EventData` max 4000 chars |

### 16.4 Authorization Enforcement

- **Controller level**: `[Authorize]` and `[Authorize(Roles = "...")]` attributes
- **Service level**: Owner checks (`exam.CreatedById == UserId`) before any mutation
- **Published exam guard**: Checks `exam.Status == ExamStatuses.Published` before allowing pool/question changes

### 16.5 Known Security Gaps (for improvement)

1. **Gemini API key in appsettings.json** — should be in User Secrets or environment variable
2. **JWT key in appsettings.json** — same issue; empty string would cause startup exception
3. **No account lockout** — `lockoutOnFailure: false` in `CheckPasswordSignInAsync` means brute-force is possible
4. **No rate limiting** — API has no throttling middleware; DoS via repeated AI generation calls is possible
5. **No HTTPS enforcement in development** — HTTP allowed for local development CORS

---

## 17. Third-Party Integrations

### 17.1 Google Gemini 1.5 Flash

| Property | Value |
|---|---|
| Base URL | `https://generativelanguage.googleapis.com/` |
| Model | `gemini-1.5-flash` |
| Endpoint | `v1beta/models/gemini-1.5-flash:generateContent` |
| Auth | API key in query string (`?key=...`) |
| Max output tokens | 1400 |
| Temperature | 0.2 (low, for consistent structured output) |
| Timeout | 60 seconds |

**Error handling**: HTTP non-2xx ? `InvalidOperationException` with truncated response body (max 800 chars). Response truncation prevents log pollution.

**JSON extraction**: Multi-step parsing — extract `candidates[0].content.parts[0].text`, strip code fences if present, parse as JSON array.

### 17.2 ML.NET (Microsoft)

| Property | Value |
|---|---|
| Package | `Microsoft.ML` v4.0.2 |
| Trainer | `AnomalyDetection.Trainers.RandomizedPca` |
| Seed | 42 (reproducible across runs within same process lifetime) |
| Rank | 5 (principal components) |
| Oversampling | 20 |
| EnsureZeroMean | true |
| Normalization | `NormalizeMeanVariance` per feature |

### 17.3 ASP.NET Core Identity

| Property | Value |
|---|---|
| Package | `Microsoft.AspNetCore.Identity.EntityFrameworkCore` v10.0.3 |
| Password hasher | PBKDF2 with HMAC-SHA512 |
| User store | EF Core (SQL Server) |
| Token providers | Default (used for password reset, email confirmation — not currently wired) |

---

## 18. Constraints & Assumptions

### 18.1 Technical Constraints

1. The platform targets **.NET 10.0** which requires Visual Studio 2022 17.x+ or the .NET 10 SDK.
2. The database **must** be Microsoft SQL Server (EF Core SQL Server provider used; migration scripts are SQL Server-specific).
3. The frontend **must** be served by Vite dev server during development; production build requires separate static file hosting.
4. ML models are **not persisted** across server restarts — models are retrained from DB data on next trigger.
5. The Gemini API requires an **active internet connection**; offline operation of AI generation is not supported.

### 18.2 Business Assumptions

1. All users self-register; there is no admin-provisioned account flow.
2. A student's `Section` field is set at registration and not changed — exam audience targeting depends on this.
3. An exam can only have one `ExamPoolSettings` configuration at a time.
4. Questions in the global bank (`ExamId == null`) are shared across all instructors who can view them; ownership (`CreatedById`) controls edit/delete rights.
5. The system is designed for single-institution deployment; no multi-tenancy is implemented.

---

## 19. Risks & Mitigations

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Small dataset for anomaly model calibration (cold-start) | High (FYP context) | Medium | Cold-start fallback: rule-based integrity computed regardless; ML score is null until 20 sessions |
| R-02 | IRT ? estimation instability (all-correct/all-wrong) | Medium | High | Edge case handlers in IRTEngine; MAP prior regularization; theta clamping |
| R-03 | AI (Gemini) API unavailability or quality variance | Medium | Low–Medium | Server-side JSON schema validation; instructor review gate before saving; graceful 503 error |
| R-04 | Calibration instability with insufficient data | High | Low | Minimum 30 responses enforced; JMLE falls back to initial parameters if singular Hessian |
| R-05 | Refresh token cookie SameSite issues in production | Medium | High | Currently SameSite=None (HTTPS) or Lax (HTTP); production deployment requires HTTPS |
| R-06 | Exam pool returns 0 questions (filter too strict) | Medium | High | Pool settings validation UI shows effective count before publish; `ExamPoolCalculator` returns count |
| R-07 | MLE divergence in Newton-Raphson | Low | Medium | 25-iteration cap; singular Hessian detection; previous theta fallback |
| R-08 | Gemini API key exposure | Medium (dev env) | High | Key in appsettings.json for development only; must be moved to secrets before any deployment |

---

## 20. Weaknesses & Critical Improvement Areas

This section provides a candid assessment of the current system's weaknesses — areas where the implementation falls short of production standards or where academic rigor could be strengthened.

### 20.1 ?? CRITICAL — Security Issues

**1. API Key Exposed in Source Code**
- **Issue**: `Gemini:ApiKey` is stored in `appsettings.json` and committed to version control.
- **Risk**: Anyone with repository access can use the API key, incurring charges.
- **Fix**: Move to `dotnet user-secrets` for development, environment variables for production.

**2. JWT Secret Key is Empty in appsettings.json**
- **Issue**: `Jwt:Key` is an empty string — the startup guard catches it, but the key must be set manually in each environment.
- **Risk**: Forgotten configuration = server fails to start with a confusing error.
- **Fix**: Auto-generate and store in User Secrets during `dotnet run` in development.

**3. No Brute-Force Protection**
- **Issue**: `lockoutOnFailure: false` means unlimited password attempts.
- **Fix**: Enable ASP.NET Identity lockout with `MaxFailedAccessAttempts = 5` and `DefaultLockoutTimeSpan = 15 minutes`.

**4. No Rate Limiting**
- **Issue**: No throttling on any endpoint, particularly AI generation (expensive external call).
- **Fix**: Add ASP.NET Core rate limiting middleware (`AddRateLimiter`) with fixed-window or sliding-window policy.

### 20.2 ?? CRITICAL — Data & Reliability Issues

**5. ML Models Lost on Restart**
- **Issue**: `AnomalyDetectionService` stores trained ML models in a `ConcurrentDictionary` in memory. Every restart triggers cold-start for all exams.
- **Impact**: Anomaly detection unavailable until 20+ sessions are re-accumulated AND a retraining trigger fires.
- **Fix**: Serialize trained `ITransformer` models to disk (ML.NET supports `mlContext.Model.Save()`); reload on startup.

**6. No Exam Session Concurrency Control**
- **Issue**: If a student submits two answers simultaneously (race condition), both could be processed.
- **Fix**: Add a distributed lock or database-level unique constraint on `(TestSessionId, QuestionId)` in the Response table.

**7. `TestSession.Status` Not Automatically Set to `Abandoned`**
- **Issue**: If a student leaves mid-exam and never returns, the session stays `InProgress` indefinitely.
- **Fix**: Add a background job (e.g., `IHostedService`) that marks sessions as `Abandoned` after `DurationMinutes + grace period` has elapsed since `StartedAt`.

### 20.3 ?? HIGH — Functional Gaps

**8. No Email Verification**
- **Issue**: Any email address can be used to register without verification; there is no email confirmation flow despite ASP.NET Identity supporting it.
- **Fix**: Enable `RequireConfirmedEmail = true` in Identity options and wire up a confirmation email via SMTP.

**9. No Password Reset Flow**
- **Issue**: There is no "Forgot Password" functionality; a student who forgets their password cannot recover access.
- **Fix**: Implement `UserManager.GeneratePasswordResetTokenAsync` + email delivery.

**10. Student Cannot Retake Exams**
- **Issue**: The system blocks retakes (returns existing session on duplicate start). There is no instructor-controlled "reset attempt" feature.
- **Fix**: Add an endpoint for instructors to reset/invalidate a student's session for a specific exam.

**11. No Exam Preview Mode**
- **Issue**: Instructors cannot preview how an exam will look to students before publishing.
- **Fix**: Add a "Preview" mode that renders the TakeExam UI with mock session state.

**12. No Question Import/Export**
- **Issue**: Questions can only be created one at a time through the UI or AI generation. There is no bulk import (CSV, QTI format).
- **Fix**: Add bulk CSV import for question bank; consider QTI 2.1 format for interoperability.

**13. Audience Targeting Has No UI Validation**
- **Issue**: If `AudienceType = SECTION` but `Sections` list is empty, the exam will be visible to nobody with no warning.
- **Fix**: Frontend validation and server-side check that SECTION/MULTI_SECTION exams have at least one section specified.

### 20.4 ?? HIGH — Psychometric Limitations

**14. IRT Guessing Parameter (c) Not Used**
- **Issue**: The entity has `IRT_Guessing` stored but the 3PL model is not implemented. For True/False questions, guessing = 0.5, which significantly affects psychometric accuracy.
- **Fix**: Implement 3PL probability: `P = c + (1-c) / (1 + exp(-a(?-b)))` and use c=0.5 for True/False, c=0.25 for 4-option MCQ.

**15. No CAT Stopping Rule**
- **Issue**: The CAT always runs until `MaxQuestions` is reached, regardless of measurement precision. A student with very high ability will answer all 30 questions even if SEM < 0.3 after 15.
- **Fix**: Implement a target SEM stopping criterion (e.g., stop when `SEM < 0.3`), reducing exam length for ability extremes.

**16. Item Exposure Not Fully Controlled**
- **Issue**: The top-K randomization (`ExposureTopK = 3`) is a basic exposure control. The same popular questions may be over-exposed across many students.
- **Fix**: Implement Sympson-Hetter exposure control or a Progressive Restricted Adaptive Testing (PRAT) algorithm.

**17. Calibration Requires Manual Trigger**
- **Issue**: There is no automated calibration schedule. An instructor must manually call the calibration endpoint.
- **Fix**: Add a scheduled background job (Quartz.NET or `IHostedService` with timer) to run calibration nightly.

**18. Cold-Start Item Parameters Are Approximate**
- **Issue**: New questions use label-seeded parameters (e.g., "Easy" ? b=-1.5, a=0.9). These are fixed heuristics that may not reflect actual item behavior.
- **Fix**: Use polytomous IRT pre-scaling or link to existing calibrated items of similar difficulty before enough real data accumulates.

### 20.5 ?? MEDIUM — Performance & Scalability

**19. Analytics Computed On-Demand Without Caching**
- **Issue**: `GetExamAnalyticsAsync` performs complex joins and in-memory LINQ computations on every API call. For exams with 500+ sessions and 50+ questions, this could take several seconds.
- **Fix**: Cache analytics results in Redis or SQL with a 5-minute TTL; invalidate cache on new session completion.

**20. N+1 Query Risk in Student Management**
- **Issue**: `StudentsController` may trigger N+1 queries when loading session lists per student.
- **Fix**: Use `Include().ThenInclude()` eagerly or use projection queries to avoid multiple round trips.

**21. BehavioralEvents Table Will Grow Unboundedly**
- **Issue**: Every exam session generates dozens of behavioral events stored indefinitely. There is no data retention or archival policy.
- **Fix**: Archive events older than 90 days to cold storage; retain only `BehavioralFeatureVector` for historical analysis.

**22. No Pagination on List Endpoints**
- **Issue**: `GET /api/questionbank`, `GET /api/students`, `GET /api/exams` return all records without pagination.
- **Fix**: Implement cursor-based or offset pagination with a standard `?page=&pageSize=` pattern.

### 20.6 ?? MEDIUM — UX & Accessibility

**23. No Offline/Poor-Connection Handling in TakeExam**
- **Issue**: If the network drops during an exam, the student's answer submission will fail with no retry logic.
- **Fix**: Implement optimistic answer queuing with local storage fallback and exponential backoff retry.

**24. Timer Not Server-Synchronized**
- **Issue**: The exam timer runs client-side based on `DurationMinutes` and `StartedAt`. A student who manipulates the system clock could theoretically gain extra time.
- **Fix**: Server should track `RemainingSeconds` and validate on each answer submission; `StartExamResponse` already includes `RemainingSeconds` — this should be enforced server-side.

**25. No Accessibility (a11y) Audit**
- **Issue**: The UI has not been audited for WCAG 2.1 compliance. Dark theme with low-contrast text, lack of ARIA labels, and keyboard navigation gaps may exclude users with disabilities.
- **Fix**: Run `axe-core` audit; add ARIA roles/labels; ensure all interactive elements are keyboard-accessible.

### 20.7 ?? LOW — Future Enhancements

| # | Enhancement |
|---|---|
| FE-01 | LTI 1.3 integration for embedding Evalyn in Moodle/Canvas |
| FE-02 | Explainable anomaly decomposition — show feature contribution breakdown per flag |
| FE-03 | Cohort benchmarking — compare exam performance across sections/cohorts |
| FE-04 | Question versioning — track edits to questions without breaking historical analytics |
| FE-05 | Multi-language support (i18n) for internationalization |
| FE-06 | Mobile-responsive exam taking interface |
| FE-07 | WebSocket-based real-time instructor view of active sessions |
| FE-08 | Automated report generation (PDF export of exam analytics) |
| FE-09 | Human-in-the-loop ML governance — instructor can approve/reject anomaly flags |
| FE-10 | A/B testing of question wordings to improve item quality |

---

*End of Software Requirements Specification — Evalyn v3.0*
*Document Last Updated: 2026-05-09*
*Total Sections: 20 | Total Entities: 13 | Total API Endpoints: 35+ | Total FR/NFR: 40+*
