# RJA v5.0-alpha10: Controlled Optimization & Experimentation Specification

## 1. Overview & Golden Invariant

In RJA v5.0-alpha9, Controlled Learning introduced the ability to analyze historical execution feedback and formulate versioned adaptation proposals without mutating past decisions:
$$I_v \longrightarrow \text{Historical Decisions } (T_0 \dots T_{10}) \quad \text{and} \quad \text{Feedback}(T_{10}) \longrightarrow \text{LearningProposal}$$

**RJA v5.0-alpha10** introduces **Controlled Optimization & Experimentation** (`agt-experiment-v1`).
Before any `LearningProposal` can be considered by Policy Guard or submitted to human review for activation as $I_{v+1}$, it must be subjected to rigorous, side-by-side **deterministic replay** against a canonical benchmark dataset.

### 🔐 Golden Invariant
> **"An experiment may compare possible futures; it cannot alter historical truth or activate itself."**

Formally:
$$\begin{aligned}
\text{Dataset}(D) \times I_v &\xrightarrow{\quad\text{Replay}\quad} \text{Baseline Results } (R_{\text{base}}) \\
\text{Dataset}(D) \times I_{v+1} &\xrightarrow{\quad\text{Replay}\quad} \text{Candidate Results } (R_{\text{cand}}) \\
\text{Compare}(R_{\text{base}}, R_{\text{cand}}) &\longrightarrow \text{ExperimentResult}
\end{aligned}$$
but:
$$\begin{aligned}
\text{ExperimentResult} &\centernot\longrightarrow \text{Modify}(T_0 \dots T_{11}) \\
\text{ExperimentResult} &\centernot\longrightarrow \text{Activate}(I_{v+1}) \\
\text{ExperimentResult} &\centernot\longrightarrow \text{Execute}(\text{Application})
\end{aligned}$$

---

## 2. Architecture & Data Flow

```
                  HISTORICAL RECORDS (T0 ... T10)
                                 │ (READ ONLY)
                                 ▼
                     EVIDENCE FEEDBACK (T10)
                                 │
                                 ▼
                     CONTROLLED LEARNING (T11)
                                 │
                                 ▼
                        LearningProposal
                                 │
                                 ▼
                 ┌───────────────────────────────┐
                 │   CONTROLLED EXPERIMENTATION  │
                 │          (agt-experiment-v1)   │
                 │                               │
                 │  Baseline Profile Iv (v1.0)   │
                 │              vs               │
                 │  Candidate Profile Iv+1 (v1.1)│
                 │                               │
                 │  Canonical Dataset D          │
                 │  Deterministic Replay Engine  │
                 │  Metrics & Regression Check   │
                 └───────────────┬───────────────┘
                                 │
                                 ▼
                         ExperimentResult
                                 │
                                 ▼
                      SERVER POLICY EVALUATION
                                 │
                                 ▼
                           HUMAN REVIEW
                                 │
                                 ▼
                    APPROVED PROFILE v(N+1)
                                 │
                                 ▼
                         FUTURE RUN ONLY
```

---

## 3. The Controlled Experimentation Agent (`agt-experiment-v1`)

### Authority Boundary

#### CAN:
- Ingest verified `LearningProposal` objects from Controlled Learning.
- Ingest baseline `IntelligenceProfile` ($I_v$) and virtual candidate `IntelligenceProfile` ($I_{v+1}$).
- Ingest canonical, immutable benchmark datasets (`ExperimentDataset`).
- Execute deterministic side-by-side replays of evaluations under identical conditions.
- Compute comparative metrics (`ExperimentMetric[]`) across fit scores, match counts, gap detections, and constraint margins.
- Detect regressions and measure improvements.
- Generate a deterministic replay digest (`replayHash`).
- Emit deeply frozen `ExperimentResult` wrapped in an `AgentExperimentProposal` envelope declaring zero execution and approval authority.

#### CANNOT:
- ❌ Modify historical evaluations, plans, orchestrations, policy decisions, approvals, artifacts, receipts, outcomes, or feedback ($T_0 \dots T_{11}$).
- ❌ Mutate the benchmark dataset or candidate profiles.
- ❌ Directly mutate active evaluator, planner, discovery, or orchestration rules.
- ❌ Automatically activate or promote candidate profiles into production.
- ❌ Self-approve learning proposals or experiment results.
- ❌ Dispatch or execute applications.
- ❌ Bypass the Server Policy Guard.

---

## 4. Core Primitives & Interfaces

### 4.1 ExperimentDataset
Standardized, immutable test dataset used for side-by-side replay:
```typescript
export interface ExperimentDatasetItem {
  id: string;
  candidateSnapshotId: string;
  jobId: string;
  historicalOutcomeId?: string;
  inputPayload: Record<string, unknown>;
}

export interface ExperimentDataset {
  datasetId: string;
  description: string;
  sampleItems: ExperimentDatasetItem[];
  datasetHash: string;
  immutable: true;
}
```

### 4.2 ExperimentMetric
Explicit comparative metric capturing baseline vs candidate behavior:
```typescript
export interface ExperimentMetric {
  metricName: string;
  targetRule: IntelligenceRuleTarget;
  parameter: string;
  baselineValue: number | string;
  candidateValue: number | string;
  delta: number | string;
  status: 'IMPROVED' | 'REGRESSED' | 'UNCHANGED';
}
```

### 4.3 ExperimentResult
Deeply frozen experiment report:
```typescript
export interface ExperimentResult {
  experimentId: string;
  learningProposalId: string;
  baselineProfileVersion: string;
  candidateProfileVersion: string;
  datasetHash: string;
  datasetSize: number;
  metrics: ExperimentMetric[];
  regressionsDetected: number;
  improvementsDetected: number;
  overallStatus: 'PASS' | 'FAIL';
  replayHash: string;
  recommendation: 'APPROVE_FOR_REVIEW' | 'REJECT_REGRESSION';
  createdAt: string;
  created_by: 'controlled_experimentation';
  immutable: true;
}
```

---

## 5. Governance & Policy Verification

The Policy Guard enforces:
1. **Provenance & Integrity**:
   - The `learningProposalId` must match a verified upstream `LearningProposal`.
   - The `datasetHash` must match the cryptographic digest of the canonical benchmark dataset.
   - The candidate profile version must match the learning proposal's `proposedProfileVersion`.
2. **Negative Authority Enforcement**:
   - `canExecute: false`, `canApprove: false`, `canMutateEvidence: false`.
   - Any attempt to activate a profile, dispatch execution, or mutate historical records results in `AUTHORITY_VIOLATION`.
3. **Threshold Enforcement**:
   - If `regressionsDetected > 0` or `overallStatus === 'FAIL'`, the recommendation must be `REJECT_REGRESSION`.
   - Experiments failing regression criteria are blocked from advancing to human approval.
4. **Future-Only Activation**:
   - Even after passing experimentation and human approval, the new profile applies **strictly to future runs** ($T_0'$). Historical records remain permanently sealed.
