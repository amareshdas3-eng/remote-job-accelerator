# Remote Job Accelerator (RJA) v4.3 — Implementation Roadmap

**Document Version**: `1.0.0`  
**Application Target**: Customer-Ready Executive AI Career Operating System  
**Implementation Methodology**: Phased, Non-Destructive, Evidence-Driven Engineering  

---

## Roadmap Overview

This roadmap defines the sequential engineering plan required to take **Remote Job Accelerator (RJA) v4.3** from its current partially simulated state to a fully functional, production-grade SaaS.

### Guiding Principles:
1. **Preserve Working Functionality**: Do not discard or rewrite the existing high-value UI workspaces (`UnifiedJobWorkspace`, `KanbanTracker`, `AtsResumeStudio`, `JobDiscovery`).
2. **Fix Foundation First**: Resolve database table privilege errors and data persistence gaps before introducing new external services.
3. **No Decorative Mockups**: Every UI component, button, and field must connect to a genuine backend API and persistent database record.
4. **Verified at Each Phase**: Each phase concludes with automated and manual acceptance criteria that must pass before proceeding.

---

## Phase 0: Baseline & Stabilization (Immediate Remediation)

### Goal
Resolve immediate runtime errors, database permission blocks, and client state bugs that currently break core workflows.

### Work Items:
1. **Database Table Grants Migration**:
   - Create and apply SQL migration granting `ALL` permissions on `jobs`, `interviews`, `rate_limits`, and `extension_oauth_codes` to `service_role` and `authenticated`.
   - Verify that `supabaseAdmin()` can select, insert, update, and delete from `jobs` and `interviews`.
2. **Resume Upload UI State Fix**:
   - Modify `components/Dashboard.tsx:147` to properly preserve the uploaded resume text in state (updating `app/api/resume/upload/route.ts` to return `{ saved: true, filename, text, characters }`).
3. **Rate Limiting Async Await Fix**:
   - Add `await` keyword to all rate limit calls in `/api/ai/job-match`, `/api/ai/resume-tailor`, `/api/ai/cover-letter`, `/api/ai/interview/feedback`, and `/api/ai/outreach`.
4. **Public Health Endpoint Fix**:
   - Update `app/api/health/route.ts` to provide a public, unauthenticated health check verifying database and AI provider connectivity.

### Acceptance Criteria:
- [ ] Direct query on `jobs` using `service_role` returns 200 OK without PostgreSQL error 42501.
- [ ] Uploading a PDF/DOCX/TXT resume in the UI immediately populates the Evidence Vault text box without corruption.
- [ ] AI endpoints return HTTP 429 when rate limit is exceeded.
- [ ] `GET /api/health` returns HTTP 200 `{ status: "ok", database: "connected" }` when called without cookies.

---

## Phase 1: Architecture & Data Foundation

### Goal
Upgrade the database schema to support structured candidate profiles, real job catalogs, and high-performance querying.

### Work Items:
1. **Schema Migration for Structured Profile**:
   - Add `structured_profile jsonb` column to `profiles` table.
2. **Master Job Catalog Table**:
   - Create `discovered_jobs` table to store ingested remote roles separately from user-saved jobs.
   - Columns: `id (uuid PK)`, `external_id (text UK)`, `title`, `company`, `url`, `description`, `salary`, `location`, `remote_status`, `source`, `category`, `skills (text[])`, `published_at`, `created_at`.
3. **Database Performance Indexing**:
   - Add B-tree indexes on `jobs(user_id)`, `jobs(created_at)`, `applications(user_id)`, `applications(job_id)`, `interviews(job_id)`, `discovered_jobs(category)`, and `discovered_jobs(published_at)`.

### Acceptance Criteria:
- [ ] `profiles.structured_profile` column exists and accepts structured career JSON.
- [ ] `discovered_jobs` table exists with unique constraint on `external_id`.
- [ ] Database query execution plan confirms index usage on `jobs(user_id)`.

---

## Phase 2: Authentication & User Profile System

### Goal
Provide a complete, production-grade identity lifecycle and ensure user profile changes persist permanently.

### Work Items:
1. **Structured Profile Persistence**:
   - Update `components/dashboard/StructuredProfile.tsx` to load initial form state from `userProfile.structured_profile`.
   - Update `/api/workflow` and `/api/resume/upload` to persist and return `structured_profile`.
   - Eliminate hardcoded default candidate fallback on page refresh.
2. **Password Reset Workflow**:
   - Create `app/reset-password/page.tsx` with request reset and update password forms using Supabase Auth.
   - Add "Forgot password?" link to `app/login/page.tsx`.
3. **Auth Callback Optimization**:
   - Replace unpaginated `listUsers()` in `app/api/extension/oauth/callback/route.ts` with direct user query.

### Acceptance Criteria:
- [ ] User can edit technical skills, employers, and certifications in Structured Profile, refresh the page, and see all edits intact.
- [ ] User can request a password reset email and set a new password via `/reset-password`.
- [ ] Login screen offers links to both signup and password recovery.

---

## Phase 3: Real Job Ingestion Pipeline

### Goal
Replace the 6 hardcoded static jobs with an automated, live remote job ingestion engine.

### Work Items:
1. **Public Remote Feed Connectors**:
   - Implement ingestion adapters for high-conviction remote job RSS/JSON feeds:
     - RemoteOK API / Feed
     - WeWorkRemotely RSS
     - Arbeitnow Remote Jobs API
2. **Public ATS Board Ingestion**:
   - Implement public board parsers for Greenhouse (`boards-api.greenhouse.io/v1/boards/{board}/jobs`) and Lever (`api.lever.co/v0/postings/{company}`).
3. **Ingestion & Normalization Worker**:
   - Create ingestion worker (`lib/jobs/ingestion.ts`) to fetch feeds, normalize schemas, extract required skills, deduplicate by company/title hash, and upsert to `discovered_jobs`.
4. **Discovery API & UI Upgrade**:
   - Update `/api/jobs/discover` to query `discovered_jobs` with full-text search, pagination, and category filtering.
   - Update `components/dashboard/JobDiscovery.tsx` to render real ingested opportunities.

### Acceptance Criteria:
- [ ] `/api/jobs/discover` returns real, freshly ingested remote opportunities from the database.
- [ ] Ingestion service deduplicates repeat job postings without creating duplicates.
- [ ] Ingested jobs contain accurate company names, direct apply URLs, and salary ranges.

---

## Phase 4: Job Workspace & Canonical Job Management

### Goal
Ensure the canonical `job_id` workflow functions seamlessly from discovery through to application.

### Work Items:
1. **Job Selection & Pipeline Linkage**:
   - Verify `/api/jobs/select` creates a row in `jobs` and an initial row in `applications` with `status: 'selected'`.
   - Ensure the application record correctly references `job_id`.
2. **Custom URL Ingestion Metadata Extraction**:
   - Enhance `/api/jobs/ingest` with an LLM-assisted metadata extractor to parse job title, company, salary, and requirements from raw HTML.
3. **Multi-Job Isolation Verification**:
   - Verify that switching jobs in `OpportunityWorkspace.tsx` cleanly updates all subtabs (Match, Resume, Cover Letter, Interview) without state leakage.

### Acceptance Criteria:
- [ ] Clicking "Select Job" on any opportunity creates a canonical row in `jobs` and updates `activeJobId`.
- [ ] Created application records contain the correct `job_id`, real company name, and real job title.
- [ ] Pasting a job URL automatically extracts the title and company instead of falling back to generic placeholders.

---

## Phase 5: AI Services & Feature Reconnection

### Goal
Connect all AI features to canonical jobs, optimize response latency, and activate the cold outreach engine.

### Work Items:
1. **Re-connect Outreach Engine**:
   - Add `OutreachEngine.tsx` to `UnifiedJobWorkspace.tsx` as a dedicated subtab ("Outreach & Networking").
   - Connect it to active canonical job context and master evidence.
2. **AI Cascade Optimization**:
   - Refine the candidate model pool in `lib/ai.ts` to test primary low-latency models first, reducing failover delays.
   - Add per-request timeouts (`AbortSignal.timeout(10000)`) on outbound AI API calls.
3. **Persistence Verification**:
   - Verify that Fit Intelligence (`jobs.match`), ATS Resume (`jobs.tailored_resume`), Cover Letter (`jobs.cover_letter`), and Interview Coach (`interviews.plan`) persist across browser reloads.

### Acceptance Criteria:
- [ ] Outreach Engine is accessible from the Job Workspace and generates customized LinkedIn invites and InMail pitches.
- [ ] All AI generation results remain visible after full page refresh.
- [ ] AI API requests time out gracefully after 10 seconds if a provider stalls.

---

## Phase 6: Chrome Browser Extension Realization

### Goal
Deliver a working Chrome Extension that captures jobs from active browser tabs and imports them into RJA.

### Work Items:
1. **Configuration Injection**:
   - Configure `extension/popup.js` to dynamically resolve the production application domain.
2. **Active Tab Content Script**:
   - Add a content script (`extension/content.js`) to `manifest.json`.
   - Extract title, company, URL, and job description from the DOM of LinkedIn, Greenhouse, Lever, and Indeed pages.
3. **Extension Import Handler**:
   - Update `/api/extension/import` to accept the parsed job payload, create a canonical job record in `jobs`, and return the `job_id`.
4. **Settings Modal Extension Guide**:
   - Replace the placeholder `alert()` in `Dashboard.tsx` settings modal with a functional extension onboarding guide.

### Acceptance Criteria:
- [ ] Extension successfully extracts job data from an active LinkedIn or Greenhouse tab.
- [ ] Clicking "Capture Job" in the extension sends data to RJA and creates a canonical job record.
- [ ] The captured job appears immediately in the user's RJA Opportunity Workspace.

---

## Phase 7: Notifications & Transactional Communications

### Goal
Provide automated application follow-up reminders and interview rehearsal alerts.

### Work Items:
1. **Transactional Email Provider Integration**:
   - Integrate Resend or Postmark for transactional email delivery.
2. **Application Reminder Engine**:
   - Create a scheduled worker checking for applications in `applied` stage older than 5 days without a follow-up.
   - Send follow-up reminder emails with pre-drafted follow-up templates.
3. **Interview Preparation Alerts**:
   - Send rehearsal reminders when an application moves to `interview` status.

### Acceptance Criteria:
- [ ] Test transactional email sends successfully to user email.
- [ ] Applications marked "Applied" trigger follow-up alerts after the configured threshold.

---

## Phase 8: Testing, QA & Production Hardening

### Goal
Implement automated integration testing and perform full end-to-end user verification.

### Work Items:
1. **True Integration Test Suite**:
   - Set up Vitest for unit and API route integration tests.
   - Add tests for document extraction, rate limiting, authentication, and AI parsing.
2. **End-to-End User Flow Tests**:
   - Implement Playwright E2E tests covering: Signup → Resume Upload → Job Discovery → Select Job → Match Analysis → Tailor Resume → Save to Pipeline → Stage Transition.
3. **Security Audit & Secrets Verification**:
   - Verify all production secrets in `.env.local` and deployment platform.
   - Confirm strict RLS boundary enforcement between separate user accounts.

### Acceptance Criteria:
- [ ] `npm test` executes real integration tests verifying API and database logic.
- [ ] Playwright E2E suite passes cleanly in headless mode.
- [ ] Multi-tenant isolation test proves User A cannot read User B's jobs or resumes.

---

## Recommended Execution Order

```text
Phase 0: Baseline & Stabilization (Fix DB grants, upload bug, rate limiter awaits)
  ↓
Phase 1: Architecture & Data Foundation (Schema upgrades, discovered_jobs table)
  ↓
Phase 2: Authentication & User Profile System (Structured profile persistence, reset password)
  ↓
Phase 3: Real Job Ingestion Pipeline (RSS feeds, ATS APIs, discovery engine)
  ↓
Phase 4: Job Workspace & Canonical Job Management (URL metadata extraction, selection)
  ↓
Phase 5: AI Services & Feature Reconnection (Outreach UI, latency optimization)
  ↓
Phase 6: Chrome Browser Extension Realization (DOM content script, real capture)
  ↓
Phase 7: Notifications & Transactional Communications (Email alerts)
  ↓
Phase 8: Testing, QA & Production Hardening (Vitest, Playwright, final security drill)
```
