# RFC-CP-004: Pre-Flight Tailored Custom Paragraph Guidance
## Human Review Package & Evidence Sufficiency Dossier

**Document ID**: `RFC-CP-004-HUMAN-REVIEW-PACKAGE`  
**Governed Baseline**: `v5.1.0`  
**Status**: `PROPOSED_FOR_HUMAN_REVIEW`  
**Governance Branch**: `Branch B (Improvement Opportunity)`  
**Authority Invariant**: *Telemetry must never become an authority channel.*  

---

## 1. Executive Summary & Operational Context

Under the governed operating model of RJA v5.1.x, production telemetry accumulates empirical evidence without granting autonomous mutation authority to the system. During the $N=60$ production evidence accumulation window, candidate operational telemetry identified a recurring friction pattern in candidate proposal reviews:

* **Observation**: In $3/60$ applications ($5.00\%$), candidates manually paused during the human review gate to inject a tailored custom paragraph into the generated cover letter before granting approval.
* **Segment Concentration**: All occurrences ($3/3$) occurred within **Tier-1 Enterprise Applications** ($3/40 = 7.50\%$), where job seekers frequently seek to highlight bespoke connections (e.g., referral context, specific team mission alignment, or unique cross-domain background) not automatically highlighted by standard evaluation heuristics.
* **Current State**: The system forces the candidate to perform post-generation text editing inside the review UI, adding ~45 seconds of manual friction per tailored application.

In accordance with the RJA evolution protocol, this package presents the complete **12-Field RFC Evidence Sufficiency Dossier** for human decision. **Zero production behavior will change without explicit human sign-off.**

```
v5.1.0 Baseline (Frozen)
         │
         ▼
Production Evidence Ledger (N=60)
         │
 ┌───────┼────────────────────────┐
 ▼       ▼                        ▼
Branch A Branch B                 Branch C
Nominal  RFC-CP-004 Dossier       Security / Anomaly
Operate  (Human Review Gate)      (HALTED_SAFE - 0 observed)
         │
         ├── [APPROVED] ──────────► Spec ──► Dedicated Tests ──► Regression ──► Future Release
         ├── [REJECTED] ──────────► Discard proposal; continue operating v5.1.0
         └── [NEED MORE DATA] ────► Accumulate to N >= 120 before deciding
```

---

## 2. Mandatory RFC Evidence Sufficiency Dossier (12 Fields)

The following 12 fields are formally required for any proposed change package (CP-00x) prior to human versioning decisions:

### Field 1: RFC ID
* **Identifier**: `RFC-CP-004-COVER-LETTER-CUSTOM-PARAGRAPH`
* **Title**: Pre-Flight Adaptive Guidance for Cover Letter Custom Paragraphs

### Field 2: Evidence Window
* **Start Timestamp**: `2026-09-28T09:00:00.000Z`
* **End Timestamp**: `2026-09-28T16:15:00.000Z`
* **Run Index Range**: Runs `1` through `60` in [tests/fixtures/v5_1_production_evidence_ledger.json](file:///c:/RJA/v4.3/app/tests/fixtures/v5_1_production_evidence_ledger.json)

### Field 3: Denominator ($N$)
* **Evaluated Cohort Denominator**: $N = 60$ completed production runs.
* **Pre-requisite Gate**: Exceeds minimum statistical threshold ($N \ge 50$) established by the v5.1.x Evidence Maturity Gate.

### Field 4: Affected Segment
* **Category**: `cover_letter_custom_paragraph`
* **Segment Scope**: Tier-1 Enterprise applications with custom cover letter requirements.
* **Segment Volume**: $3 / 40$ in Tier-1 Enterprise ($7.50\%$), representing $3 / 60$ ($5.00\%$) of aggregate workload volume.

### Field 5: Observed Rate
* **Numerator**: $3$ occurrences
* **Denominator**: $60$ runs
* **Observed Frequency**: **$5.00\%$** ($3/60$)
* **Threshold Status**: Exceeds the empirical RFC trigger threshold ($\ge 5.0\%$).

### Field 6: 95% Confidence Interval (Wilson Score)
* **Confidence Interval**: **$[1.71\%,\, 13.70\%]$**
* **Method**: Closed-form binomial Wilson score interval with continuity correction ($z = 1.96$).
* **Interpretation**: We are 95% confident that the true population frequency of manual cover letter paragraph editing among enterprise applicants is between $1.71\%$ and $13.70\%$.

### Field 7: Baseline Behavior
* **Governed Baseline**: `v5.1.0`
* **Current Behavior**: 
  The Planning Agent synthesizes cover letters deterministically from the candidate's frozen evidence snapshot and job description. Candidates are provided no pre-generation mechanism to specify custom narrative emphasis (e.g. "Highlight my work scaling distributed Redis clusters"). Consequently, candidates who desire custom emphasis must manually type or paste text into the proposal editor during the human review gate.

### Field 8: Expected Benefit
* **Target Metric**: Mean Human Review Duration & Candidate Edit Frequency.
* **Estimated Quantitative Improvement**: 
  - Reduces mean review time on tailored enterprise applications from $2.85\text{ min}$ to $\le 2.10\text{ min}$ ($\sim 45\text{ seconds saved per tailored application}$).
  - Reduces post-generation human edit rate from $5.00\%$ toward $< 1.0\%$.
* **Impact Summary**: 
  Candidates can provide optional, structured guidance or a specific draft paragraph *before* generation, allowing the Orchestrator/Planning pipeline to harmonize the paragraph into the proposal format while verifying all claims against the evidence snapshot.

### Field 9: Potential Regression Analysis
* **Risk Factors Identified**:
  1. *Prompt Fatigue*: Prompting candidates for a custom paragraph on every application would add unnecessary cognitive friction for high-volume or standard applications.
  2. *Ungrounded Claim Injection*: If a candidate inputs custom text containing factual claims not grounded in their profile (e.g., claiming unverified credentials), it could fail downstream Policy Guard checks or risk hallucination escape.
* **Mitigation Strategies**:
  1. *Strictly Optional & Default-Collapsed*: The pre-flight guidance prompt will be purely optional, collapsed by default, and only active when the candidate explicitly expands "Add Tailored Paragraph / Context".
  2. *Enforced Evidence Truth Audit*: Any text supplied in the pre-flight prompt must be parsed into claims and validated by Policy Guard against the Candidate Evidence Snapshot. If ungrounded, the system halts with `UNGROUNDED_CLAIM` before human approval.

### Field 10: Authority Impact Assessment
* **Expands Agent Authority**: **FALSE** (Strictly Zero).
* **Modifies Substrate**: **FALSE** (`lib/execution/` and canonicalizer remain 100% frozen).
* **Negative Capabilities Preserved**: **TRUE** (Agents remain strictly incapable of approval, execution, or ambient mutation).
* **Governance Tier**: `PROPOSAL_ONLY` / `REPRESENTATIONAL_ONLY`.
* **Substrate Digest Invariant**: `rja-c14n-v1-sha256` remains the sole canonicalization scheme.

### Field 11: Human Decision State
* **Current State**: `PENDING_REVIEW`
* **Permissible Outcomes**:
  - `APPROVED`: Proceed to formal implementation specification, dedicated test suite, and regression audit.
  - `REJECTED`: Retain current behavior; close RFC.
  - `REQUEST_MORE_EVIDENCE`: Defer decision until evidence denominator reaches $N \ge 120$.

### Field 12: Decision Rationale
* **Current Rationale**: `null` (Awaiting human reviewer determination).

---

## 3. Human Reviewer Action Form

To be executed by the authorized human engineering lead:

```markdown
### Review Sign-off Block

- [ ] APPROVED: Proceed with CP-004 implementation under Branch B.
- [ ] REJECTED: Reject CP-004; continue operating v5.1.0 under Branch A.
- [ ] REQUEST_MORE_EVIDENCE: Defer decision; expand production ledger to N >= 120.

Reviewer Name: ___________________________________
Reviewer Role: ___________________________________
Timestamp:     ___________________________________
Signature:     ___________________________________

Decision Rationale / Instructions:
__________________________________________________________________________
__________________________________________________________________________
__________________________________________________________________________
```

---

## 4. Execution Sequence if Approved (Branch B)

Should the human reviewer select `APPROVED`, the implementation must adhere strictly to the governed evolution protocol:

1. **Phase 1: Implementation Specification**
   - Create `docs/CP_004_IMPLEMENTATION_SPECIFICATION.md`.
   - Define the pre-flight optional schema (`tailoredCoverLetterParagraph?: string`).
   - Define the Policy Guard validation rule to audit injected text against the evidence profile.

2. **Phase 2: Dedicated Test Suite**
   - Create `tests/v5_2_cp004_custom_paragraph.mjs`.
   - Verify:
     - Optional input gracefully omitted by default.
     - Provided valid text seamlessly incorporated into proposal.
     - Injected ungrounded claim strictly caught by Policy Guard.
     - Hash of authoritative package remains byte-for-byte deterministic.

3. **Phase 3: Cross-Version & Substrate Protection**
   - Verify `git diff HEAD lib/execution/` is strictly 0 lines.
   - Verify `git diff HEAD lib/agents/contracts.ts` is strictly 0 lines.
   - Verify historical T0–T12 ledger records remain unmodified.

4. **Phase 4: Full Regression Certification**
   - Execute all 34 existing test suites + 157 resilience scenarios.
   - Verify 100% green pass rate.

5. **Phase 5: Version Release Decision**
   - Only after all gates pass may a human engineer decide whether to release as `v5.2.0` or maintain as `v5.1.1`.
