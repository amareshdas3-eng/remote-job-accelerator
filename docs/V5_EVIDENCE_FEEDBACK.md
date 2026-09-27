# Specification: v5.0-alpha8 — Evidence Feedback Intelligence

## The Governing Invariant of Evidence Feedback

> **"Feedback creates evidence; it does not create authority."**
>
> $$\text{Immutable Outcome } (T_8) \longrightarrow \text{Evidence Feedback } (T_9) \longrightarrow \text{NEW Evidence}$$
>
> $$\text{Feedback } (T_9) \centernot\longrightarrow \text{Modify } T_0 \dots T_8 \text{ (Evaluation, Plan, Approval, Artifact, Receipt, Outcome)}$$

---

## 1. Architectural Role

Alpha7 established the read-only truth preservation boundary: executing an application results in an authoritative submission receipt and an immutable `OutcomeRecord`.

Alpha8 introduces the controlled, safe return path: converting execution observations into **new, verifiable evidence** without creating an unconstrained or retroactive mutation loop.

```text
                    ┌──────────────────────────┐
                    │     HISTORICAL TRUTH      │
                    │                           │
                    │ Discovery                 │
                    │ Evaluation                │
                    │ Planning                  │
                    │ Orchestration             │
                    │ Policy                    │
                    │ Human Approval            │
                    │ Frozen Artifact           │
                    │ Execution Receipt         │
                    │ Outcome Record            │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                       📚 EVIDENCE FEEDBACK
                              ALPHA8
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
               NEW EVIDENCE              NO MUTATION
                    │                           │
                    ▼                           X
              Future Discovery            Historical truth
              Future Evaluation            Existing plans
              Future Planning              Frozen artifacts
```

Crucially:
- Outcome $\rightarrow$ Feedback $\rightarrow$ **New Evidence Record**
- Feedback $\centernot\rightarrow$ Modify existing evaluation
- Feedback $\centernot\rightarrow$ Modify existing plan
- Feedback $\centernot\rightarrow$ Modify existing approval
- Feedback $\centernot\rightarrow$ Modify existing frozen artifact
- Feedback $\centernot\rightarrow$ Automatically resubmit

Every downstream cycle using this new evidence begins as a **fresh discovery/evaluation run** with a distinct, unbroken cryptographic provenance chain.

---

## 2. Core Schemas

### Feedback Signals and Observations

```typescript
export type FeedbackSignalType =
  | 'TIMING_OBSERVATION'
  | 'RESULT_OBSERVATION'
  | 'DEPENDENCY_OBSERVATION'
  | 'SCOPE_OBSERVATION'
  | 'EXECUTION_FAILURE_OBSERVATION'
  | 'SUCCESS_OBSERVATION'
  | 'DATA_QUALITY_OBSERVATION';

export interface FeedbackObservation {
  observationId: string;
  type: FeedbackSignalType;
  sourceOutcomeId: string;
  description: string;
  evidenceReference: string;
}

export interface FeedbackSignal {
  signalId: string;
  type: FeedbackSignalType;
  confidence: number;
  description: string;
  actionableFor: 'discovery' | 'evaluation' | 'planning';
}
```

### Immutable Evidence Feedback Record

```typescript
export interface EvidenceFeedbackRecord {
  feedbackId: string;
  sourceOutcomeId: string;
  sourceExecutionId: string;
  candidateSnapshotId: string;
  evidenceReferences: string[];
  observations: FeedbackObservation[];
  derivedSignals: FeedbackSignal[];
  createdAt: string;
  created_by: 'evidence_feedback';
  immutable: true;
}

export type AgentEvidenceFeedbackRecord = AgentProposal<EvidenceFeedbackRecord>;
```

---

## 3. Strict Negative Authority Boundary

The Evidence Feedback Agent (`agt-feedback-v1`) operates under zero execution and zero approval authority:

```typescript
{
  canExecute: false,
  canApprove: false,
  canMutateEvidence: false
}
```

The feedback layer may derive facts from the immutable outcome ("The portal took 26 hours rather than 24 hours to accept the application"), but it is structurally incapable of:
1. Rewriting the candidate's verified profile data.
2. Adjusting previously locked evaluation scores.
3. Mutating previous plans or reordering approved actions.
4. Auto-dispatching applications.
5. Altering the frozen artifact or execution receipt.

---

## 4. Adversarial Attack Matrix (28 Tests)

| Category | # Tests | Vectors Defended |
| :--- | :--- | :--- |
| **Feedback Integrity** | 8 | Forged outcome source, forged execution source, forged evidence ref, forged candidate snapshot, missing outcome, missing receipt, modified outcome post-feedback, modified feedback record. |
| **Retroactive Mutation** | 8 | Attempted feedback mutation of evaluation, plan, orchestration, policy, approval, frozen artifact, receipt, outcome. |
| **Authority Attacks** | 6 | Feedback agent attempting approval, execution, freeze, policy override, candidate mutation, automatic re-planning. |
| **Functional Invariants** | 6 | Valid outcome $\rightarrow$ valid evidence, complete outcome provenance retention, deterministic feedback canonicalization, insertion-order invariance, historical immutability (deep `Object.freeze`), feedback strictly remains proposal/evidence only. |
