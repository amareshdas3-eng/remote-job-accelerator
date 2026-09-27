# Specification: v5.0-alpha9 — Controlled Learning & Adaptive Intelligence

## The Governing Invariant of Controlled Learning

> **"Learning creates a new version; it does not rewrite the version that created history."**
>
> $$I_v \longrightarrow \text{Historical Decisions} \, (T_0 \dots T_{10})$$
>
> $$\text{Feedback} \, (T_{10}) \longrightarrow \text{LearningProposal}$$
>
> $$\text{Approved}(\text{LearningProposal}) \longrightarrow I_{v+1}$$
>
> $$I_{v+1} \centernot\longrightarrow \text{Modify}(T_0 \dots T_{10})$$

---

## 1. Architectural Closed Loop with Versioned Intelligence

Alpha8 proved that execution outcomes can safely become verifiable evidence without mutating historical decisions.
Alpha9 introduces the controlled mechanism by which the system adapts:

```text
                    HISTORICAL TRUTH (T0 - T10)
                                 │
                                 ▼
                         EVIDENCE FEEDBACK
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │  CONTROLLED LEARNING  │  (v5.0-alpha9)
                     │                       │
                     │ Pattern Detection     │
                     │ Regression Check      │
                     │ Explicit Diff Draft   │
                     └───────────┬───────────┘
                                 │
                                 ▼
                        LEARNING PROPOSAL
                                 │
                        ┌────────┴────────┐
                        ▼                 ▼
                  Server Policy     Human Review
                   Validation             │
                        └────────┬────────┘
                                 ▼
                        NEW VERSIONED PROFILE
                       (IntelligenceProfile v2)
                                 │
                                 ▼
                          FUTURE RUN ONLY
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
           Discovery v2                     Evaluation v2
                │                                 │
                └─────── Fresh Governance ────────┘
```

Crucial architectural rules:
1. **Explicit Diff Requirement**: Every adaptation requires an explicit before/after diff (`previousValue` vs `proposedValue`), parameter target, supporting feedback citations, and rationale.
2. **Version Chain Immutability**: Historical profiles ($I_v$) are strictly immutable (`Object.freeze`). Learning proposes $I_{v+1}$, referencing $I_v$ as its parent version.
3. **No Automatic Self-Activation**: Learning produces proposals. Only explicit server validation and candidate/human review can activate a new profile version.
4. **Regression Testing**: Learning proposals must run regression checks against historical datasets before submission to prevent degradation.

---

## 2. Core Schemas & Types

### Intelligence Rules & Profile

```typescript
export interface IntelligenceRule {
  ruleId: string;
  target: 'DISCOVERY_RULE' | 'EVALUATION_RULE' | 'PLANNING_RULE' | 'ORCHESTRATION_RULE' | 'EVIDENCE_RULE';
  parameter: string;
  value: unknown;
  description: string;
}

export interface IntelligenceProfile {
  profileId: string;
  version: string;
  parentVersion?: string;
  rules: IntelligenceRule[];
  createdAt: string;
  createdBy: 'system' | 'human' | 'controlled_learning';
  sourceLearningId?: string;
  evidenceReferences: string[];
  immutable: true;
}
```

### Learning Proposal & Regression Check

```typescript
export interface AdaptationChange {
  changeId: string;
  target: 'DISCOVERY_RULE' | 'EVALUATION_RULE' | 'PLANNING_RULE' | 'ORCHESTRATION_RULE' | 'EVIDENCE_RULE';
  parameter: string;
  previousValue: unknown;
  proposedValue: unknown;
  reason: string;
  supportingFeedbackIds: string[];
}

export interface LearningPattern {
  patternId: string;
  category: string;
  frequency: number;
  description: string;
  evidenceIds: string[];
}

export interface RegressionCheck {
  checkId: string;
  datasetHash: string;
  baselineProfileVersion: string;
  proposedProfileVersion: string;
  changedResults: number;
  regressionsDetected: number;
  status: 'PASS' | 'FAIL';
  details: string[];
}

export interface LearningProposal {
  learningId: string;
  sourceFeedbackIds: string[];
  sourceOutcomeIds: string[];
  sourceEvidenceIds: string[];
  currentProfileVersion: string;
  proposedProfileVersion: string;
  adaptations: AdaptationChange[];
  detectedPatterns: LearningPattern[];
  evidenceReferences: string[];
  confidence?: number;
  rationale: string[];
  regressionChecks: RegressionCheck[];
  createdAt: string;
  created_by: 'controlled_learning';
  immutable: true;
}

export type AgentLearningProposal = AgentProposal<LearningProposal>;
```

---

## 3. Strict Negative Authority Boundary

The Controlled Learning Agent (`agt-learning-v1`) operates under zero execution and zero approval authority:

```typescript
{
  canExecute: false,
  canApprove: false,
  canMutateEvidence: false
}
```

Prohibited operations:
- Direct evaluator-weight mutation
- Direct planner-rule mutation
- Direct discovery-rule mutation
- Direct orchestration mutation
- Automatic profile activation
- Self-approval
- Policy bypass
- Execution dispatch
- Mutating historical artifacts ($T_0 \dots T_{10}$)

---

## 4. Adversarial Test Matrix (36 Tests)

- **A. Learning Integrity (8)**: Forged feedback sources, forged outcome sources, forged evidence references, stale feedback, cross-candidate contamination, profile version mismatches, malformed adaptations, and post-creation modifications.
- **B. Historical Protection (6)**: Blocks attempted mutations of historical evaluations, plans, orchestration states, policy decisions, frozen artifacts, and outcomes.
- **C. Self-Modification & Authority Attacks (8)**: Blocks direct evaluator-weight mutation, planner-rule mutation, discovery-rule mutation, orchestration mutation, automatic profile activation, self-approval, policy bypass, and execution dispatch.
- **D. Version Integrity (5)**: Historical profile immutability, parent version pointer immutability, version-chain tampering detection, rollback tampering detection, and duplicate version detection.
- **E. Learning Correctness & Regression (7)**: Deterministic adaptation derivation, insertion-order invariance, evidence-to-change traceability, before/after diff correctness, regression detection, reproducibility, and future-only application.
- **F. Boundary Tests (2)**: New profile cannot modify historical outcomes; new profile still enters the full governance cycle for future applications.
