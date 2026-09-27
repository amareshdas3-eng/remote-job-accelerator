# Changelog

## 4.5.0 — Application Intelligence & Truthfulness Boundary

- **Application Workspace**: Transformed selected opportunities into actionable application packages with structured requirement mappings and lifecycle status tracking.
- **Requirement Extraction Engine**: Added `lib/applications/analyzer.ts` to deterministically extract required vs. preferred qualifications, domain keywords, and role expectations.
- **Candidate ↔ Requirement Gap Engine**: Added `lib/applications/gaps.ts` to compare candidate profile & evidence against qualifications, categorizing matches (`verified`, `partial`, `unsupported`) and calculating a 0–100 readiness score.
- **Application Truthfulness Boundary**: Implemented `lib/applications/truthfulness.ts` separating authentic evidence from generative text; scans for unverified high-stakes credentials (PMP, PE, CISSP, degrees) and tenure inflation.
- **Human Review Gate**: Implemented `lib/applications/workspace.ts` and `/api/applications/approve` requiring explicit candidate sign-off before transitioning to `ready_to_apply`, with hard blockers on unsupported claims.
- **Application Funnel Telemetry**: Added `application_draft_created`, `application_review_started`, `application_approved`, and `application_ready` events with zero-PII transmission guarantees.
- **Automated Phase 12 Regression Suite**: Added `tests/phase12_application_intelligence_slice.mjs` (7/7 areas) permanently wired into `npm test` (13 test suites).

## 4.4.0 — Production Job Intelligence & Deterministic Matching

- **Resume Ingestion & Auto-Extraction**: Added `extractStructuredProfileFromText` in `lib/profile.ts` for PDF, DOCX, and TXT parsing while preserving Mammoth 1.13.0 traversal security.
- **Canonical Job Contract & Deduplication**: Added `lib/jobs/normalizer.ts` and `lib/jobs/dedup.ts` for URL normalization, tracking parameter stripping, and collision-resistant sha256 deduplication hashing.
- **Deterministic 4-Dimensional Matching Engine**: Implemented `lib/matching/engine.ts` computing authoritative `fit_score` (0–100), `tier`, and dimensional breakdown (Role, Technical, Leadership, Seniority/Remote).
- **AI Explanation Layer**: Scoped AI in `/api/ai/job-match` strictly to qualitative explainability (`why_matched`, `strategic_advice`, `strengths`, `gaps`) with guaranteed deterministic fallback and zero score mutation.
- **Interactive Discovery Dashboard**: Enhanced `JobDiscovery.tsx` with 4-dimension score breakdown bars, tier filters, and "Why You Match" drawer.
- **Job Intelligence Telemetry**: Added `resume_parsed`, `jobs_matched`, `match_explanation_viewed`, and `job_selected` events.
- **Automated Phase 11 Regression Suite**: Added `tests/phase11_job_intelligence_slice.mjs` (6/6 areas) permanently wired into `npm test`.

## 4.3.1 — Security Hardening & CI Reproducibility Baseline

- **Remediated Mammoth Dependency Vulnerability**: Upgraded `mammoth` to `1.13.0` to address GHSA-rmjr-87wv-gf87 directory traversal advisory with zero breaking changes.
- **Added Automated DOCX Security Regression Suite**: Added `tests/test_docx_mammoth_security.mjs` verifying valid extraction, malformed zip resilience, and hostile zip-slip path traversal sanitization as a permanent gate in `npm test`.
- **Zero-Vulnerability Audit Baseline**: Verified clean dependency tree with `npm audit` reporting 0 vulnerabilities.
- **Hardened CI Environment Configuration**: Configured deterministic environment defaults and secret overrides in `.github/workflows/ci.yml` and `.env.example`.
- **Created SECURITY.md Policy**: Formulated responsible disclosure procedures, secret vs. placeholder hierarchy principles, and historical audit log.

## 4.3.0 — Customer-Ready Launch Edition

- Rebuilt the authenticated workspace as a guided customer command center.
- Added first-run Pro onboarding/paywall with clear value framing.
- Added resume import UX for PDF, DOCX and TXT with review-before-save workflow.
- Added richer job intake cards and auditable source messaging.
- Added requirement-level fit intelligence presentation and score visualization.
- Added evidence-safe tailored resume presentation and cover-letter generation.
- Added interview coach dashboard with role-specific question cards.
- Added application pipeline counts and inline status updates.
- Added job/application history visibility.
- Added account settings with data export and explicit destructive-delete confirmation.
- Added responsive mobile/tablet navigation and customer-facing empty/loading/error states.
- Added v4.3 CI/deployment metadata and additive database migration for cover letters.
