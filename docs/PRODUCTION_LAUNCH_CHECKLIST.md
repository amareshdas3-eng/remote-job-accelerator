# Remote Job Automator (RJA) v4.3 — Production Launch Checklist & Runbook

This document is the definitive operational runbook for executing the live commercial launch of **Remote Job Automator (RJA) v4.3**.

---

## 1. Production Hosting & Domain (Vercel)

- [x] **Framework Preset**: Next.js (defined in `vercel.json`).
- [x] **Build & Start Commands**:
  - `buildCommand`: `npm run build`
  - `installCommand`: `npm install --no-audit --no-fund`
- [ ] **Custom Domain Setup**:
  - Add production domain (e.g., `app.yourdomain.com`) in Vercel Dashboard -> Project Settings -> Domains.
  - Configure DNS A / CNAME records as instructed by Vercel.
  - Set `NEXT_PUBLIC_APP_URL=https://app.yourdomain.com` in Vercel Environment Variables.
- [x] **Edge Security Headers**:
  - `Content-Security-Policy`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `x-request-id` correlation header injected on every request via `proxy.ts`.

---

## 2. Supabase Production Infrastructure

- [x] **Row Level Security (RLS)**:
  - Enabled across all tables: `profiles`, `jobs`, `interviews`, `applications`, `entitlements`, `webhook_events`, `discovered_jobs`, `rate_limits`, `extension_oauth_codes`.
  - Service-role only boundary enforced on `webhook_events`.
  - Owner-read boundary enforced on `entitlements`.
- [x] **Unique Constraints & Indexes**:
  - Unique index `idx_uniq_user_job_application` on `(user_id, job_id) where job_id is not null`.
  - Unique constraint on `entitlements(email, product)`.
  - Unique constraint on `webhook_events(event_id)`.
- [ ] **Custom SMTP Configuration (Essential for Production Email Deliverability)**:
  - In Supabase Dashboard -> Project Settings -> Authentication -> SMTP Settings:
    - Enable Custom SMTP.
    - Sender Email: `no-reply@yourdomain.com`
    - Sender Name: `Remote Job Automator`
    - Host: `smtp.resend.com` (or SendGrid / AWS SES)
    - Port: `465` (SSL) or `587` (TLS)
    - User & Password: Your ESP API key / credentials.
- [ ] **Auth URL Redirects**:
  - In Supabase Dashboard -> Authentication -> URL Configuration:
    - Site URL: `https://app.yourdomain.com`
    - Redirect URLs:
      - `https://app.yourdomain.com/auth/callback`
      - `https://app.yourdomain.com/auth/confirm`
      - `https://app.yourdomain.com/reset-password`
      - `https://app.yourdomain.com/dashboard`

---

## 3. Commercial & Gumroad Monetization Setup

- [x] **Product Definition**:
  - Product Permalink: `remote-job-complete`
  - Public Checkout URL: `NEXT_PUBLIC_GUMROAD_URL=https://4217411968942.gumroad.com/l/remote-job-complete`
- [ ] **Gumroad Ping Webhook Setup**:
  - In Gumroad Dashboard -> Settings -> Advanced -> Ping:
    - Target URL: `https://app.yourdomain.com/api/webhooks/gumroad/{GUMROAD_PING_SECRET}`
    - Verify secret matches `GUMROAD_PING_SECRET` environment variable.
- [x] **Entitlement Life-Cycle**:
  - Purchase event -> sets `entitlements.status = 'active'`.
  - Refund / Cancellation event -> sets `entitlements.status = 'inactive'`.
  - Idempotent deduplication on `sale_id` prevents duplicate entitlement events.

---

## 4. Google AI Studio / Gemini Production Credentials

- [x] **API Key & Model**:
  - `AI_API_KEY`: Configured production Google AI Studio key.
  - `AI_MODEL`: `gemini-3.5-flash` (with automated fallback to `gemini-3.5-flash-lite`, `gemini-3.8-flash`, `gemini-3.6-flash`).
- [x] **Reliability Safeguards**:
  - 15,000ms timeout per call (`AbortSignal.timeout(15000)`).
  - Exponential backoff with random jitter (up to 300ms).
  - Input bounds: 8,000 characters for system instructions, 25,000 characters for user prompt.
  - Output bounds: `max_output_tokens: 4096`.
  - In-memory 2-hour prompt deduplication cache.

---

## 5. Live User Journey Verification Checklist

- [x] **Landing Page** (`/`): Loads instantly with value proposition and sign-up calls to action.
- [x] **Signup & Confirmation** (`/signup` -> `/auth/callback`): Creates user in Supabase auth and profile in database.
- [x] **Login** (`/login`): Sets secure HTTP-only session cookies.
- [x] **Structured Profile** (`/api/profile`): Saves work history, accomplishments, and skills.
- [x] **Master Resume Upload** (`/api/resume/upload`): Extracts text via `pdf-parse` / `mammoth`.
- [x] **Job Discovery Catalog** (`/api/jobs/discover`): Queries live `discovered_jobs` catalog.
- [x] **AI Candidate Match** (`/api/ai/job-match`): Produces score, strengths, and candidate positioning.
- [x] **1-Click Select Job** (`/api/jobs/select`): Binds job to canonical `job_id` and initial pipeline application.
- [x] **Application Strategy** (`/api/ai/strategy`): Generates positioning, objections, and compensation anchors.
- [x] **ATS Resume Studio** (`/api/ai/resume-tailor`): Tailors resume with 6-point QC audit engine.
- [x] **Cover Letter & Pitch** (`/api/ai/cover-letter`): Generates tailored cover letter and recruiter message.
- [x] **Screening Answers** (`/api/ai/screening-answers`): Drafts answers to custom application questions.
- [x] **Application CRM** (`/api/applications`): Tracks 8 Kanban stages with route detection and follow-up alerts.
- [x] **STAR Interview Coach** (`/api/ai/interview` & `/feedback`): Simulates interviews and evaluates candidate responses.
- [x] **Account Data Export** (`/api/account/export`): GDPR Article 20 compliant data export.
- [x] **Account Deletion** (`/api/account/delete`): GDPR Article 17 compliant right to erasure with multi-table cascade.

---

## 6. Disaster Recovery & Failure Handling

| Failure Scenario | Built-in Protection | Recovery Action |
|---|---|---|
| **Expired Auth Session** | SSR middleware redirects to `/login` | User re-authenticates; cookies refreshed |
| **Hanging AI Request** | `AbortSignal.timeout(15000)` aborts hanging request | Model cascade retries with backup model pool |
| **AI Rate Limit (429)** | Exponential backoff + random jitter across 3 attempts | Request completes after brief backoff |
| **Malformed AI Markdown** | `safeJson<T>()` extracts text, strips code fences | Clean JSON returned without route crash |
| **Duplicate Application** | Unique index `idx_uniq_user_job_application` | Idempotent upsert returns existing application record |
| **Duplicate Webhook Ping** | `webhook_events.event_id` unique deduplication | Returns `{ ok: true, duplicate: true }` without re-processing |
| **Invalid Webhook Call** | Secret validation in route URL | Returns HTTP 403 Forbidden |
| **Database Network Blip** | Supabase connection retry & error logging | Structured error logged; clean client error notice |
