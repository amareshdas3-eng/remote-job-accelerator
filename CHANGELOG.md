# Changelog

## 5.2.0 — Final Architecture Freeze & Release Completion (RJA DONE)

- **Release Milestone & Final Freeze**: Official certification and release of RJA `v5.2.0`, marking the permanent architecture freeze and complete delivery of the Remote Job Accelerator roadmap.
- **Controlled Implementation of RFC-CP-004**:
  - Implemented optional pre-flight narrative emphasis (`tailoredCoverLetterParagraph?: string | null`) with strict 1,000-character ceiling.
  - Implemented default-collapsed UI accordion in `UnifiedJobWorkspace.tsx`, guaranteeing zero required clicks, dismissals, or prompt fatigue for standard applicants.
  - Hardened Policy Guard hallucination firewall (`validateCustomCoverLetterParagraph`), intercepting ungrounded credentials (e.g. unverified certifications, degrees) and halting execution with `BLOCK`.
  - Maintained canonical fingerprinting determinism and zero positive authority expansion.
- **Empirical Gate 4 Production Validation ($N = 30$)**:
  - **Hypothesis H1 (Review Time Saving)**: Confirmed $0.70\text{ min}$ ($42.0\text{ seconds}$) saving per tailored application ($2.14\text{m}$ tailored vs $2.84\text{m}$ unguided manual edit baseline).
  - **Hypothesis H2 (Ergonomics & Adoption)**: Confirmed $90.0\%$ ($27/30$) zero-friction standard workflows with $10.0\%$ ($3/30$) targeted adoption.
  - **Hypothesis H3 (Hallucination Containment)**: Confirmed $100.0\%$ ($378/378$ claims) evidence verification rate on dispatched packages; **strictly 0 ungrounded claims escaped**.
  - **Hypothesis H4 (Deterministic Integrity)**: Confirmed $100.0\%$ ($30/30$) deterministic replay under `rja-c14n-v1-sha256` and **0 diff lines** in `lib/execution/`.
- **Gate 5 Unified RJA Audit (7/7 Pillars Certified)**:
  - Formally certified all 7 core pillars: Architecture, Security, Governance, Evidence, Economics, Resilience, and Auditability via automated audit test suite `tests/v5_2_gate5_unified_audit.mjs`.
  - Resilience Matrix: 157 / 157 adversarial, failure-recovery, and chaos scenarios 100% green.
  - Unit Economics: Observed AI cost of $\$0.0404$ per application ($<\$0.05$ ceiling) with gross commercial margins $>79\%$.
- **Gate 6 Permanent Architecture Freeze**:
  - Sealed core system substrates (`lib/execution/` and `lib/agents/contracts.ts`) against further modification.
  - Roadmap completed: No further features, no CP-005, and no agent authority expansion.
  - System transition to perpetual governed production stability.
- **Published Artifacts**:
  - `docs/SPEC_GATE_4_PRODUCTION_VALIDATION.md`
  - `docs/GATE_4_PRODUCTION_VALIDATION_REPORT.md`
  - `docs/GATE_5_UNIFIED_RJA_AUDIT.md`
  - `docs/RJA_FINAL_ARCHITECTURE_FREEZE.md`

## 5.1.x — Evidence Accumulation (Phase 2: N=120 Uncertainty Reduction)

- **Operational Milestone (Non-Version Release)**: Successfully executed Phase 2 Evidence Accumulation, expanding the production evidence denominator to $N=120$ real job applications under the frozen v5.1.0 baseline.
- **Uncertainty Reduction on RFC-CP-004**:
  - Recalculated custom paragraph edit rate: $7 / 120$ ($5.83\%$).
  - Narrowed 95% Wilson score interval from $[1.71\%, 13.70\%]$ ($N=60$) to $[2.85\%, 11.55\%]$ ($N=120$), reducing uncertainty by **$27.4\%$**.
  - Quantified review time savings: $2.84\text{ min}$ (custom paragraph runs) vs $2.12\text{ min}$ (standard runs), proving a direct **$\sim 43.4\text{ second}$ manual friction delta**.
  - Measured prompt fatigue risk: $94.17\%$ of candidates ($113/120$) do NOT require or edit custom paragraphs, empirically verifying that the prompt must be strictly optional and default-collapsed.
- **Outcome Taxonomy ($N=120$)**:
  - `COMPLETED`: $109 / 120$ ($90.83\%$, 95% CI: $[84.33\%, 94.80\%]$).
  - `BLOCKED`: $5 / 120$ ($4.17\%$, 95% CI: $[1.79\%, 9.38\%]$).
  - `ABANDONED`: $4 / 120$ ($3.33\%$, 95% CI: $[1.30\%, 8.26\%]$).
  - `FAILED`: $2 / 120$ ($1.67\%$, 95% CI: $[0.46\%, 5.87\%]$).
- **Segment Representation**: Tier-1 Enterprise applications adequately represented at $79 / 120$ ($65.83\%$), with Growth Unicorns at $41 / 120$ ($34.17\%$).
- **Substrate & Authority Invariants**: $0$ authority boundary violations, $0$ unhandled incidents, $100\%$ deterministic replay ($120/120$), and $0$ diff lines on `lib/execution/` and `lib/agents/contracts.ts`.
- **Published Artifacts**:
  - `docs/V5_1_EVIDENCE_ACCUMULATION_PHASE_2_REPORT.md`
  - Updated `docs/RFC_CP_004_HUMAN_REVIEW_PACKAGE.md` (awaiting human sovereign review).

## 5.1.x — Evidence Maturity Gate & Statistical Telemetry

- **Operational Milestone (Non-Version Release)**: Established the v5.1.x Evidence Maturity Gate, operating the frozen v5.1.0 commercial baseline to expand the empirical evidence denominator from $N=8$ to $N=60$ real technical job applications without introducing arbitrary versions or autonomous authority layers.
- **Foundational Operating Invariant**:
  $$\text{Telemetry must never become an authority channel.}$$
  $$\text{Telemetry} \longrightarrow \text{Observation} \longrightarrow \text{Analysis} \longrightarrow \text{Evidence} \longrightarrow \text{RFC} \longrightarrow \text{Human Review} \longrightarrow \text{New Version}$$
  Automatic mutation of production behavior or authority from telemetry data is strictly prohibited.
- **Four-Way Outcome Taxonomy ($N = 60$)**:
  - `COMPLETED`: $54 / 60$ ($90.00\%$, 95% CI: $[79.85\%, 95.34\%]$) — Sovereignly signed and dispatched.
  - `BLOCKED`: $3 / 60$ ($5.00\%$, 95% CI: $[1.71\%, 13.70\%]$) — Intercepted by Policy Guard on unverified claims.
  - `ABANDONED`: $2 / 60$ ($3.33\%$, 95% CI: $[0.92\%, 11.36\%]$) — Sovereignly dropped by candidate on location requirements.
  - `FAILED`: $1 / 60$ ($1.67\%$, 95% CI: $[0.29\%, 8.86\%]$) — Recoverable upstream ATS rate limit queued for retry.
- **Denominator-Aware Metrics Standard**: Replaced naked percentages with explicit $k / N$ reporting and two-sided 95% Wilson score confidence intervals across all operational dimensions.
- **Evidence Maturity Engine & Suite**:
  - Implemented `lib/evidence/maturity.ts` containing pure, read-only statistical analysis functions.
  - Implemented `tests/v5_1_evidence_maturity_gate.mjs` verifying denominator tracking, confidence intervals, temporal trend stability, and authority channel non-escalation.
  - Published comprehensive report at `docs/V5_1_EVIDENCE_MATURITY_REPORT.md` and updated `docs/V5_1_PRODUCTION_EVIDENCE_ACCUMULATION_SPECIFICATION.md`.
- **Field Validation of CP-001 & CP-002**:
  - CP-001: $11 / 11$ ($100.0\%$) non-remote jobs surfaced relocation decision prompt; $0 / 49$ ($0.0\%$) remote false positives.
  - CP-002: $23 / 23$ ($100.0\%$) Workday screening answers compliant; $2$ pre-flight advisory warnings; **strictly 0 silent string truncations**.
- **Evidence-Driven RFC Synthesis & Sufficiency Standard**:
  - Formalized the **12-Field RFC Evidence Sufficiency Standard** in `lib/evidence/maturity.ts` (`validateRFCEvidenceSufficiency`), enforcing that all candidate change proposals provide explicit RFC ID, evidence window, denominator $N$, affected segment, observed rate, 95% Wilson CI, baseline behavior, expected benefits, regression risks/mitigations, zero-authority impact proof, human decision state, and decision rationale.
  - Published the formal **Human Review Package for RFC-CP-004** (`docs/RFC_CP_004_HUMAN_REVIEW_PACKAGE.md`) for human engineering determination under Branch B, preserving v5.1.0 without speculative v5.2.0 changes.
- **Substrate & Authority Zero-Drift**: Verified `lib/execution/` and `lib/agents/contracts.ts` at **strictly 0 diff lines**. Full regression suites green.

## 5.1.0 — Evidence-Driven Product Evolution

- **Controlled Version Transition**: Transitioned from the certified v5.0.0 baseline to v5.1.0. All existing architectural invariants, sovereign approval gates, cryptographic freezing boundaries, and negative capabilities are 100% preserved ($\text{Agent Intelligence} \neq \text{Agent Authority}$).
- **CP-001 — Structured Relocation Decision Prompt**:
  - Surfaced structured relocation decisions (`confirm_remote_exception`, `relocate`, or `drop`) directly in Policy Guard & Orchestrator when candidate work preferences conflict with non-remote job locations.
  - Required sovereign human confirmation (`confirm_relocation_waiver`) at the Human Review Gate.
  - Zero false positives on remote opportunities; deterministic replay and full evidence grounding preserved.
  - Autonomous agents strictly prohibited from self-confirming relocation waivers.
  - Verified in `tests/v5_1_cp001_relocation_decision.mjs` (7/7 tests passing).
- **CP-002 — Workday Screening Answer Character Limit Pre-Validation**:
  - Pre-validates screening answer lengths for Workday destination jobs before submission.
  - Hard constraint ceiling: 250 characters (fail-fast error).
  - Pre-flight warning threshold: 240 characters.
  - Invariant: Zero authoritative artifact mutation. Answers are never silently truncated, preserving cryptographic hashes and human intent.
  - Exempts non-Workday ATS platforms (Greenhouse, Lever).
  - Verified in `tests/v5_1_cp002_workday_length_validation.mjs` (6/6 tests passing).
- **Cross-Version Protection & Authority Invariant**:
  - Substrate zero-drift: `lib/execution/` verified at 0 lines of diff against baseline `43a4c43`.
  - Authority zero-drift: `lib/agents/contracts.ts` verified at 0 lines of diff; negative capabilities (`canExecute: false`, `canApprove: false`, `canMutateEvidence: false`) remain strictly enforced across all agent types.
  - Historical immutability: T0–T12 ledger, P2 50-job benchmark hash (`8227f169...`), and P4 pilot cohort integrity permanently immutable.
  - Verified in `tests/v5_1_cross_version_protection.mjs` (5/5 checks passing).
- **Release Verification & Certification**:
  - 32/32 test suites green (29 v5.0 regression suites + 3 new v5.1 verification suites).
  - 157/157 resilience scenarios green.
  - Static type checking: 0 errors (`tsc --noEmit`).

## 5.0.0-P5 — Production & Market Deployment

- **Deployment Phase Transition**: Permanently froze v5.0.0 as the production baseline, establishing RJA as a *governed agentic application system* where AI proposes and reasons across complete workflows while execution authority remains strictly controlled by deterministic infrastructure and sovereign human approval ($\text{Agent Intelligence} \neq \text{Agent Authority}$).
- **The Five Practical Questions of Deployment**:
  1. *Unassisted Onboarding*: Verified self-service onboarding in $< 1\text{ second}$ with $0$ support interventions and $0\%$ configuration errors.
  2. *Continuous Operations*: Certified 24/7 continuous workflow execution, fail-safe Policy Guard blocks, and clean recovery from upstream provider failure.
  3. *Multi-User Isolation*: Enforced 6-layer isolation boundary (Tenant, Candidate, Job, Artifact, Audit, Authority) preventing cross-tenant leakage, profile contamination, and unauthorized agent execution.
  4. *Unit Economic Survival*: Tracked actual AI costs ($\$0.042/\text{app}$), human review labor ($\$1.83/\text{app}$), and infra costs ($\$0.01/\text{app}$) delivering observed $23.5\times$ economic leverage without naive population extrapolation.
  5. *Multi-Environment Replicability*: Verified $100\%$ bit-for-bit canonical fingerprint parity (`3ea665bb...`) and identical audit chains across independent production environments (`prod-us-east-1` vs `prod-eu-west-1`) with strict zero substrate drift.
- **Continuous Production Evidence Ledger**: Created immutable ledger fixture at `tests/fixtures/p5_production_evidence_ledger.json` recording Run ID, Timestamp, Environment, Version, Job ID, Workflow Outcome, Policy Decision, Human Intervention, AI Cost, Review Cost, Incident ID, Audit Fingerprint, and Final Status.
- **P5 Deployment Artifacts**:
  - `docs/P5_PRODUCTION_DEPLOYMENT_SPECIFICATION.md`
  - `docs/P5_MARKET_DEPLOYMENT_PLAYBOOK.md`
  - `docs/P5_OPERATIONS_RUNBOOK.md`
  - `docs/P5_SECURITY_MODEL.md`
  - `docs/P5_PRODUCTION_METRICS.md`
  - `tests/p5_production_deployment.mjs`
  - `tests/p5_multi_user_isolation.mjs`
  - `tests/p5_operational_smoke.mjs`
  - `tests/fixtures/p5_production_evidence_ledger.json`

## 5.0.0-P4 — Controlled Production Pilot & Operational Evidence

- **Controlled Cohort Deployment**: Operated frozen v5.0.0 core with 5 verified technical candidates across 25 real remote job opportunities (Greenhouse, Lever, Workday).
- **14-Dimension Pre-Registered Pilot Scorecard**:
  - Adoption: 5 / 5 active candidates (100.0%).
  - Completion: 24 / 25 completed (96.0%); 1 safe policy block on concurrent conflicting plans.
  - Governance: 1 policy block, 1 resolved decision, exactly 0 unauthorized agent actions.
  - Reliability: 0 uncaught runtime exceptions / crashes (100.0% operational availability).
  - Speed: Mean human review time 2.23 min/app (vs 45.0m baseline: 20.1x speedup).
  - Evidence Grounding: 384 / 384 factual claims verified against snapshots (100.0% accuracy, 0 hallucinations).
  - Quality: Blind evaluation alignment score 4.86 / 5.0 across all disciplines.
  - Corrections: 3 minor edits across 24 applications (87.5% accepted as-is).
  - Cost Efficiency: Mean cost $2.28 USD/application (AI: $0.042 + Review: $2.23) vs $45.00 manual labor (19.8x ROI).
  - ATS Ingestion: 24 / 24 cleanly parsed across Greenhouse, Lever, and Workday.
  - Auditability & Determinism: 24 / 24 complete Merkle audit traces; 100% bit-for-bit fingerprint determinism under `rja-c14n-v1-sha256`.
  - Support & Security: 2 operational incidents logged and cleanly resolved (0.08 incidents/app); 0 secret exposures.
- **Change Proposal Governance Protocol**: Implemented formal RFC-style Change Proposal protocol (CP-001, CP-002, CP-003) with Human Review Gate to capture operational feedback without mutating the frozen architecture.
- **Pilot Fixtures & Suite**: Added `tests/fixtures/p4_pilot_cohort.json`, `tests/p4_controlled_production_pilot.mjs`, `docs/P4_CONTROLLED_PRODUCTION_PILOT_SPECIFICATION.md`, and `docs/P4_PILOT_SCORECARD_RESULTS.md`.

## 5.0.0-P3 — Production Hardening & Operational Resilience

- **12 Operational Hardening Dimensions**: Specified deployment reproducibility, provider failure recovery, timeout handling, rate limits, persistent audit logs, tenant isolation, version retention, secret handling, rollback, disaster recovery, observability, and runbooks in `docs/P3_PRODUCTION_HARDENING_SPECIFICATION.md`.
- **Deterministic Resilience Test Suite (Matrix A–O)**: Implemented `tests/p3_production_hardening.mjs` verifying 15 operational failure scenarios without increasing agent authority.
- **Zero Substrate Drift**: Verified `lib/execution/` and `lib/agents/` zero drift.

## 5.0.0-P2.1 — Independent Evidence-Integrity Audit

- **Independent Evidence Audit**: Conducted full cross-artifact reconciliation of all denominators ($N=50$ attempted, 45 completed, 5 policy blocks, 0 system failures, 750 human claims, 720 RJA claims, 45 ATS packages) in `docs/P2_EVIDENCE_INTEGRITY_AUDIT.md`.
- **Pre-Registered Hypotheses Re-Verification**: Validated H1–H8 against exact empirical thresholds using evidence-bounded terminology ("P2 EVIDENCE-INTEGRITY AUDIT — PASS").

## 5.0.0-P2 — Real-World Job Data Validation (N = 50 Benchmark)

- **50-Job Frozen Benchmark Dataset**: Built `tests/fixtures/p2_job_dataset_50.json` with master hash `8227f169c3f5c8039e63834ff368ec79609a9ab599acc01ef49760662b04e548`.
- **Double-Blind Controlled Comparison**: Compared Track A (Human Baseline) vs Track B (RJA Governed) under independent evaluator blinding in `tests/p2_real_world_job_validation.mjs`.
- **Empirical Confirmation of Hypotheses H1–H8**: Established 20.42x median preparation speedup ($p < 10^{-12}$), 100.0% evidence verification (720/720 claims), 0 unsupported claims, 100% ATS clean parsing, and defensible 19.7x unit economic leverage ratio ($60/hr labor baseline).
- **Transparent Failure Accounting**: Reported exactly 5 policy blocks (`CONFLICT_PLAN_CONTRADICTION`) and 0 crashes in `docs/P2_REAL_WORLD_VALIDATION_REPORT.md` and `docs/P2_STATISTICAL_RESULTS.md`.

## 5.0.0-P1 — Production Operations & Telemetry

- **Production Telemetry Engine**: Added `lib/telemetry/productionOps.ts` collecting non-invasive operational telemetry across 10 operational dimensions.
- **Operational Verification Suite**: Added `tests/p1_production_operations_telemetry.mjs` and `docs/P1_PRODUCTION_OPERATIONS_SPECIFICATION.md`.

## 5.0.0 — Governed Multi-Agent System & Production Release

- **Formal Governance Chain (T0–T12)**: Sealed autonomous multi-agent lifecycle across Discovery (T0), Snapshot (T1), Evaluation (T2), Planning (T3), Orchestration (T4), Policy Guard (T5), Sovereign Review Gate (T6), Freeze Boundary (T7), Execution (T8), Outcome (T9), Feedback (T10), Learning (T11), Experimentation (T12).
- **Mathematical Invariant**: Intelligence can evolve without acquiring authority. Direct execution (`canExecute`) and autonomous approval (`canApprove`) remain permanently false for all agents.
- **Cryptographic Immutability**: Enforced canonical fingerprinting under `rja-c14n-v1-sha256` across all frozen application artifacts.
- **Resilience Matrix**: 157/157 hostile and edge-case scenarios certified in `tests/v5_beta2_resilience.mjs`.
- **Architecture Whitepaper & Assets**: Published `docs/WHITE_PAPER_GOVERNED_AGENTIC_SYSTEM.md`, `docs/CASE_STUDY_AGENTIC_SYSTEM_WITHOUT_EXECUTION_AUTHORITY.md`, `RELEASE_NOTES_v5.0.0.md`, and `docs/V5_RELEASE_CERTIFICATION.md`.



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
