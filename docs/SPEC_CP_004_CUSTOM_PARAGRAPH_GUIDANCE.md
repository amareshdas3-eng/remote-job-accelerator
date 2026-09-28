# Technical Implementation Specification: CP-004

**Document ID**: `SPEC-CP-004-CUSTOM-PARAGRAPH-GUIDANCE`  
**Governing RFC**: [RFC-CP-004-COVER-LETTER-CUSTOM-PARAGRAPH](file:///c:/RJA/v4.3/app/docs/RFC_CP_004_HUMAN_REVIEW_PACKAGE.md)  
**Authorization Signature**: `SIG-HUMAN-AUTH-RFC-CP-004-APPROVED`  
**Target Release**: `v5.2.0`  
**Date**: `2026-09-28`  
**Status**: `APPROVED_FOR_IMPLEMENTATION`  

---

## 1. Architectural Principles & Governing Invariants

The implementation of CP-004 must adhere strictly to the RJA Governance Invariants:

1. **AI Proposes, Human Authorizes**: The pre-flight guidance provides a structured channel for candidate intent. It does *not* grant agents ambient discretion or execution privileges.
2. **Zero Agent Authority Added**: `lib/agents/contracts.ts` authority registry remains strictly `PROPOSAL_ONLY` / `REPRESENTATIONAL_ONLY`. Agents cannot approve, dispatch, or execute autonomously.
3. **Zero Substrate Drift**: Files in `lib/execution/` (`engine.ts`, `fingerprint.ts`, `snapshot.ts`, `stateMachine.ts`, `types.ts`) must exhibit **strictly 0 diff lines**.
4. **Substrate Digest Invariant**: `rja-c14n-v1-sha256` remains the sole canonicalization scheme.
5. **Mitigation of Measured Prompt-Fatigue Risk**: Because $94.17\%$ of applicants in the $N=120$ production baseline do *not* require custom text, the pre-flight input must be **strictly optional, default-collapsed, and non-blocking**.

---

## 2. Technical Acceptance Criteria

### AC-1: Pre-Flight Data Schema
The proposal generation request payload supports an optional field:
```typescript
export interface ProposalGenerationOptions {
  candidateId: string;
  jobId: string;
  /**
   * Optional pre-flight custom narrative focus or draft paragraph provided by candidate.
   * Max length: 1,000 characters.
   * If omitted or empty, baseline v5.1.0 deterministic synthesis is executed.
   */
  tailoredCoverLetterParagraph?: string | null;
}
```

### AC-2: Default-Collapsed UI & Cognitive Ergonomics
- The input field must never appear as a blocking modal or mandatory wizard step.
- In the pre-flight configuration, the UI renders an optional, collapsed accordion:  
  `[+] Add optional custom narrative emphasis (Optional)`
- When collapsed (the default state for $\ge 94\%$ of applicants), zero keystrokes or dismissals are required to proceed.

### AC-3: Deterministic Proposal Synthesis
- If `tailoredCoverLetterParagraph` is present and valid ($1 \le \text{length} \le 1000$):
  - The Planning Agent deterministically places the sanitized narrative in a dedicated section (`customNarrativeParagraph`) within the generated `CoverLetterArtifact`.
  - Evidence citations for standard skills/experience remain intact and grounded.
- If omitted or whitespace-only:
  - Output is identical to `v5.1.0` baseline cover letter generation.

### AC-4: Policy Guard Evidence Verification
- All factual claims extracted from `tailoredCoverLetterParagraph` must be validated against the Candidate Evidence Snapshot.
- If a candidate includes unverified credentials (e.g. claims of unverified degrees or false employment):
  - Policy Guard returns `BLOCK` or `REQUIRE_HUMAN_DECISION` with code `POLICY_VIOLATION_UNGROUNDED_CLAIM`.
  - Dispatched evidence verification rate remains strictly **$100.0\%$**. Zero ungrounded claims may reach the dispatch substrate.

### AC-5: Canonical Fingerprint Integrity
- When included, `tailoredCoverLetterParagraph` is part of the canonical payload hashed by `rja-c14n-v1-sha256`.
- Replaying the proposal generation with the same input yields an identical canonical hash.

---

## 3. Dedicated Verification Suite

A new dedicated test suite `tests/v5_2_cp004_custom_paragraph.mjs` must test:
1. **Omission Baseline**: Generation without custom paragraph matches baseline behavior.
2. **Harmonious Incorporation**: Valid custom paragraph is correctly integrated into cover letter artifact.
3. **Ungrounded Claim Interception**: Custom text containing unverified credentials is intercepted by Policy Guard.
4. **Length Ceiling Enforcement**: Custom text $>1000$ chars rejected at validation gate.
5. **Deterministic Replay**: Re-running synthesis produces byte-identical canonical hash.
6. **Substrate Zero-Drift**: Automated diff test confirming 0 modified lines in `lib/execution/`.
7. **Authority Contract Immutability**: Automated registry audit confirming 0 positive authority added to agents.

---

## 4. Finite Roadmap to "RJA DONE"

Following human authorization, RJA executes the remaining finite release gates:

```
┌────────────────────────────────────────────────────────┐
│ Gate 1: Human CP-004 Authorization (APPROVED ✅)       │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Gate 2: Controlled CP-004 Implementation               │
│ - Implement optional pre-flight schema                 │
│ - Integrate into Planning Agent proposal generator     │
│ - Add Policy Guard claim auditing rule                 │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Gate 3: Regression & Resilience Certification          │
│ - tests/v5_2_cp004_custom_paragraph.mjs (100% green)  │
│ - 34+ existing regression suites (100% green)          │
│ - 157 resilience scenarios (100% green)                │
│ - npm run typecheck (0 errors)                         │
│ - Substrate zero-drift verified (0 lines)              │
│ - Authority registry verified (0 positive capabilities)│
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Gate 4: v5.2.0 Production Validation                   │
│ - Telemetry verification of ~43s review saving delta   │
│ - Zero prompt fatigue on standard workflows            │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Gate 5: Final RJA Comprehensive Certification          │
│ - Unified Audit (Architecture, Security, Governance,   │
│   Evidence, Economics, Resilience, and Auditability)   │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Gate 6: Permanent Architecture Freeze (🏁 RJA DONE)    │
│ - Repository locked against feature sprawl             │
│ - Operating model permanently frozen                   │
└────────────────────────────────────────────────────────┘
```
