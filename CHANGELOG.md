# Changelog

## 4.6.1 — Execution Security Hardening & Byte-Level Cryptographic Canonicalization

- **Byte-Level Cryptographic Canonicalization**: Hardened `lib/execution/fingerprint.ts` with Unicode NFC normalization, transport newline translation (`\r\n` / `\r` to `\n`), deep key-sorting (`deterministicStringify`), and question-ordered screening answer sorting.
- **Deep Artifact Mutation Defense**: Extended canonicalization to serialize and hash all structured fields (headline, summary, full_resume, recipient, letter, answers), ensuring any metadata tampering strictly alters the SHA-256 digest.
- **Homoglyph & Whitespace Attack Defense**: Validated that Unicode homoglyphs (e.g. Cyrillic `а` vs Latin `a`) and internal whitespace mutations ("Project Manager" vs "Project  Manager") strictly produce divergent SHA-256 digests and trigger `MUTATION_BLOCKED`.
- **Reviewer Signature & Timestamp Verification**: Added strict checks in `lib/execution/engine.ts` rejecting empty, whitespace-only, or unparseable human approval signatures.
- **Destination & Evidence Snapshot Guards**: Enforced destination lock and snapshot ID consistency in `executeApplicationPackage`, blocking redirection attacks (`DESTINATION_MISMATCH`) and drifted evidence states (`SNAPSHOT_MISMATCH`).
- **In-Flight Concurrency Lock**: Added execution lock mechanism (`acquireExecutionLock`, `releaseExecutionLock`) to prevent simultaneous race conditions (`CONCURRENT_EXECUTION_BLOCKED`).
- **Transparent Idempotency Recovery & Retry Handling**: Supported `idempotentReturnExisting` to cleanly return existing receipts without re-dispatching, and verified safe retry flows after transient gateway failures (`DISPATCH_FAILED`).
- **Outcome State Transition Validation**: Added `validateOutcomeTransition` in `lib/execution/stateMachine.ts` preventing out-of-sequence stages (e.g. `offer` without prior `applied`) and downstream transitions from terminal states (`rejected` / `withdrawn`).
- **Dedicated Regression Suite**: Added `tests/phase13_security_execution_hardening.mjs` verifying all 6 byte-level invariants and 12 security/abuse attack simulations permanently wired into `npm test` (15 total test suites).

## 4.6.0 — Controlled Application Execution & Outcome Intelligence

- **Evidence Snapshot Engine**: Added `lib/execution/snapshot.ts` creating immutable, deep-cloned snapshots of verified candidate profile data at approval time with deterministic SHA-256 identification (`ev-snap-*`).
- **Artifact Cryptographic Fingerprinting**: Added `lib/execution/fingerprint.ts` computing canonical SHA-256 digests over approved tailored packages (`resumeText`, `coverLetter`, `answers`) to guarantee content integrity.
- **Approved-Content Mutation Guard**: Implemented hard block invariant in `lib/execution/engine.ts`: *"Nothing after Human Approval may change the approved application artifact."* Recalculates fingerprint at dispatch time and halts immediately (`status: 'blocked'`) if hash diverges.
- **Human Approval Enforcement**: Enforced strict signature and timestamp verification before execution; unapproved or unsigned packages are rejected.
- **Idempotent Dispatch & Receipts**: Built destination-keyed deduplication preventing duplicate submissions, issuing verifiable `SubmissionReceipt` with timestamp, channel, and confirmation code.
- **Event-Sourced Outcome State Machine**: Added `lib/execution/stateMachine.ts` tracking discrete application lifecycle events (`applied` → `acknowledged` → `viewed` → `recruiter_response` → `screening` → `interview` → `technical_round` → `final_round` → `offer` / `rejected` / `withdrawn`).
- **Career ROI Analytics Engine**: Added factual conversion metrics in `lib/execution/stateMachine.ts` computing response rates, interview-to-offer rates, and turnaround durations.
- **Execution & Outcome API Routes**: Added `/api/applications/execute` (POST: verify & dispatch) and `/api/applications/outcomes` (GET: ROI metrics, POST: record transition).
- **Execution Telemetry**: Added `execution_dispatched`, `execution_confirmed`, `execution_blocked`, `recruiter_response_recorded`, `interview_scheduled`, and `offer_received` events to `lib/analytics.ts`.
- **Phase 13 Test Suite**: Added `tests/phase13_execution_outcome_slice.mjs` (9/9 areas) wired permanently into `npm test` (14 total test suites).

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
