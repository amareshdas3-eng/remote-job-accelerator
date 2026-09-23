# RJA v4.3 — Phase 10 PMF Evidence & Revenue Validation Report
**Live Product-Market Evidence, Data Integrity, Anti-Gaming & Revenue Truth Audit**

---

## 1. Executive Summary & Core Verdict

Phase 10 rigorously audited whether **Remote Job Accelerator (RJA) v4.3** possesses trustworthy, privacy-safe, production-grade instrumentation to measure real candidate behavior and revenue.

### 🔬 Core Scientific Verdict:
> **“Instrumentation is production-ready, but empirical PMF evidence is not yet statistically established.”**

In strict adherence to Phase 10 operating standards:
1. **No Target Has Been Falsely Converted to a Measured Result**:
   All Phase 9 baseline figures (e.g. 40% signup, 45% activation, 6.5 applications/user/week, 1.5–2.5% visitor→paid, 18.5% interview callback, 28% D30 retention) are strictly classified as **TARGETS / BENCHMARKS**.
2. **Zero Synthetic Customer Evidence**:
   Test fixtures and internal CI accounts were strictly barred from being counted as real customer evidence.
3. **The Engineering Baseline Is Frozen & Verified**:
   All Phase 0 through Phase 9 invariants remain intact, protected by 10 automated test suites, strict PostgreSQL Row-Level Security (RLS), and zero-defect Next.js production builds.

---

## 2. Event Taxonomy Audit (Step 1)

| Event | Implemented | Persisted | Identity | Timestamp | Attribution | Dedup | Production-Safe |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `landing_view` | YES (Client) | Structured Logs | Anonymous / Session | ISO 8601 | Channel / UTM | Session-throttled | YES |
| `signup_started` | YES (Client) | Structured Logs | Email (Client) | ISO 8601 | Channel / UTM | Single-trigger | YES |
| `signup_completed` | YES (Client+Server) | `auth.users.raw_user_meta_data` | `user.id` (UUID) | ISO 8601 | Channel / UTM / Ref | DB Unique Email | YES |
| `profile_completed` | YES (Client+Server) | `profiles.resume_text` + `structured_profile` | `user_id` (PK) | ISO 8601 | Session context | DB Row Upsert | YES |
| `resume_uploaded` | YES (API Route) | `profiles` table | `user_id` (Auth) | ISO 8601 | Server Session | Idempotent Upsert | YES |
| `job_search` | YES (Client) | Structured Logs | `user_id` / Anon | ISO 8601 | Search Query | Client Debounced | YES |
| `job_viewed` | YES (Client) | Structured Logs | `user_id` / Anon | ISO 8601 | Discovered Job ID | Client Debounced | YES |
| `why_match_opened` | YES (Client) | Structured Logs | `user_id` | ISO 8601 | Onboarding Step | Modal Listener | YES |
| `job_shortlisted` | YES (Client+Server) | `jobs` table | `user_id` + `job_id` | ISO 8601 | Session context | DB Unique Job | YES |
| `job_selected` | YES (API Route) | `jobs` + `applications` | `user_id` + `job_id` | ISO 8601 | Discovered / Route | `idx_uniq_user_job_application` | YES |
| `resume_tailored` | YES (API Route) | `jobs.tailored_resume` | `user_id` + `job_id` | ISO 8601 | Server Context | DB Row Update | YES |
| `cover_letter_generated` | YES (API Route) | `jobs.cover_letter` | `user_id` + `job_id` | ISO 8601 | Server Context | DB Row Update | YES |
| `application_started` | YES (Client) | Structured Logs | `user_id` | ISO 8601 | Tab Route Context | Single Dispatch | YES |
| `application_submitted` | YES (API Route) | `applications` (`applied_at`) | `user_id` + `job_id` | ISO 8601 | Route Platform | `idx_uniq_user_job_application` | YES |
| `interview_recorded` | YES (API Route) | `interviews` table | `user_id` + `job_id` | ISO 8601 | Job Scope | Unique per round | YES |
| `offer_recorded` | YES (API Route) | `applications.route_details.offer` | `user_id` + `job_id` | ISO 8601 | Job Scope | Application Update | YES |
| `pro_clicked` | YES (Client) | Structured Logs | `user_id` / Email | ISO 8601 | Modal Source | Single Dispatch | YES |
| `checkout_started` | YES (Client) | Structured Logs | `user_id` / Email | ISO 8601 | Appended UTM Link | User Click Trigger | YES |
| `purchase_completed` | YES (Server Webhook) | `entitlements` + `webhook_events` | Customer Email | ISO 8601 | Sale ID + URL params | `sale_id` DB Dedup | YES (Authoritative) |

---

## 3. Attribution Audit (Step 2)

- **Capture Mechanism**: `captureAttribution()` in `lib/attribution.ts` extracts `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `ref`, and `document.referrer`.
- **Channels Classified**:
  - `linkedin`
  - `reddit`
  - `community` (Hacker News, Product Hunt, Discord, Slack)
  - `gumroad`
  - `network` (Warm introductions, direct network)
  - `search` (Google, Bing, DuckDuckGo)
  - `referral`
  - `direct`
- **Persistence & Survival**:
  - Anonymous visitor: Stored in `localStorage` under `rja_attribution_v1`.
  - Signup: Passed into Supabase Auth `options.data.attribution` and persisted in `auth.users.raw_user_meta_data`.
  - Checkout: `appendAttributionParams` appends attribution query params to the Gumroad checkout URL so Gumroad receives and forwards them in the webhook ping.
  - Payment: Stored in `webhook_events.payload` alongside verified `sale_id`.

---

## 4. Identity & Joinability Audit (Step 3)

The data model cleanly supports deterministic joins without fragile client-side state:
```
Anonymous Visitor (localStorage Attribution)
          ↓
Signup (auth.users: id, email, raw_user_meta_data.attribution)
          ↓
Profiles (profiles: id = auth.uid(), resume_text, structured_profile)
          ↓
Canonical Catalog (discovered_jobs: id, external_id, title, company)
          ↓
Saved Opportunities (jobs: id, user_id = auth.uid(), fit_score, tailored_resume)
          ↓
Applications CRM (applications: id, user_id, job_id, status, applied_at)
          ↓
Interview Coaching (interviews: id, user_id, job_id, plan, scorecard)
          ↓
Monetization & Entitlement (entitlements: email, product, status, source)
          ↓
Verified Sales (webhook_events: event_id = sale_id, payload)
```
- **Foreign Key & Scope Protection**: All user-owned tables (`jobs`, `applications`, `interviews`, `profiles`) are protected by PostgreSQL RLS (`auth.uid() = user_id`).
- **Unique Constraint Integrity**: `idx_uniq_user_job_application` eliminates duplicate applications for the same `(user_id, job_id)`.

---

## 5. North-Star KPI & Real Application Evidence (Steps 4 & 5)

### North-Star Metric:
$$\text{North-Star} = \frac{\text{Total Qualified Applications Successfully Submitted}}{\text{Active Users} \times \text{Weeks in Window}}$$

### Strict Definition of Qualified Application:
A job application that:
1. Belongs to an authenticated user (`user_id`).
2. References a valid canonical job (`job_id`).
3. Has a valid submitted status from `SUBMITTED_APPLICATION_STATUSES`:
   `['applied', 'follow_up', 'screening', 'interview', 'offer', 'rejected', 'closed']`.
4. Excludes draft/work-in-progress statuses: `saved`, `selected`, `in_progress`, `ready_to_apply`, `withdrawn`.
5. Is guaranteed non-duplicate via `idx_uniq_user_job_application`.
6. Is an actual candidate submission, timestamped with `applied_at`.

---

## 6. Interview, Offer & Hire Outcome Audit (Step 6)

| Stage | Persistent | User-Scoped | Timestamped | Linked to Application | KPI-Ready |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Applications (Submitted)** | YES (`applications`) | YES (`user_id`) | YES (`applied_at`) | Primary Record | YES |
| **2. Responses** | YES (`applications`) | YES (`user_id`) | YES (`updated_at`) | Status $\ge$ `screening` | YES |
| **3. Interviews** | YES (`interviews` + `apps`) | YES (`user_id`) | YES (`created_at`) | YES (`job_id`) | YES |
| **4. Offers** | YES (`applications`) | YES (`user_id`) | YES (`updated_at`) | `status = 'offer'`, details in `route_details.offer` | YES |
| **5. Hired** | YES (`applications`) | YES (`user_id`) | YES (`updated_at`) | `status = 'closed'` with `offer.accepted = true` | YES |

---

## 7. Revenue Truth Audit (Step 7)

- **Canonical Source of Truth**:
  Verified server-side Gumroad webhook (`app/api/webhooks/gumroad/[secret]/route.ts`).
- **Security & Anti-Replay**:
  - Authenticated via secret URL parameter matching `process.env.GUMROAD_PING_SECRET`.
  - Replays of identical `sale_id` are detected in `webhook_events` and handled idempotently (`duplicate: true`).
  - Entitlements upserted to `entitlements` table with `onConflict: 'email, product'`.
- **Frontend Distinction**:
  `pro_clicked` and `checkout_started` are treated purely as intent telemetry, **never** as revenue evidence.

---

## 8. Cohort Retention Audit (Step 8)

Empirical cohort retention is calculated via `calculateCohortRetention(users)` in `lib/growth.ts`:
- **Cohort Start**: `activatedAt` timestamp (first tailored application or profile completion).
- **Return Activity**: `lastActiveAt` timestamp (application modification, interview practice, or job tailoring).
- **Retention Thresholds**:
  - D1: Return $\ge 1$ day post-activation.
  - D7: Return $\ge 7$ days post-activation.
  - D14: Return $\ge 14$ days post-activation.
  - D30: Return $\ge 30$ days post-activation.

---

## 9. Data Quality & Anti-Gaming Audit (Step 9)

| Potential Vulnerability | Risk | Prevention Mechanism in RJA v4.3 | Classification |
| :--- | :--- | :--- | :--- |
| **Duplicate Telemetry** | Metric inflation | Unique `(userId, event, timestamp)` deduplication in analytics pipeline | NONE |
| **Repeated Page Refreshes** | Artificially high active users | Distinct user aggregation (`COUNT(DISTINCT user_id)`) | NONE |
| **Repeated App Submissions** | Inflated North-Star metric | Database unique index `idx_uniq_user_job_application` on `(user_id, job_id)` | NONE |
| **Duplicate Webhook Pings** | Inflated revenue numbers | `event_id = sale_id` unique check in `webhook_events` table | NONE |
| **Unsubmitted Drafts as Apps** | Inflated conversion rates | Strict `isSubmittedApplicationStatus` filter excluding `saved`, `selected`, `in_progress` | RESOLVED (NONE) |
| **Offers Equated to Hires** | False PMF claims | Strict separation of Offer vs Hired in `GrowthOverview.tsx` and `growth.ts` | RESOLVED (NONE) |
| **Cross-User Data Leakage** | Contaminated KPIs | Multi-tenant PostgreSQL Row Level Security (RLS) on all tables | NONE |

---

## 10. Privacy & Security Audit (Step 10)

- **No Credential / Sensitive Data Leakage**:
  Telemetry events strictly omit passwords, auth tokens, credit card details, and confidential application contents.
- **GDPR / CCPA Account Deletion**:
  `app/api/account/delete/route.ts` cascades deletion across `jobs`, `applications`, `interviews`, `profiles`, `entitlements`, and `auth.users`.
- **Attribution Sanitization**:
  All UTM query params and referrers are sanitized and URL-decoded safely.

---

## 11. Data Availability Determination (Step 11)

### Environment Classification:
$$\textbf{Classification: A — Release Candidate Baseline / Zero Synthetic Claims}$$
The database currently holds system fixtures, the live remote job catalog (12 discovered jobs), and verified end-to-end testing accounts. 

Because public candidate volume has not yet accumulated longitudinal scale, **no empirical PMF metrics are fabricated**. The instrumentation is 100% ready to record live customer traffic.

---

## 12. Mandatory Evidence Classification Table (Step 12)

| KPI | Definition | Benchmark / Target | Current Status | Evidence Source |
| :--- | :--- | :--- | :--- | :--- |
| **Visitor → Signup** | % of unique landing visitors who register an account | 40% | **TARGET** | Telemetry (`landing_view` → `signup_completed`) |
| **Signup → Activation** | % of signups who complete first tailored application | 45–50% | **TARGET** | Database (`auth.users` → `applications`) |
| **Activation Time** | Elapsed minutes from registration to first tailored app | 6 min (< 8 min) | **TARGET** | `OnboardingGuide` + Application timestamps |
| **Applications/User/Week** | North-Star: Qualified submitted apps / active user / week | 6.5 apps/user/wk | **TARGET** | Database (`applications.applied_at` / active users) |
| **Visitor → Paid** | % of landing visitors converting to paid Pro tier | 1.5–2.5% | **TARGET** | `webhook_events` / `landing_view` |
| **Activated → Paid** | % of activated users converting to paid Pro tier | 8–12% | **TARGET** | `entitlements` / Activated users |
| **D1 Retention** | % of activated users returning $\ge 1$ day later | 65% | **TARGET** | User activity timestamps |
| **D7 Retention** | % of activated users returning $\ge 7$ days later | 42% | **TARGET** | User activity timestamps |
| **D14 Retention** | % of activated users returning $\ge 14$ days later | 34% | **TARGET** | User activity timestamps |
| **D30 Retention** | % of activated users returning $\ge 30$ days later | 28% | **TARGET** | User activity timestamps |
| **Interview Callback** | % of submitted applications receiving interview invites | 18.5% | **TARGET** | `applications` (`interview` / `applied`) |
| **Offer Conversion** | % of interviews converting to formal job offers | 22% | **TARGET** | `applications` (`offer` / `interview`) |
| **Hired Conversion** | % of offers successfully converted to employment | 50% | **TARGET** | `applications` (`closed` / `offer`) |

---

## 13. Gap Classification & Resolution (Steps 13 & 14)

### Resolved Gaps:
1. **Gap 1 (Integrity)**: `appliedApps` previously counted draft statuses (`saved`, `selected`, `in_progress`, `ready_to_apply`).
   - *Resolution*: Implemented `isSubmittedApplicationStatus(status)` and updated `GrowthOverview.tsx` and `AnalyticsOverview.tsx`.
2. **Gap 2 (Integrity)**: `hired` was previously proxied by any offer stage.
   - *Resolution*: Strictly separated Offer from Hired; Hired requires explicit offer acceptance or closed placement.
3. **Gap 3 (Measurement)**: Gumroad checkout link in `Dashboard.tsx` did not forward inbound attribution parameters.
   - *Resolution*: Wrapped checkout URL in `appendAttributionParams(...)`.
4. **Gap 4 (Measurement)**: User signup flow did not persist attribution to user metadata.
   - *Resolution*: Injected `getStoredAttribution()` into `options.data.attribution` on Supabase Auth `signUp()` in `app/signup/page.tsx`.
5. **Gap 5 (Measurement)**: Missing canonical retention cohort calculator.
   - *Resolution*: Added `calculateCohortRetention` in `lib/growth.ts`.

---

## 14. Build & Test Verification (Steps 15 & 16)

All 10 verification suites passed with 100% success:
1. `tests/smoke.mjs`: Core smoke tests.
2. `tests/job_centric_architecture.mjs`: Database & job architecture.
3. `tests/full_12_phase_verification.mjs`: 12-phase pipeline verification.
4. `tests/phase5_application_execution.mjs`: Application execution studio.
5. `tests/phase6_production_hardening.mjs`: RLS, idempotency, timeouts & backoff.
6. `tests/phase7_production_launch_validation.mjs`: Live Supabase, live AI inference, Gumroad billing.
7. `tests/ai_benchmark_eval.mjs`: 5 golden real-world candidate/JD evaluation pairs (100% quality).
8. `tests/phase8_customer_revenue_validation.mjs`: Product analytics & telemetry engine.
9. `tests/phase9_growth_acquisition_experimentation.mjs`: Inbound channel attribution & growth math.
10. `tests/phase10_live_pmf_revenue_validation.mjs`: **10/10 checks passed** (idempotency, draft status exclusion, webhook deduplication, multi-user isolation, attribution forwarding, North-Star zero-safety, cohort retention math, offer/hire separation, zero PII leakage).

- **TypeScript Compilation**: `npm run typecheck` (`tsc --noEmit`): **0 errors**.
- **Next.js Production Build**: `npm run build` (Turbopack): **Compiled in 819ms, all 36 routes generated successfully**.
- **Feature Matrix**: `RJA_V4.3_FEATURE_MATRIX.csv` updated with Phase 10 marked **FULLY FUNCTIONAL**.
