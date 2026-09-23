# RJA v4.3 — Phase 6 Technical Audit Report: Production Hardening & SaaS Readiness

**Audit Date**: September 21, 2026  
**Auditor**: Antigravity AI Senior Systems Architect  
**Objective**: Comprehensive pre-implementation audit across the 7 Production Hardening & SaaS Readiness pillars.

---

## Executive Summary

RJA has successfully built out the full 9-stage job-application operating system in Phases 0–5:
`Profile & Evidence → Authentication & Recovery → Real Job Ingestion → Matching & Candidate Intel → Application Intelligence & Execution`.

Phase 6 is the **Final Engineering-Hardening Gate**. Before RJA is declared production-hardened and SaaS-ready, all edge cases, failure domains, security boundaries, and operational observability mechanisms must be audited, fortified, and verified.

---

## Pillar 1: Multi-User Security Audit

### Current Findings & Gaps:
1. **RLS on `entitlements` and `webhook_events` Table**:
   - **Finding**: While `profiles`, `jobs`, `interviews`, `applications`, `rate_limits`, and `extension_oauth_codes` have RLS enabled, `entitlements` and `webhook_events` in `api/schema.sql` do not currently have `enable row level security` executed.
   - **Vulnerability**: If `grant all on table public.entitlements to authenticated` is present without RLS, any authenticated user using the client anon-key could potentially query other users' entitlement records.
   - **Hardening Requirement**:
     - Enable RLS on `entitlements`:
       - `SELECT`: Only allow matching user email (`lower(email) = lower(auth.jwt() ->> 'email')`) or `service_role`.
       - `INSERT/UPDATE/DELETE`: Restricted exclusively to `service_role`.
     - Enable RLS on `webhook_events`:
       - Accessible only by `service_role`.
2. **Cross-User Isolation on Mutations**:
   - **Finding**: Most API routes (`/api/applications`, `/api/jobs/select`, `/api/profile`, `/api/ai/*`) use `requireUser()` and `.eq('user_id', user.id)`.
   - **Gap**: `app/api/applications/route.ts` lacks a `DELETE` endpoint. Users cannot delete or archive applications with authorization enforcement.
   - **Hardening Requirement**: Add `DELETE /api/applications` with explicit `user_id` ownership verification.
3. **Authenticated vs. Service-Role Boundaries**:
   - **Finding**: `supabaseAdmin` is used inside API route handlers. This is appropriate for server-side Next.js route handlers where user session is first validated via `requireUser()` / `requirePro()`.
   - **Hardening Requirement**: Audit every API route to ensure `supabaseAdmin` is NEVER called before `requireUser()` or `requirePro()` completes, and ensure `SUPABASE_SERVICE_ROLE_KEY` is never exposed in `NEXT_PUBLIC_` client code.

---

## Pillar 2: Application Integrity Audit

### Current Findings & Gaps:
1. **Duplicate Applications & Concurrent Requests**:
   - **Finding**: `POST /api/applications` and `POST /api/jobs/select` check for existing records in application logic. However, under high-concurrency race conditions (e.g., rapid double-clicking or parallel API calls), two rows could be inserted simultaneously.
   - **Hardening Requirement**: Add a unique index in Postgres schema:
     ```sql
     create unique index if not exists idx_uniq_user_job_application on public.applications(user_id, job_id) where job_id is not null;
     ```
     Wrap insert/update with database-level conflict handling (`on conflict(user_id, job_id) do update`).
2. **Invalid Lifecycle Transitions**:
   - **Finding**: Currently, `PATCH /api/applications` accepts any status in `statuses`. A user could technically transition an application from `closed` directly to `screening` or skip critical timestamps.
   - **Hardening Requirement**: Formalize transition guards:
     - Transition to `applied` automatically guarantees `applied_at = now()`.
     - Transition to `offer` validates offer payload presence.
     - Reject unknown status strings with `400 Bad Request`.
3. **Idempotency & Stale Application State**:
   - **Finding**: Repeated clicks on "Select Job" or "Add to Pipeline" should update existing records without creating orphaned or duplicate records.

---

## Pillar 3: AI Reliability Audit

### Current Findings & Gaps:
1. **Timeout Handling**:
   - **Finding**: `lib/ai.ts` performs `fetch()` to Gemini endpoints without an `AbortSignal.timeout()`. If the upstream provider hangs or stalls, Node.js fetch will block indefinitely until serverless execution timeout.
   - **Hardening Requirement**: Enforce `AbortSignal.timeout(15000)` on all AI fetch requests, catching `AbortError` and cascading cleanly to the next model.
2. **Provider Failover & Multi-Model Pool**:
   - **Finding**: `lib/ai.ts` already has a pool (`gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.8-flash`, `gemini-3.6-flash`).
   - **Hardening Requirement**: Add exponential backoff with jitter when encountering HTTP 429 (rate limit) or HTTP 503 (high demand) responses.
3. **Token & Cost Controls**:
   - **Finding**: Large candidate profiles or massive job descriptions could cause excessive token usage.
   - **Hardening Requirement**: Enforce input prompt truncation (max 25,000 characters) and pass `max_output_tokens: 4096` to bound cost and latency.
4. **Deterministic Fallbacks**:
   - **Finding**: All AI routes (`match`, `resume-tailor`, `cover-letter`, `interview`, `strategy`, `screening-answers`) must guarantee a valid response structure even when external AI providers fail completely.

---

## Pillar 4: Production UX Audit

### Current Findings & Gaps:
1. **Dead Buttons & Mock Data Check**:
   - **Finding**: Zero mock or demo data found in UI components. All buttons trigger real API calls or local workflows.
2. **Loading & Busy States**:
   - **Finding**: Core buttons in `StructuredProfile`, `JobDiscovery`, `UnifiedJobWorkspace`, and `KanbanTracker` use the `busy` prop to show "Generating…" or "Saving…".
   - **Hardening Requirement**: Ensure all buttons disable themselves during `busy` state to prevent double-submission.
3. **Empty & Error States**:
   - **Finding**: Ensure clean fallback visuals when:
     - Opportunity pipeline is empty.
     - Resume Studio has no tailored draft.
     - Screening answers are ungenerated.
     - Network request fails (display error notice with dismissal).

---

## Pillar 5: Observability Audit

### Current Findings & Gaps:
1. **Lack of Structured Logging**:
   - **Finding**: Currently, errors are logged via bare `console.error(e)`. There is no request-id tracking, structured JSON formatting, or latency metrics.
   - **Hardening Requirement**: Create [`lib/logger.ts`](file:///c:/RJA/v4.3/app/lib/logger.ts):
     - Structured JSON logs with timestamp, log level (`INFO`, `WARN`, `ERROR`), `requestId`, `userId`, `durationMs`, and metadata.
     - Inject `x-request-id` header in `proxy.ts` middleware and propagate across API route responses.
     - Log AI latency, retry attempts, model cascade events, and database query durations.

---

## Pillar 6: Production Configuration Audit

### Current Findings & Gaps:
1. **Environment Variables & Secrets**:
   - **Finding**: `.env.example` exists with 19 variables.
   - **Hardening Requirement**: Update `.env.example` with clear documentation for every variable, production default guidelines, SMTP setup instructions, and domain configuration.
2. **Open-Redirect & URL Validation**:
   - **Finding**: Auth callbacks and password reset endpoints must validate destination URLs against `NEXT_PUBLIC_APP_URL` to prevent open-redirect vulnerabilities.
3. **Security Headers**:
   - **Finding**: `proxy.ts` middleware applies CSP, HSTS, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.
   - **Hardening Requirement**: Add `x-request-id` injection and ensure CSP allows all necessary remote job origins without breaking inline dashboard styles.

---

## Pillar 7: SaaS Readiness Audit

### Current Findings & Gaps:
1. **Account Lifecycle & Data Deletion/Export**:
   - **Finding**: `/api/account/export` and `/api/account/delete` exist and delete across `profiles`, `jobs`, `interviews`, `applications`, `extension_oauth_codes`, and `auth.users`.
   - **Hardening Requirement**: Verify complete multi-table cleanup and ensure orphan records are impossible through foreign key cascade.
2. **Subscription & Paywall Boundary**:
   - **Finding**: Entitlements are checked via `hasEntitlement()` against the `entitlements` table for product `remote-job-complete`. Free users are restricted from advanced AI routes (`402 PRO_REQUIRED`).
   - **Hardening Requirement**: Ensure rate-limiting protects against abuse: `consume_rate_limit()` in Postgres limits free and pro users to sensible daily request quotas.
3. **Privacy Considerations**:
   - **Finding**: Resume evidence contains PII (email, phone, address). No PII is logged to server console or transmitted to third parties except the configured AI provider.

---

## Recommended Phase 6 Implementation Plan

| Action Item | Target Component / File | Pillar |
|---|---|---|
| **1. Postgres Security & Unique Index** | `api/schema.sql`, `supabase/migrations/` | Security & Integrity |
| **2. AI Reliability & Timeout Engine** | `lib/ai.ts` | AI Reliability |
| **3. Structured Observability Logger** | `lib/logger.ts` | Observability |
| **4. Middleware Request-ID Injection** | `proxy.ts` | Observability & Security |
| **5. Applications API Hardening (DELETE, Transitions, Idempotency)** | `app/api/applications/route.ts` | Security & Integrity |
| **6. Production Config & Redirect Guards** | `.env.example`, `app/auth/callback/route.ts` | Production Config |
| **7. Production UX Empty/Error Polish** | Dashboard components | Production UX |
| **8. Automated Verification Suite** | `tests/phase6_production_hardening.mjs` | Verification |

This concludes the Phase 6 technical audit.
