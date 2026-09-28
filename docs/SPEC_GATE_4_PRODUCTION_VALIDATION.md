# Specification: Gate 4 — v5.2.0 Production Validation

**Document ID**: `SPEC-GATE-4-PRODUCTION-VALIDATION`  
**Baseline Version**: `v5.2.0` (Commit `fcd538c`)  
**Scope**: Empirical Validation of RFC-CP-004 Controlled Implementation  
**Status**: `ACTIVE_SPECIFICATION`  
**Date**: `2026-09-28`  

---

## 1. Objective & Governing Epistemology

Gate 4 transitions RJA from **implementation verification** to **empirical operational validation**.

In accordance with the RJA epistemological standard:
> **Target hypotheses must not be claimed as demonstrated production outcomes until an empirical production validation cohort establishes them.**

Gate 4 operates the frozen `v5.2.0` system against a real production validation workload to test four formal hypotheses, verify cognitive ergonomics, and validate that zero ungrounded claims escape to the dispatch substrate.

---

## 2. Gate 4 Hypotheses & Measurement Targets

| Hypothesis ID | Dimension | Formal Hypothesis | Target Metric / Benchmark |
| :--- | :--- | :--- | :--- |
| **H1** | **Review Time Reduction** | Pre-flight narrative guidance reduces post-generation editing friction during human review. | For customized applications, mean review duration $\le 2.25\text{ min}$ (representing an empirical saving of $\sim 35\text{–}50\text{ seconds}$ relative to the $2.84\text{ min}$ unguided baseline). |
| **H2** | **Adoption & Omission Ergonomics** | Default-collapsed UI prevents prompt fatigue for the majority while remaining accessible when needed. | Standard applications omit custom narrative in $\ge 90\%$ of runs ($0$ required clicks/dismissals); custom adoption observed in $5\%\text{–}10\%$ of runs. |
| **H3** | **Hallucination Firewall** | Policy Guard audits $100\%$ of custom text against verified candidate snapshots. | **$0$ ungrounded claims escape** to external dispatch; ungrounded credential injections yield $100\%$ `BLOCK` rate. |
| **H4** | **Artifact Determinism & Substrate Integrity** | Canonical hashing determinism and zero substrate drift are preserved under production load. | **$100\%$ deterministic replay** (`rja-c14n-v1-sha256`); **$0$ diff lines** in `lib/execution/` and `lib/agents/contracts.ts`. |

---

## 3. Operational Telemetry Schema (`v5.2.0`)

Each production run in the validation cohort records the following CP-004 telemetry fields in the evidence ledger:

```typescript
export interface V52ProductionValidationRecord {
  runId: string;
  timestamp: string;
  candidateId: string;
  jobId: string;
  employer: string;
  employerTier: 'tier_1_enterprise' | 'growth_unicorn';
  atsPlatform: 'greenhouse' | 'workday' | 'lever' | 'ashby' | 'smartrecruiters';
  workflowOutcome: 'COMPLETED' | 'BLOCKED' | 'ABANDONED' | 'FAILED';
  dispatchedStatus: 'DISPATCHED_TO_EXTERNAL' | 'BLOCKED_AT_POLICY' | 'DROPPED_BY_HUMAN' | 'QUEUED_SAFE_RETRY';
  
  // CP-004 Specific Telemetry Fields
  customParagraphProvided: boolean;
  customParagraphLength: number;
  customParagraphAudited: boolean;
  ungroundedClaimsDetected: number;
  customParagraphIncorporated: boolean;
  
  // Operational Metrics
  reviewDurationMinutes: number;
  aiCostUsd: number;
  reviewCostUsd: number;
  policyDecision: 'ALLOW_REVIEW' | 'REQUIRE_HUMAN_DECISION' | 'BLOCK';
  policyFindingsCount: number;
  humanEditMade: boolean;
  
  // Governance & Integrity Invariants
  auditFingerprint: string;
  canonicalizationAlgorithm: 'rja-c14n-v1-sha256';
  deterministicReplayVerified: boolean;
  authorityViolationDetected: boolean;
}
```

---

## 4. Acceptance Criteria for Gate 4 Certification

1. **Cohort Size**: Validation cohort $N \ge 30$ production runs across diverse employer tiers and ATS platforms.
2. **Review Duration Validation**: Empirical mean review duration for custom-tailored runs shows a statistically significant decrease compared to the $2.84\text{m}$ unguided editing baseline.
3. **Ergonomic Omission Validation**: Standard applicants experience zero prompts, modals, or mandatory actions.
4. **Firewall Integrity**: Dispatched evidence claims verification rate = **$100.0\%$**. Zero ungrounded credentials escape.
5. **Deterministic Replay Rate**: **$100.0\%$** replay pass rate.
6. **Substrate Zero-Drift**: Verified 0 modified lines in `lib/execution/` and `lib/agents/contracts.ts`.
7. **Regression Parity**: All 35 regression test suites and 157 resilience scenarios remain 100% green.
