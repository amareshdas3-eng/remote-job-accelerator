# RJA v5.1.0: Evidence-Driven Product Evolution Plan

**Target Release:** RJA v5.1.0  
**Baseline Foundation:** RJA v5.0.0 (`v5.0.0` Frozen Core — Architecture Baseline)  
**Governance Protocol:** Production Evidence Ledger $\to$ Approved RFC $\to$ Controlled Implementation $\to$ Full Regression $\to$ Measured Release  
**Document Version:** 1.0.0  

---

## 1. Executive Summary & The Evidence-Bounded Rule

With the successful completion of **Phase P5 — Production & Market Deployment**, RJA has verified its operational capabilities under controlled conditions. To maintain scientific integrity and the credibility established through the Phase P2 independent audit, all external communications (GitHub, investor decks, customer documentation) must uphold the **evidence-bounded distinction**:

- **Observed:** P5 deployment tests passed completely across multi-environment setups.
- **Verified:** Specified 6-layer multi-user isolation, multi-environment reproducibility, unassisted onboarding, operational failure recovery, and governance barriers passed.
- **Measured:** Reported unit economics ($19.8\times - 23.5\times$ economic leverage, $\$1.92 - \$2.28$ total cost/app) occurred under the evaluated pilot and smoke cohort test conditions.
- **Not Automatically Established:** Universal 24/7 availability across arbitrary clouds, unbounded multi-tenant scale, or generic market-wide economics across untested sectors.

---

## 2. The Architectural Continuum: v5.0 Baseline $\to$ v5.1 Evolution

RJA does not enter another speculative engineering cycle. v5.0.0 remains the **permanent, immutable production baseline**:

```
                       v5.0.0 PRODUCTION BASELINE
                                   │
                                   ▼
                       Production Evidence Ledger
                      (tests/fixtures/p5_production_evidence_ledger.json)
                                   │
                                   ▼
                         Change Proposal (RFC)
                                   │
                            Human Approval
                             /          \
                            /            \
                        Reject          Approve
                                          │
                                          ▼
                                 v5.1.0 Workstream
                                   ├── CP-001 (Relocation Prompt)
                                   └── CP-002 (Workday Length Guard)
```

### The Invariant of Product Evolution
$$\mathbf{\text{Agent Intelligence}} \neq \mathbf{\text{Agent Authority}}$$
Production usage creates **evidence**, not authority. The core authority boundary remains impervious: agents propose and reason, while deterministic code and sovereign humans approve and execute.

---

## 3. The Controlled v5.1.0 Implementation Backlog

Only RFCs formally approved by the Human Review Gate are admitted into v5.1.0:

### RFC / Change Proposal 1: CP-001 (Approved)
- **Title:** Structured Relocation Decision Surfacing in Policy Guard
- **Origin:** P4 Pilot (`app-pilot-017`, JPMorgan Chase on-site requirement)
- **Problem Statement:** Policy Guard correctly flagged an on-site requirement for a remote candidate, but required manual out-of-band waiver writing.
- **Implementation Scope:**
  - Introduce a structured `relocation_waiver` decision field in `lib/agents/governance.ts` (`PolicyDecision` & `requiredHumanDecisions`).
  - Render an explicit checkbox in the candidate Sovereign Review interface: `[x] Confirm Remote Exception / Relocation Discussion`.
  - Record the candidate's explicit choice into the cryptographic audit record.
- **Authority Impact:** Zero positive authority granted to agents; human sovereignty preserved.

### RFC / Change Proposal 2: CP-002 (Approved)
- **Title:** Workday Screening Answer Character Limit Pre-Validation
- **Origin:** P4 Pilot (`app-pilot-005` & `app-pilot-019`, enterprise Workday portal truncation)
- **Problem Statement:** Certain Workday tenant configurations impose a hard 250-character limit on screening text areas, causing rejection at final dispatch.
- **Implementation Scope:**
  - Add ATS-specific validation rule in orchestrator proposal builder: when `destination === 'workday'`, enforce max answer length $\le 240$ characters.
  - Add client-side pre-flight character count warning in the review workspace.
- **Authority Impact:** Deterministic validation formatting; zero impact on agent authority.

### RFC / Change Proposal 3: CP-003 (Deferred)
- **Title:** Candidate Skill Citation Interactive Hover Tooltip
- **Origin:** P4 Pilot (`app-pilot-008`, HashiCorp)
- **Status:** ⏸️ **DEFERRED** (Backlog UI Polish for v5.2 workstream; does not block core operational workflow).

---

## 4. Release Gate Criteria for v5.1.0

Before v5.1.0 can be tagged, the following release gates must be 100% satisfied:

1. **Complete v5.0.0 Regression Suite:** All 29 regression test suites and 157 resilience scenarios must pass cleanly without modification.
2. **Dedicated Test Suites for Approved Changes:**
   - `tests/v5_1_cp001_relocation_decision.mjs`: Validates structured relocation decision surfacing, audit logging, and rejection of bypassed decisions.
   - `tests/v5_1_cp002_workday_length_validation.mjs`: Validates character-limit enforcement for Workday portal applications.
3. **Authority-Boundary Regression:** Re-verify that `canExecute === false`, `canApprove === false`, and `canMutateEvidence === false` across all agent envelopes.
4. **Historical Immutability Regression:** Ensure all past v5.0.0 audit receipts, evidence snapshots, and frozen artifacts remain bit-for-bit valid.
5. **Static Analysis & Type Safety:** `npm run typecheck` passes with zero errors.
6. **Production Evidence Comparison:** Verify that v5.1.0 delivers identical or improved unit economics ($C_{\text{Total}} \le \$2.28$) and speed ($T_{\text{Review}} \le 2.5\text{ min}$) compared to the v5.0.0 baseline.

---

## 5. Summary of Milestones

| Milestone | Scope | Status |
| :--- | :--- | :--- |
| **v5.0.0** | Core Governed Agentic Architecture & Resilience Matrix | ✅ Certified |
| **Phase P1** | Production Operations & 10-Dimension Telemetry Engine | ✅ Certified |
| **Phase P2** | Real-World Job Validation (50 Jobs, Double-Blind Comparison) | ✅ Certified |
| **Phase P2 Audit** | Cross-Artifact Denominator Reconciliation & Evidence Audit | ✅ Certified |
| **Phase P3** | Production Hardening & 15 Failure Scenarios (Matrix A–O) | ✅ Certified |
| **Phase P4** | Controlled Production Pilot (5 Candidates, 25 Applications) | ✅ Certified |
| **Phase P5** | Production & Market Deployment (5 Questions & Evidence Ledger)| 🏆 Certified |
| **v5.1.0** | Evidence-Driven Product Evolution (CP-001 & CP-002) | 🎯 Planned Next |
