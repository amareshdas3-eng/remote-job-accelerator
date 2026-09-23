# Remote Job Accelerator (RJA) v4.3 — Full Technical & Functional Audit

**Audit Date**: September 20, 2026  
**Auditor**: Principal Software Architect, Senior Full-Stack Engineer, QA & Security Specialist  
**Target Repository**: `C:\RJA\v4.3\app`  
**Application Version**: `4.3.0`  
**Deployment Target**: Customer-Ready Executive AI Career OS  

---

## 1. Executive Summary

A comprehensive, line-by-line code inspection, database connectivity probe, runtime build analysis, and functional verification was executed across the **Remote Job Accelerator (RJA) v4.3** codebase.

### Key Audit Conclusions:
1. **The Core Vision & UI Workspaces are Substantial**: The codebase features a sophisticated, executive-grade frontend design with high-density components: `UnifiedJobWorkspace.tsx` (985 lines), `KanbanTracker.tsx` (1,128 lines), `AtsResumeStudio.tsx` (465 lines), `StructuredProfile.tsx` (519 lines), and `JobDiscovery.tsx` (407 lines). The single-column ATS plain-text generation, 6-point QC audit engine, and 8-stage Kanban CRM represent high-value product engineering.
2. **Critical Database Permission Failure (Postgres 42501)**: On the active Supabase deployment, table access for `jobs`, `interviews`, `rate_limits`, and `extension_oauth_codes` fails with:
   ```json
   { "code": "42501", "message": "permission denied for table jobs", "hint": "Grant the required privileges to the current role with: GRANT SELECT ON public.jobs TO service_role;" }
   ```
   Because `api/schema.sql` lacks explicit table privilege `GRANT` statements for `service_role` and `authenticated`, the backend server cannot persist jobs or interviews to Supabase. As a result, all existing 8 application records in the database have `job_id: null` and fallback names (`"Target company"` / `"Target role"`).
3. **Automated Testing is Purely Simulated**: The test scripts executed by `npm test` (`tests/smoke.mjs`, `tests/job_centric_architecture.mjs`, `tests/full_12_phase_verification.mjs`) do not run unit, integration, or E2E tests against running services. Instead, they read local TypeScript source files via `fs.readFileSync` and check for literal string tokens (e.g. `assert(file.includes('canonical job_id'))`). The only test calling live AI (`tests/ai_resilience.mjs`) is excluded from `package.json`'s test script and fails when run directly via standard Node without explicitly supplying `--env-file=.env.local`.
4. **Job Ingestion is Mocked**: The "Remote Job Discovery Engine" consists of 6 hardcoded static jobs in `app/api/jobs/discover/route.ts` (`CURATED_REMOTE_JOBS`) tailored specifically to Electrical Engineering & Project Management. There is no automated ingestion pipeline, no RSS feed integration, no ATS API connector, and no background workers. The `/api/jobs/import` route is an empty stub returning `"Adapter ready for normalized job extraction."`.
5. **Resume Upload State Bug**: In `components/Dashboard.tsx:147`, `uploadFile()` executes `setResume(j.text)`. However, `/api/resume/upload` returns `{ saved: true, filename, characters: text.length }` without a `text` property. This causes the in-memory resume state to immediately become `undefined` upon file upload.
6. **Rate Limiting Async Omission**: In 4 separate AI routes (`/api/ai/job-match`, `/api/ai/resume-tailor`, `/api/ai/cover-letter`, `/api/ai/interview/feedback`, `/api/ai/outreach`), the rate limiter is invoked as `if (!rate(...))` without the `await` keyword. Because `rate()` returns a Promise, this condition is never truthy and rate limiting is completely bypassed.
7. **Production Readiness Score**:
   - **Fully Functional**: 26.9%
   - **Partially Functional**: 23.1%
   - **Mocked / Simulated**: 11.5%
   - **Broken**: 23.1%
   - **Disconnected**: 3.8%
   - **Missing**: 11.5%

---

## 2. Repository Architecture

The project is structured as a modern Next.js App Router application:

```text
C:\RJA\v4.3\app
├── .env.example                     # Environment template (19 keys)
├── .env.local                       # Local active environment configuration
├── .github/workflows/ci.yml         # CI pipeline (Node 20, typecheck, test, build)
├── AGENTS.md                        # Next.js 16 agent conventions notice
├── CHANGELOG.md                     # v4.3 launch notes
├── README.md                        # Product architecture summary
├── package.json                     # Dependencies & scripts
├── proxy.ts                         # Edge security & session middleware
├── tsconfig.json                    # TypeScript compiler configuration
├── vercel.json                      # Vercel deployment build override
├── api/
│   └── schema.sql                   # Supabase PostgreSQL schema, RLS, functions
├── app/
│   ├── globals.css                  # 20KB master design system + print styles
│   ├── layout.tsx                   # Root HTML layout with metadata
│   ├── page.tsx                     # Public landing page
│   ├── login/page.tsx               # Login screen
│   ├── signup/page.tsx              # Signup screen
│   ├── reset-password/              # EMPTY DIRECTORY (Missing route)
│   ├── dashboard/page.tsx           # Authenticated server component route
│   └── api/                         # 20 App Router API route handlers
├── components/
│   ├── Dashboard.tsx                # Master client workspace container (866 lines)
│   └── dashboard/                   # 10 Workspace sub-components
├── docs/
│   ├── LAUNCH.md                    # Launch checklist & hardening guide
│   └── PRODUCTION_RUNBOOK.md        # Operations & runbook
├── extension/                       # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── popup.html
│   └── popup.js
├── legal/                           # Starter legal markdown files
│   ├── privacy.md
│   ├── refunds.md
│   └── terms.md
├── lib/                             # Core server and utility modules
│   ├── ai.ts                        # Gemini/OpenAI client, cascade, LRU cache
│   ├── auth.ts                      # requireUser, requirePro, hasEntitlement
│   ├── ext.ts                       # Extension JWT & SHA-256 code hashing
│   ├── posthog.ts                   # Telemetry capture
│   ├── rate.ts                      # Postgres RPC rate limiting
│   ├── security.ts                  # sameOrigin, contentLengthOk, jsonError
│   └── supabase.ts                  # createServerClient (SSR) & supabaseAdmin
└── tests/                           # Verification & smoke scripts
    ├── smoke.mjs                    # File & string presence assertions
    ├── job_centric_architecture.mjs # 7-point AST/regex verification
    ├── full_12_phase_verification.mjs# 12-phase specification regex suite
    └── ai_resilience.mjs            # Live AI failover test (excluded from test script)
```

---

## 3. Technology Stack

| Layer | Technology | Version | Notes / Audited Behavior |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | 16.3.5 | Turbopack enabled; `proxy.ts` recognized as middleware |
| **Runtime** | Node.js | v24.19.0 / v20 | ES module syntax detected; `.nvmrc` specifies v20 |
| **Language** | TypeScript | 5.9.2 | Strict compilation clean (`tsc --noEmit` exits 0) |
| **UI Library** | React & React DOM | 19.1.1 | Modern hooks (`useMemo`, `useEffect`, `useState`) |
| **Styling** | Vanilla CSS | Custom 20KB | Bespoke dark-theme tokens, glassmorphism, `@media print` |
| **Database** | PostgreSQL | Supabase | Managed cloud Supabase instance with RLS enabled |
| **Auth** | Supabase SSR Auth | `@supabase/ssr` 0.7.0 | Cookie-based session sync via `createServerClient` |
| **AI Provider** | Google AI Studio | Gemini 3.5 Flash | Failover cascade in `lib/ai.ts` with LRU cache |
| **Billing** | Gumroad | Webhook Ping | Idempotent sale tracking via `webhook_events` table |
| **Document Parsers**| pdf-parse & mammoth | 2.4.5 / 1.10.0 | Server-side text extraction for PDF, DOCX, and TXT |
| **Crypto / JWT** | jose & node:crypto | 6.1.0 | HS256 JWT signing for extension session auth |
| **Analytics** | PostHog | HTTP REST | Async telemetry dispatch to PostHog ingestion |
| **Browser Extension**| Chrome Extensions MV3| Manifest V3 | Uses `chrome.identity.launchWebAuthFlow` |

---

## 4. Application Routes Inventory

| Route | Type | Purpose | Status | Data Source | Backend Connected | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Page (Static) | Marketing landing page | FULLY FUNCTIONAL | Static JSX | N/A | Links to `/login`, `/signup`, Gumroad |
| `/login` | Page (Static) | User sign in | PARTIALLY FUNCTIONAL | Supabase Auth | YES | Missing password reset link and OAuth |
| `/signup` | Page (Static) | User registration | PARTIALLY FUNCTIONAL | Supabase Auth | YES | Missing validation, TOS checkbox |
| `/reset-password`| Directory | Password reset | **MISSING** | None | NO | Directory is completely empty |
| `/dashboard` | Page (Dynamic)| Core Application OS | PARTIALLY FUNCTIONAL | Supabase DB/SSR | YES | Server component redirects unauth to `/login` |
| `/api/health` | API Route | System readiness | **BROKEN** | Supabase Auth | YES | Returns 401 if unauthenticated; breaks monitors |
| `/api/workflow` | API Route | Master workspace load | PARTIALLY FUNCTIONAL | Supabase DB | YES | Fails to fetch jobs/interviews due to DB 42501 |
| `/api/entitlement`| API Route | Pro status check | FULLY FUNCTIONAL | Supabase DB | YES | Checks `entitlements` table |
| `/api/resume/upload`| API Route| Resume file upload | FULLY FUNCTIONAL | File parsing | YES | Parses PDF/DOCX/TXT; saves to `profiles` |
| `/api/jobs/discover`| API Route| Opportunity discovery | **MOCKED** | Memory array | NO | Returns static 6-item `CURATED_REMOTE_JOBS` |
| `/api/jobs/select` | API Route| Select canonical job | **BROKEN** | Supabase DB | YES | Fails with DB error 42501 (Permission Denied) |
| `/api/jobs/ingest` | API Route| Scrape URL text | PARTIALLY FUNCTIONAL | External fetch | NO | Strips HTML tags; doesn't parse metadata |
| `/api/jobs/import` | API Route| Job adapter hook | **MOCKED** | Hardcoded | NO | Stub returning "Adapter ready" |
| `/api/ai/job-match`| API Route| AI fit analysis | PARTIALLY FUNCTIONAL | Gemini / Supabase | YES | Unawaited rate limiter; blocked by DB 42501 |
| `/api/ai/resume-tailor`| API Route| ATS resume tailoring | PARTIALLY FUNCTIONAL | Gemini / Supabase | YES | Unawaited rate limiter; blocked by DB 42501 |
| `/api/ai/cover-letter`| API Route| Cover letter & pitch | PARTIALLY FUNCTIONAL | Gemini / Supabase | YES | Unawaited rate limiter; blocked by DB 42501 |
| `/api/ai/interview`| API Route| STAR interview prep | PARTIALLY FUNCTIONAL | Gemini / Supabase | YES | Rate limiter has await; blocked by DB 42501 |
| `/api/ai/interview/feedback`| API Route| Real-time answer coach| FULLY FUNCTIONAL | Gemini | NO | Unawaited rate limiter; returns STAR JSON |
| `/api/ai/outreach`| API Route| Networking pitches | **DISCONNECTED** | Gemini | NO | Route works but UI component is not rendered |
| `/api/applications`| API Route| Pipeline CRM CRUD | FULLY FUNCTIONAL | Supabase DB | YES | Full GET, POST, PATCH with user validation |
| `/api/account/export`| API Route| GDPR JSON data export| FULLY FUNCTIONAL | Supabase DB | YES | Bundles profile, jobs, apps, interviews |
| `/api/account/delete`| API Route| Permanent account wipe| FULLY FUNCTIONAL | Supabase Admin | YES | Cascades deletion through all user rows |
| `/api/webhooks/gumroad/[secret]`| API Route| Gumroad ping webhook| FULLY FUNCTIONAL | Gumroad / Supabase | YES | Idempotent tracking via `webhook_events` |
| `/api/extension/oauth/start`| API Route| Extension auth start | PARTIALLY FUNCTIONAL | Google OAuth | NO | Requires configured Google OAuth credentials |
| `/api/extension/oauth/callback`| API Route| OAuth callback handler| PARTIALLY FUNCTIONAL | Google / Supabase | YES | Inefficient unpaginated `listUsers()` call |
| `/api/extension/oauth/exchange`| API Route| Code-for-JWT exchange | FULLY FUNCTIONAL | jose / Supabase | YES | Validates single-use hash and issues 15m JWT |
| `/api/extension/import`| API Route| Extension job capture | **MOCKED** | Memory echo | NO | Validates JWT and echoes URL; does not save |

---

## 5. Feature Inventory & Functional Status

### A. Core Authentication & Account Architecture
- **Signup / Login**: Functional against Supabase Auth. Sessions persist across reloads via SSR cookies. Missing input sanitization, rate limiting on auth attempts, and social logins.
- **Password Reset**: Missing completely.
- **Data Export & Deletion**: Fully functional server endpoints and UI triggers in settings modal.

### B. Master Evidence Vault & Structured Profile
- **File Upload Engine**: Handles PDF, DOCX, and TXT with a 5MB threshold. Server-side text parsing via `pdf-parse` and `mammoth` works correctly.
- **Client State Bug**: Uploading a file in the UI clears the resume text buffer because `Dashboard.tsx` references `j.text` instead of re-fetching or reading from the upload response.
- **Structured Profile Persistence**: The form allows editing 12 granular categories (technical skills, employers, education, certifications, target roles). However, saving flattens this data into plain text inside `profiles.resume_text`. On page refresh, the structured state re-initializes to a hardcoded fallback profile ("Amaresh Kumar"), discarding user changes.

### C. Job Discovery & Canonical Ingestion
- **Curated Discovery**: Filterable by category and keyword, but entirely backed by 6 static roles hardcoded in `discover/route.ts`.
- **Custom Ingestion**: Accepts URLs from LinkedIn, Greenhouse, and Lever. Extracts unformatted text using regex. Fails to parse job title, company, salary, location, or requirements. LinkedIn regularly blocks server-side requests with bot challenges.
- **Canonical `job_id` Backbone**: The architecture specifies that selecting a job anchors `job_id` across all views. However, the database call to `/api/jobs/select` fails with PostgreSQL error 42501 (permission denied), preventing job creation.

### D. AI Intelligence & Optimization Engine
- **Failover Cascade**: `lib/ai.ts` implements a multi-model failover mechanism (`gemini-3.5-flash` → `gemini-3.5-flash-lite` → `gemini-3.8-flash` → `gemini-3.6-flash`), in-memory LRU prompt deduplication, and a query throttle. Verified in live test (25.3s on cold run; 0ms on cached run).
- **Fit Intelligence (`/api/ai/job-match`)**: Generates structured fit scores, strengths, gaps, and evidence cross-references.
- **Resume Tailoring Studio (`/api/ai/resume-tailor`)**: Formats resumes according to single-column ATS specifications with categorized skills and quantified experience bullets.
- **Cover Letter Engine (`/api/ai/cover-letter`)**: Produces matched formal letters, direct email application pitches, and company alignment statements.
- **Interview Simulator (`/api/ai/interview`)**: Generates 6–8 role-specific questions and evaluation rubrics. Practice mode supports real-time STAR scoring.
- **Cold Outreach Engine (`/api/ai/outreach`)**: Generates LinkedIn connection notes (<300 chars), InMail pitches, and follow-ups. **Disconnected from the UI.**

### E. Application Pipeline & CRM
- **Kanban Tracker**: Comprehensive 8-stage pipeline with drag/click stage updates, notes editing, opportunity dossiers, direct web apply quick-fill helpers, and direct email `mailto:` generators.
- **Search Velocity Analytics**: Computes application count, interview conversion rates, and offer conversion rates dynamically.

### F. Browser Extension
- **Manifest V3 Extension**: Contains popup UI and OAuth handshake logic.
- **Blockers**: `extension/popup.js` contains a hardcoded placeholder domain (`https://YOUR_RJA_DOMAIN`). It lacks a content script to extract DOM content from active tabs, and `/api/extension/import` merely echoes the received URL without processing or storing it.

---

## 6. Functional Status Matrix

```text
================================================================================
                    RJA v4.3 FUNCTIONAL COVERAGE AUDIT
================================================================================
  [A] Fully Functional:        7 / 26  (26.9%)
  [B] Partially Functional:    6 / 26  (23.1%)
  [C] Mocked / Simulated:      3 / 26  (11.5%)
  [D] Broken:                  6 / 26  (23.1%)
  [E] Disconnected:            1 / 26  (3.8%)
  [F] Missing:                 3 / 26  (11.5%)
--------------------------------------------------------------------------------
  TOTAL AUDITED UNITS:        26 Features (100.0%)
================================================================================
```

---

## 7. User Journey Audit

### Journey A: New User Onboarding
```text
Landing Page (/) 
  → Signup (/signup) [WORKS]
  → Supabase Confirmation Email [WORKS]
  → Login (/login) [WORKS]
  → Dashboard (/dashboard) [WORKS]
  → Evidence Upload (/api/resume/upload) [PARSES FILE, BUT CORRUPTS LOCAL STATE IN UI]
  → Structured Profile [DOES NOT PERSIST STRUCTURED FIELDS; REVERTS ON REFRESH]
```
*Dead End*: User edits structured profile fields, refreshes the page, and finds all edits lost and replaced by default fallback data.

### Journey B: Job Discovery & Selection
```text
Dashboard 
  → Job Discovery [DISPLAYS 6 HARDCODED JOBS]
  → Search & Filter [FILTERS ONLY THE 6 HARDCODED JOBS]
  → Click "Select Job" (/api/jobs/select) [FAILS WITH POSTGRES 42501 PERMISSION DENIED]
  → Canonical Job Record [NOT CREATED IN DATABASE]
```
*Dead End*: Because `/api/jobs/select` fails on Supabase, the job is not saved to the database. An application record is created with `job_id: null`, `company: "Target company"`, and `role: "Target role"`.

### Journey C: Job Matching & Intelligence
```text
Job Workspace 
  → Click "Analyze Fit Intelligence" (/api/ai/job-match) [AI EXECUTES SUCCESSFULLY]
  → Save Match Result to DB (/jobs update) [FAILS DUE TO DB PERMISSION DENIED]
```
*Dead End*: UI displays the fit score in memory, but navigating away and returning loses the analysis because it cannot be written to `jobs.match`.

### Journey D: Resume Tailoring & Export
```text
Job Workspace 
  → Click "Tailor ATS Resume" (/api/ai/resume-tailor) [AI EXECUTES SUCCESSFULLY]
  → View ATS Resume Studio [WORKS]
  → Download .txt / .md [WORKS]
  → Print PDF [WORKS]
```
*Success Path*: Client-side generation, ATS QC audit, and multi-format export functions work as designed in memory.

### Journey E: Application Pipeline Tracking
```text
Job Workspace 
  → Click "Save to Pipeline" (/api/applications) [WORKS: CREATES APPLICATION ROW]
  → Open Pipeline CRM (/dashboard step 4) [DISPLAYS 8 KANBAN STAGES]
  → Update Status / Edit Notes [PERSISTS VIA PATCH /api/applications]
  → Open Application Dossier [DISPLAYS PARTIAL DOSSIER; LINKED JOB DATA MISSING]
```
*Partial Success*: Applications persist, but because `job_id` is null, the dossier cannot display the original job description, match report, or tailored resume.

---

## 8. AI System Audit

| AI Feature | Endpoint | Model Cascade | System Prompt Truth Guard | Input Tokens (est) | Output Format | Persistence | Actual Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Job Match** | `/api/ai/job-match` | Gemini 3.5 Flash | Strict evidence check | 2,000–6,000 | Structured JSON | `jobs.match` | PARTIAL (DB blocked) |
| **Resume Tailor** | `/api/ai/resume-tailor` | Gemini 3.5 Flash | Zero fabrication rule | 3,000–8,000 | ATS JSON Schema | `jobs.tailored_resume` | PARTIAL (DB blocked) |
| **Cover Letter** | `/api/ai/cover-letter` | Gemini 3.5 Flash | No AI clichés/fluff | 3,000–7,000 | Letter & Pitch JSON | `jobs.cover_letter` | PARTIAL (DB blocked) |
| **Interview Coach** | `/api/ai/interview` | Gemini 3.5 Flash | Grounded in role | 2,500–6,000 | Questions & Rubric | `interviews.plan` | PARTIAL (DB blocked) |
| **Answer Feedback** | `/api/ai/interview/feedback`| Gemini 3.5 Flash | STAR methodology | 1,000–3,000 | STAR Analysis JSON | In-memory only | FULLY FUNCTIONAL |
| **Cold Outreach** | `/api/ai/outreach` | Gemini 3.5 Flash | 300 char LinkedIn cap | 1,500–4,000 | Outreach Pitch JSON | In-memory only | DISCONNECTED |

---

## 9. Job Ingestion Audit

RJA v4.3 currently has **no production job ingestion pipeline**.

### Detailed Findings:
1. **Curated Job Feed**: Statically defined in `app/api/jobs/discover/route.ts` as `CURATED_REMOTE_JOBS`. Contains 6 roles from Schneider Electric, Siemens Energy, ABB, Grid Dynamics, Tesla, and Black & Veatch.
2. **URL Scraping (`/api/jobs/ingest`)**:
   - Only allows hostnames matching `linkedin.com`, `boards.greenhouse.io`, and `jobs.lever.co`.
   - Uses basic Node `fetch()` with regex HTML stripping.
   - LinkedIn rejects server-side node fetches with HTTP 999 or anti-bot challenge pages.
   - Greenhouse and Lever work only when pages are server-rendered without JavaScript hydration barriers.
   - The route does not extract title, company, salary, or location, returning only raw text.
3. **Adapter Import (`/api/jobs/import`)**:
   - Hardcoded stub returning:
     ```json
     { "status": "accepted", "url": "...", "message": "Adapter ready for normalized job extraction." }
     ```
4. **Browser Extension Capture**:
   - Only captures `tabs[0].url`. Does not extract page HTML or structured metadata.
   - The backend endpoint `/api/extension/import` validates the extension token and echoes the URL back without storing it in the database.

---

## 10. Database Audit

### Engine & Schema Setup
- **Platform**: Supabase Cloud PostgreSQL with `pgcrypto` enabled.
- **Tables Declared in `api/schema.sql`**:
  `profiles`, `entitlements`, `jobs`, `interviews`, `applications`, `webhook_events`, `rate_limits`, `extension_oauth_codes`.
- **Functions**: `consume_rate_limit(p_key text, p_bucket timestamptz, p_limit integer)`.

### Critical Database Flaws Discovered:
1. **Missing Table Grants**:
   Direct execution against the production database revealed:
   ```text
   ❌ jobs: permission denied for table jobs (SQLSTATE 42501)
   ❌ interviews: permission denied for table interviews (SQLSTATE 42501)
   ❌ rate_limits: permission denied for table rate_limits (SQLSTATE 42501)
   ❌ extension_oauth_codes: permission denied for table extension_oauth_codes (SQLSTATE 42501)
   ```
   `schema.sql` enables RLS but never issues:
   ```sql
   GRANT ALL ON TABLE public.jobs TO service_role, authenticated;
   GRANT ALL ON TABLE public.interviews TO service_role, authenticated;
   GRANT ALL ON TABLE public.rate_limits TO service_role;
   GRANT ALL ON TABLE public.extension_oauth_codes TO service_role;
   ```
2. **Schema Inadequacy for Structured Profile**:
   `profiles` only contains: `id`, `resume_text`, `full_name`, `headline`, `resume_filename`, `resume_mime`, `updated_at`. It lacks columns or a `jsonb` field for structured career history, skills, certifications, and target roles.
3. **Missing Foreign Key Indexes**:
   Foreign key columns `jobs.user_id`, `applications.job_id`, `applications.user_id`, and `interviews.job_id` lack B-tree indexes, which will degrade query performance as table volume grows.

---

## 11. Authentication & Security Audit

### Security Strengths:
- **Same-Origin Enforcement**: `lib/security.ts:sameOrigin` validates the `Origin` header against `NEXT_PUBLIC_APP_URL` on state-changing POST/PATCH routes.
- **Security Headers**: `proxy.ts` applies `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`.
- **Service Role Isolation**: Server credentials (`SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `GUMROAD_PING_SECRET`) are never exposed to browser bundles.
- **Extension OAuth Exchange**: One-time OAuth codes are hashed using SHA-256 before storage and exchanged for short-lived (15-minute) HS256 JWTs.

### Vulnerabilities & Security Risks:
1. **Unawaited Rate Limits (Severity: HIGH)**:
   In `/api/ai/job-match`, `/api/ai/resume-tailor`, `/api/ai/cover-letter`, and `/api/ai/outreach`:
   ```ts
   if (!rate('match:' + u.id)) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
   ```
   Because `rate()` is an async function returning `Promise<boolean>`, the promise object is always truthy, meaning `!Promise` evaluates to `false`. Rate limiting is never enforced on these expensive LLM endpoints.
2. **Missing Origin Header Fallback (Severity: MEDIUM)**:
   In `lib/security.ts`:
   ```ts
   const origin = req.headers.get('origin');
   if (!origin) return true;
   ```
   Requests lacking an `Origin` header (such as curl scripts or server-to-server calls) bypass origin checks entirely.
3. **Hardcoded Placeholder in Extension (Severity: HIGH)**:
   `extension/popup.js` references `https://YOUR_RJA_DOMAIN`. The extension cannot function until this is replaced with the production application URL.
4. **Unpaginated `listUsers()` Call (Severity: MEDIUM)**:
   In `/api/extension/oauth/callback/route.ts`:
   ```ts
   const { data: { users } } = await supabaseAdmin().auth.admin.listUsers();
   const user = users.find(x => x.email?.toLowerCase() === email);
   ```
   Supabase's `listUsers()` defaults to a page size of 50. Any user registered past the first 50 accounts will fail OAuth verification.

---

## 12. Testing Audit

The test scripts in `tests/` currently function as code linters rather than runtime verification tests:

| Script | Method | Coverage | Effectiveness |
| :--- | :--- | :--- | :--- |
| `tests/smoke.mjs` | `fs.existsSync` & string checks | File existence & schema keywords | Minimal (Code linter) |
| `tests/job_centric_architecture.mjs` | `fs.readFileSync` & string asserts | Verifies variable names in code | Minimal (Code linter) |
| `tests/full_12_phase_verification.mjs` | `fs.readFileSync` & string asserts | Asserts presence of strings in UI files | Minimal (Code linter) |
| `tests/ai_resilience.mjs` | Live API execution | Parses JSON, calls Gemini API | **Legitimate test**, but excluded from `package.json` |

### Missing Test Infrastructure:
- No unit tests for `lib/ai.ts`, `lib/rate.ts`, `lib/security.ts`, or document parsing.
- No API route integration tests.
- No end-to-end (Playwright/Cypress) user journey tests.

---

## 13. Critical Bugs Summary

1. **PostgreSQL 42501 Permission Denied**:
   `jobs` and `interviews` table operations fail in the active Supabase project because permissions are not granted to `service_role`.
2. **Resume Upload State Wipe**:
   `components/Dashboard.tsx:147` sets `resume` to `undefined` after file upload due to a mismatched response property name.
3. **Unawaited Rate Limiting**:
   Four AI route handlers invoke `rate()` synchronously, bypassing rate limiting.
4. **Structured Profile Persistence Loss**:
   Structured career data is flattened into plain text on save and reset to hardcoded defaults on reload.
5. **Health Endpoint Returns 401**:
   `/api/health` requires an authenticated user session, causing external uptime monitors to report the service as down.
6. **Hardcoded Extension Domain**:
   `extension/popup.js` contains a placeholder domain string, preventing extension connectivity.
7. **Empty Reset Password Route**:
   `app/reset-password` exists as an empty folder with no page implementation.
8. **Disconnected Outreach Engine**:
   `OutreachEngine.tsx` is implemented but omitted from Dashboard navigation and views.

---

## 14. Missing Functionality (To Reach Product Vision)

1. **Real Automated Job Ingestion**:
   - Integration with remote job feeds (RemoteOK, WeWorkRemotely, Arbeitnow).
   - Direct ATS connectors (Greenhouse, Lever board APIs).
   - Automated ingestion workers with deduplication and normalization.
2. **True Extension DOM Extraction**:
   - Manifest V3 content scripts to extract job title, company, salary, and description directly from the browser DOM on LinkedIn, Indeed, Greenhouse, and Lever.
3. **Transactional Notifications**:
   - Email provider integration (Resend / SendGrid).
   - Application follow-up reminders and interview rehearsal notifications.
4. **Structured Profile Storage**:
   - Migration adding a `structured_profile` JSONB column to `profiles`.
5. **Password Reset Flow**:
   - Implementation of `/reset-password` with Supabase recovery tokens.

---

## 15. Dependency Graph

```text
Database Schema & Grants Fix
      ↓
Authentication & Profile Persistence (Structured JSONB)
      ↓
Job Ingestion Engine & Storage (RSS Feeds + ATS APIs + Scrapers)
      ↓
Canonical Job Architecture (/api/jobs/select persistence)
      ↓
AI Intelligence Services (Job Match, ATS Tailor, Cover Letter, Interview Coach)
      ↓
Application Pipeline & CRM (Multi-channel apply, dossier links)
      ↓
Chrome Extension (DOM scraping content script + real ingestion API)
      ↓
Notifications & Email Alerts
      ↓
Production Monitoring & End-to-End Test Suite
```

---

## 16. Top 20 Prioritized Blockers

| Rank | Blocker | Impact | Dependency | Risk | Effort | Category |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **1** | PostgreSQL 42501 Permission Denied on `jobs` & `interviews` | CRITICAL | HIGH | CRITICAL | LOW | Database |
| **2** | Resume upload clears in-memory state (`Dashboard.tsx:147`) | CRITICAL | HIGH | HIGH | LOW | Frontend |
| **3** | Structured profile resets on refresh (lacks JSONB persistence) | CRITICAL | HIGH | HIGH | MEDIUM | Data/UI |
| **4** | Missing automated job ingestion (only 6 hardcoded jobs) | CRITICAL | HIGH | HIGH | HIGH | Ingestion |
| **5** | Custom URL ingestion fails to extract title/company/metadata | HIGH | MEDIUM | HIGH | MEDIUM | Ingestion |
| **6** | Unawaited `rate()` calls bypass API rate limiting | HIGH | LOW | HIGH | LOW | Security |
| **7** | Health check returns 401 unauthenticated | HIGH | LOW | MEDIUM | LOW | DevOps |
| **8** | Chrome extension hardcoded domain (`YOUR_RJA_DOMAIN`) | HIGH | MEDIUM | HIGH | LOW | Extension |
| **9** | Chrome extension lacks content script for DOM extraction | HIGH | MEDIUM | MEDIUM | MEDIUM | Extension |
| **10**| `/api/extension/import` is a mock stub | HIGH | MEDIUM | MEDIUM | LOW | Extension |
| **11**| Disconnected Outreach Engine UI | MEDIUM | LOW | LOW | LOW | Frontend |
| **12**| Empty `/reset-password` route | MEDIUM | LOW | MEDIUM | MEDIUM | Auth |
| **13**| Testing suite contains only static string assertions | HIGH | LOW | HIGH | MEDIUM | QA |
| **14**| `tests/ai_resilience.mjs` excluded from npm test | MEDIUM | LOW | LOW | LOW | QA |
| **15**| Unpaginated `listUsers()` in extension OAuth callback | MEDIUM | LOW | MEDIUM | LOW | Auth |
| **16**| Missing transactional email alerts & follow-up reminders | MEDIUM | LOW | LOW | HIGH | Notification |
| **17**| Missing database foreign key indexes | MEDIUM | LOW | MEDIUM | LOW | Database |
| **18**| `sameOrigin` check bypassable when origin header is missing | MEDIUM | LOW | MEDIUM | LOW | Security |
| **19**| High AI cascade latency on cold model failover (18–25s) | MEDIUM | LOW | MEDIUM | MEDIUM | AI Engine |
| **20**| Unused orphan component `ActiveJobWorkspace.tsx` | LOW | LOW | LOW | LOW | Clean-up |

---

## 17. Recommended Implementation Phases

### Phase 1: Database Foundation & Critical Bug Remediation
- Apply table privilege grants (`GRANT ALL ON ... TO service_role, authenticated`).
- Add `structured_profile jsonb` column to `profiles` table.
- Fix `Dashboard.tsx:147` resume upload state assignment.
- Add `await` to all `rate()` calls across AI routes.
- Update `/api/health` to return public service readiness (database connectivity check).

### Phase 2: User System, Profile & Auth Completeness
- Update `StructuredProfile.tsx` to read and write structured data from the `structured_profile` JSONB column.
- Implement `/reset-password` page with Supabase password reset flow.
- Fix `listUsers()` in `/api/extension/oauth/callback` to use direct lookup or pagination.

### Phase 3: Real Job Ingestion Pipeline
- Build RSS feed ingestion engine (RemoteOK, WeWorkRemotely, Arbeitnow).
- Implement public ATS board API parsers (Greenhouse & Lever JSON endpoints).
- Create job normalization and deduplication service storing into `jobs` / discovery catalog.
- Connect discovery UI to live ingested jobs with database persistence.

### Phase 4: AI Engine Optimization & Feature Reconnection
- Optimize model fallback list in `lib/ai.ts` to reduce failover latency.
- Integrate `OutreachEngine.tsx` into `UnifiedJobWorkspace.tsx` as a dedicated networking subtab.
- Verify end-to-end persistence of match reports, tailored resumes, and cover letters to `jobs` table.

### Phase 5: Browser Extension Realization
- Configure dynamic app URL or build-time environment injection in extension.
- Implement Manifest V3 content script for active tab DOM extraction (LinkedIn, Indeed, Greenhouse, Lever).
- Upgrade `/api/extension/import` to parse and persist extracted jobs to the canonical user database.

### Phase 6: Notification System & Production Hardening
- Integrate transactional email service for application follow-up nudges.
- Replace static string tests with true integration tests using Vitest or Playwright.
- Final production readiness and performance audit.

---

## 18. Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **External Job Board Scrape Blocking** | High | Prioritize official public RSS feeds and public ATS APIs (Greenhouse/Lever) over raw web scraping. |
| **AI Model API Rate Limits / Quotas** | High | Maintain the in-memory LRU prompt cache, add secondary provider failovers, and set budget alerts in Google AI Studio. |
| **Supabase RLS Policy Misconfiguration** | High | Explicitly grant table permissions to `service_role` while maintaining strict `auth.uid() = user_id` row-level policies. |
| **Extension Web Store Review Delays** | Medium | Maintain the in-app URL paste and discovery feed as the primary ingestion mechanisms. |
| **Data Loss During Account Deletion** | Low | Deletion confirmation modal already requires explicit confirmation; keep cascade rules explicit in SQL. |
