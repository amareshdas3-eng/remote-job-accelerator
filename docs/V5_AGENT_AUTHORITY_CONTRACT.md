# Specification: v5.0 Agent Authority Contract (`AgentAuthorityContract`)

## The Governing Invariant of Bounded Autonomy

> **"Increase autonomy. Never increase authority merely because autonomy increased."**

The purpose of this specification is to define an unambiguous, machine-enforced contract for every autonomous agent in Remote Job Accelerator (RJA) v5.0:

> **What may this agent observe, decide, propose, modify, and trigger—and what is it absolutely forbidden to do?**

---

## 1. The Four Initial Autonomous Agents

```text
                    v5.0 ORCHESTRATOR
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
     DISCOVERY         EVALUATION        PLANNING
       AGENT              AGENT            AGENT
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                     POLICY GUARD
                           │
                           ▼
                    HUMAN APPROVAL
                           │
                           ▼
                    v4.6.1 SUBSTRATE
```

| Agent | Core Responsibility | Authority Boundary | Execution Access |
| :--- | :--- | :--- | :--- |
| 🔎 **Discovery Agent** | Find, normalize, and deduplicate market jobs | **Read-Only** | **NONE** |
| 🧠 **Evaluation Agent** | Compare jobs against verified candidate evidence | **Analysis-Only** | **NONE** |
| 📅 **Planning Agent** | Propose application batches, pacing, and scheduling | **Proposal-Only** | **NONE** |
| 🤖 **Orchestrator** | Synthesize sub-agent outputs into workspace proposals | **Proposal-Only** | **NONE** |
| 📊 **Outcome Intelligence** | Observe execution receipts, record deviations & truth | **Read-Only Observation** | **NONE** |
| 📚 **Evidence Feedback** | Convert execution outcomes into verified evidence | **Evidence-Only** | **NONE** |
| 🧠 **Controlled Learning** | Propose versioned profile adaptations with regression tests | **Proposal-Only** | **NONE** |

**Zero Execution Authority**: No agent in RJA v5.0 possesses execution credentials, dispatch tokens, or bypass privileges. The v4.6.1 execution substrate remains completely below the agent layer and is accessible solely following explicit, authenticated human candidate review. Learning creates a new version; it never rewrites the version that created history.

---

## 2. Universal Agent Authority Contract Schema

Every autonomous agent in RJA must implement an explicit, machine-readable `AgentAuthorityContract`:

```text
AgentAuthorityContract
├── agent_id               # Unique identifier (e.g., 'agt-discovery-v1')
├── agent_type             # 'discovery' | 'evaluation' | 'planning' | 'orchestrator'
├── version                # Semantic version of the contract
├── input_sources          # Authorized upstream data streams (APIs, feeds, workspace)
├── evidence_access        # 'none' | 'read_only' | 'snapshot_only'
├── allowed_operations     # Explicit deterministic and generative functions permitted
├── prohibited_operations  # Banned operations (mutations, dispatches, credential invention)
├── mutable_state_scope    # 'none' | 'ephemeral_proposal' | 'workspace_draft'
├── external_actions       # Rate-limited outbound requests permitted
├── approval_boundary      # 'mandatory_human_review' (Unconditional for all dispatches)
├── audit_events           # Structured telemetry events emitted on every action
├── failure_behavior       # 'fail_closed' (Halt proposal on ambiguity or error)
└── escalation_path        # Explicit routing to human operator on uncertainty
```

---

## 3. Authority Contracts for Initial Agents

### A. 🔎 Discovery Agent Contract (`agt-discovery-v1`)

The Discovery Agent identifies job opportunities across permitted sources, normalizes listings into canonical schemas, deduplicates against known listings, attaches tamper-evident provenance, and requests downstream evaluation.

```text
INPUTS
  └── Job Boards, ATS Feeds, Company Career Portals, Webhook Ingestion (Permitted Sources)
  ↓
EVIDENCE ACCESS
  └── NONE (Cannot read candidate resume, profile, or credentials)
  ↓
ALLOWED ACTIONS (CAN)
  ├── ✓ Search permitted sources (greenhouse, lever, workday, direct ATS, job boards)
  ├── ✓ Retrieve listings
  ├── ✓ Canonicalize URLs (strip tracking and affiliate query tags)
  ├── ✓ Normalize job schema (title, company, category, remote status)
  ├── ✓ Extract requirement statements and keyword taxonomies
  ├── ✓ Deduplicate against existing job listings using SHA-256 hash keys
  ├── ✓ Attach cryptographic provenance record (source, URL, timestamp, raw_hash)
  ├── ✓ Emit DiscoveryProposal wrapped in Universal Provenance Envelope
  └── ✓ Request further evaluation by downstream Evaluation Agent
  ↓
PROHIBITED ACTIONS (CANNOT)
  ├── ✗ Modify candidate evidence or profile
  ├── ✗ Generate candidate qualifications or fit evaluations
  ├── ✗ Approve applications or sign review gates
  ├── ✗ Create executable artifacts
  ├── ✗ Modify fingerprints or canonicalizer schemes
  ├── ✗ Dispatch applications or execute dispatches
  └── ✗ Write outcome history or alter application statuses
  ↓
OUTPUT
  └── AgentProposal<DiscoveryProposal> (Universal Provenance Envelope)
  ↓
AUDIT EVENT
  └── `agent.discovery.completed` (with proposalId, jobId, source, and provenance_hash)
  ↓
DOWNSTREAM HANDOFF
  └── Requests evaluation from Evaluation Agent; Candidate approves before application execution
```

---

## 3.1 The Universal Provenance Envelope (`AgentProposal<T>`)

Every autonomous agent in RJA v5.0 wraps its output in a standardized, immutable **Provenance Envelope**:

```typescript
type AgentProposal<T> = {
  proposalId: string;
  agentId: string;
  agentVersion: string;
  createdAt: string;

  inputEvidenceRefs: string[];
  output: T;

  authority: {
    canExecute: false;
    canApprove: false;
    canMutateEvidence: false;
  };

  provenance: ProvenanceRecord;
};
```

This envelope answers four foundational security questions for every agent output:
1. **Who produced this proposal?** (`agentId`, `agentVersion`, `proposalId`)
2. **From which evidence?** (`inputEvidenceRefs`, pointing to verified candidate evidence snapshot IDs)
3. **Using which agent version and timestamp?** (`agentVersion`, `createdAt`)
4. **Under what authority?** (`authority` explicitly declaring negative capabilities: zero execution, zero approval, zero evidence mutation)

If an agent output lacks this envelope, claims positive execution authority (`canExecute: true`), or exhibits provenance digest tampering, the **Policy Guard** triggers an immediate hard block.

---


### B. 🧠 Evaluation Agent Contract (`agt-evaluation-v1`)

The Evaluation Agent determines how well a discovered job matches verified candidate evidence—without becoming an evidence-generation system.

> **Governing Invariant: "Generation is never evidence."**
> The Evaluation Agent may never invent experience, auto-upgrade preferred requirements to satisfied, or synthesize unverified claims. Every satisfied requirement must strictly cite verified facts from an immutable `EvidenceSnapshot`.

```text
INPUTS
  └── Discovered Job Criteria (from Discovery Proposal) + Candidate Evidence Snapshot (immutable)
  ↓
EVIDENCE ACCESS
  └── SNAPSHOT_ONLY (Read-only access to captured EvidenceSnapshot bound to candidate_id)
  ↓
ALLOWED ACTIONS (CAN)
  ├── ✓ Consume verified candidate evidence snapshot
  ├── ✓ Consume canonical job requirements from Discovery Proposal
  ├── ✓ Classify requirements into 'required' vs. 'preferred'
  ├── ✓ Identify evidence-backed matches with strict EvidenceCitation objects
  ├── ✓ Identify genuine qualification gaps where evidence is missing
  ├── ✓ Produce cryptographic citations referencing snapshot ID, hash, and source fields
  ├── ✓ Request additional candidate review when gaps exist
  ├── ✓ Calculate governed deterministic 4D fit score (Role, Tech, Leadership, Seniority)
  └── ✓ Emit EvaluationProposal wrapped in Universal Provenance Envelope
  ↓
PROHIBITED ACTIONS (CANNOT)
  ├── ✗ Invent missing experience or credentials
  ├── ✗ Upgrade a preferred requirement to satisfied without verified proof
  ├── ✗ Modify the candidate profile or inject unverified evidence
  ├── ✗ Rewrite evidence or conceal qualification gaps
  ├── ✗ Create application artifacts (no cover letters, resume rewrites, screening answers)
  ├── ✗ Approve applications or sign human review gates
  ├── ✗ Execute applications or trigger external dispatches
  └── ✗ Alter the deterministic match score without an explicit governed mechanism
  ↓
OUTPUT
  └── AgentProposal<EvaluationProposal> (Universal Provenance Envelope)
  ↓
AUDIT EVENT
  └── `agent.evaluation.completed` (with evaluationId, jobId, fitScore, satisfiedCount, gapCount)
  ↓
DOWNSTREAM HANDOFF
  └── Handoff to Planning Agent; candidate inspects evaluation breakdown and gap analysis
```

---

### C. 📅 Planning Agent Contract (`agt-planning-v1`)

The Planning Agent prioritizes and sequences application preparation order across evaluated opportunities without authorizing or executing actions.

> **Governing Invariant: "Planning proposes what should happen next; it does not authorize what happens next."**
> The Planning Agent operates deterministically over evaluated opportunities and candidate evidence. It identifies missing prerequisites, detects pacing conflicts, and isolates opportunities requiring human inspection.

```text
INPUTS
  └── Evaluated Opportunities (Evaluation Proposals) + Candidate Evidence Snapshot (immutable)
  ↓
EVIDENCE ACCESS
  └── SNAPSHOT_ONLY (Read-only access to captured EvidenceSnapshot bound to candidate_id)
  ↓
ALLOWED ACTIONS (CAN)
  ├── ✓ Consume verified Evaluation Proposals and Discovery Proposals
  ├── ✓ Group evaluated opportunities by fit tier and priority
  ├── ✓ Prioritize application preparation order deterministically
  ├── ✓ Identify missing prerequisites and evidence dependencies
  ├── ✓ Detect conflicting deadlines, pacing concurrency limits, and dependencies
  ├── ✓ Propose application sequence (prepare_for_review, request_missing_evidence, hold, defer)
  ├── ✓ Produce deterministic PlanningProposal
  ├── ✓ Preserve all upstream evidence and provenance references
  └── ✓ Request human review when prerequisites or qualification gaps exist
  ↓
PROHIBITED ACTIONS (CANNOT)
  ├── ✗ Modify candidate evidence or profile
  ├── ✗ Modify Evaluation results or fit scores
  ├── ✗ Mark an application or job as approved
  ├── ✗ Create executable artifacts (no cover letters, resume rewrites, screening answers)
  ├── ✗ Sign human review gates
  ├── ✗ Dispatch applications to external endpoints
  ├── ✗ Modify outcome history or synthetic interview events
  └── ✗ Communicate directly with employers or external platforms
  ↓
OUTPUT
  └── AgentProposal<PlanningProposal> (Universal Provenance Envelope)
  ↓
AUDIT EVENT
  └── `agent.planning.scheduled` (with planId, candidateSnapshotId, actions_count, dependencies_count)
  ↓
DOWNSTREAM HANDOFF
  └── Handoff to Application Intelligence / Candidate Workspace; candidate reviews plan and authorizes drafts
```

---

### D. 🤖 Agent Orchestrator Contract (`agt-orchestrator-v1`)

The Orchestrator coordinates proposals across Discovery, Evaluation, and Planning agents into a unified, conflict-free application workspace proposal without acquiring positive execution authority.

> **Governing Invariant: "Orchestration coordinates intelligence; it does not manufacture authority."**
> The Orchestrator has more context, not more authority. It cannot self-approve, dispatch applications, mutate candidate evidence, or forge upstream provenance.

```text
INPUTS
  └── Candidate Evidence Snapshot (immutable) + Upstream Agent Proposals (Discovery + Evaluation + Planning)
  ↓
EVIDENCE ACCESS
  └── SNAPSHOT_ONLY (Read-only access to immutable EvidenceSnapshot)
  ↓
ALLOWED ACTIONS (CAN)
  ├── ✓ Consume Discovery, Evaluation, and Planning proposals
  ├── ✓ Correlate upstream cryptographic provenance records across all 4 stages
  ├── ✓ Construct unified application-workspace proposals
  ├── ✓ Detect contradictions between agents (e.g., gap_vs_ready_conflict)
  ├── ✓ Detect stale, drifted, or incompatible proposals
  ├── ✓ Extract required human decisions with explicit action options
  ├── ✓ Produce deterministic OrchestrationProposal
  └── ✓ Preserve every upstream proposal and evidence reference
  ↓
PROHIBITED ACTIONS (CANNOT)
  ├── ✗ Modify candidate evidence or profile
  ├── ✗ Modify Evaluation scores or dimensions
  ├── ✗ Modify Planning decisions or priorities
  ├── ✗ Mark any job or application as approved (`approved_by`)
  ├── ✗ Generate final application artifacts (no cover letters, resumes, screening answers)
  ├── ✗ Execute applications or trigger dispatches
  ├── ✗ Alter outcome history
  └── ✗ Bypass server-authoritative Policy Guard
  ↓
OUTPUT
  └── AgentProposal<OrchestrationProposal> (Universal Provenance Envelope)
  ↓
AUDIT EVENT
  └── `agent.orchestration.assembled` (with orchestrationId, conflictCount, decisionCount, planCount)
  ↓
HUMAN APPROVAL?
  └── MANDATORY. The candidate retains sovereign review and approval authority.
```

### E. 📊 Outcome Intelligence Contract (`agt-outcome-v1`)

Outcome Intelligence observes execution truth ($T_8$), validates receipt integrity against cryptographic hashes, measures plan vs execution deviations, and writes immutable, deeply frozen `OutcomeRecord`s.

```text
INPUTS
  └── SubmissionReceipt, FrozenArtifactPackage, Candidate EvidenceSnapshot, PlanningProposal
  ↓
EVIDENCE ACCESS
  └── snapshot_only (Read-only observation of snapshot and execution artifacts)
  ↓
ALLOWED ACTIONS (CAN)
  ├── ✓ Validate execution receipt schema and compute SHA-256 receipt digest
  ├── ✓ Validate frozen artifact canonical fingerprint (rja-c14n-v1-sha256)
  ├── ✓ Verify candidate snapshot and execution alignment
  ├── ✓ Synthesize deterministic execution observations (status, metrics, timing)
  ├── ✓ Detect plan vs observed deviations (TIMING, SCOPE, DEPENDENCY, RESULT, EXECUTION_FAILURE)
  ├── ✓ Canonicalize outcome records into deterministic representations
  ├── ✓ Emit immutable, write-once OutcomeRecord wrapped in Universal Provenance Envelope
  └── ✓ Preserve exact upstream receipt and frozen artifact states without mutation
  ↓
PROHIBITED ACTIONS (CANNOT)
  ├── ✗ Modify frozen artifacts after execution
  ├── ✗ Modify execution receipts or timestamps
  ├── ✗ Modify candidate evidence or profile
  ├── ✗ Retroactively alter upstream proposals (Discovery, Evaluation, Planning, Orchestration)
  ├── ✗ Modify policy decisions or bypass governance gates
  ├── ✗ Approve applications or execute dispatches
  ├── ✗ Create application text (resumes, cover letters, screening answers)
  └── ✗ Automatically inject outcome feedback into active planning loops without boundary
  ↓
MUTABLE STATE SCOPE
  └── none (Emits write-once, deeply frozen OutcomeRecord instances)
  ↓
EXTERNAL ACTIONS
  └── none (Zero outbound network access; purely internal cryptographic audit)
  ↓
OUTPUT
  └── AgentOutcomeRecord (AgentProposal<OutcomeRecord>)
  ↓
AUDIT EVENT
  └── `agent.outcome.recorded` (with outcomeId, executionId, receiptHash, status, deviationCount)
  ↓
HUMAN APPROVAL?
  └── NONE. Execution truth has already completed; outcome intelligence is strictly an audit observer.
```

### F. 📚 Evidence Feedback Agent Contract (`agt-feedback-v1`)

The Evidence Feedback Agent derives factual observations and signals from immutable `OutcomeRecord`s, producing verifiable, tamper-evident `EvidenceFeedbackRecord`s for future discovery and evaluation without mutating historical truth.

```text
INPUTS
  └── OutcomeRecord, Candidate EvidenceSnapshot, SubmissionReceipt
  ↓
EVIDENCE ACCESS
  └── snapshot_only (Read-only observation of snapshot and outcome records)
  ↓
ALLOWED ACTIONS (CAN)
  ├── ✓ Read and validate immutable OutcomeRecord provenance and receipt digest
  ├── ✓ Derive factual feedback observations (TIMING, SCOPE, DEPENDENCY, RESULT, EXECUTION_FAILURE)
  ├── ✓ Synthesize actionable feedback signals for future planning, evaluation, and discovery
  ├── ✓ Canonicalize feedback records into deterministic representations
  ├── ✓ Emit immutable, write-once EvidenceFeedbackRecord wrapped in Universal Provenance Envelope
  └── ✓ Preserve exact historical records without retroactive mutations
  ↓
PROHIBITED ACTIONS (CANNOT)
  ├── ✗ Modify evaluation results or fit scores
  ├── ✗ Modify planning decisions or action sequences
  ├── ✗ Mutate orchestration state
  ├── ✗ Modify policy decisions or bypass governance gates
  ├── ✗ Mutate human approvals or sign review gates
  ├── ✗ Modify frozen application artifacts or execution receipts
  ├── ✗ Mutate historical outcome records
  ├── ✗ Mutate candidate profile or inject unverified credentials
  ├── ✗ Trigger automatic replanning or automatic resubmission
  └── ✗ Directly execute dispatches
  ↓
MUTABLE STATE SCOPE
  └── none (Emits write-once, deeply frozen EvidenceFeedbackRecord instances)
  ↓
EXTERNAL ACTIONS
  └── none (Zero outbound network access; purely internal evidence synthesis)
  ↓
OUTPUT
  └── AgentEvidenceFeedbackRecord (AgentProposal<EvidenceFeedbackRecord>)
  ↓
AUDIT EVENT
  └── `agent.feedback.recorded` (with feedbackId, sourceOutcomeId, observationCount, signalCount)
  ↓
HUMAN APPROVAL?
  └── NONE. Feedback outputs are strictly non-authoritative evidence candidates for future runs.
```

### G. 🧠 Controlled Learning Agent Contract (`agt-learning-v1`)

The Controlled Learning Agent detects recurring empirical patterns across feedback records, synthesizes explicit before/after rule diffs, performs regression testing, and emits versioned `LearningProposal`s. It cannot self-activate profiles or mutate historical decisions.

```text
INPUTS
  └── EvidenceFeedbackRecord, OutcomeRecord, IntelligenceProfile
  ↓
EVIDENCE ACCESS
  └── snapshot_only (Read-only observation of snapshot and feedback records)
  ↓
ALLOWED ACTIONS (CAN)
  ├── ✓ Read and correlate historical feedback records and outcome deviations
  ├── ✓ Detect recurring empirical patterns across execution histories
  ├── ✓ Propose explicit before/after adaptation diffs with supporting citations
  ├── ✓ Execute deterministic regression suites across baseline datasets
  ├── ✓ Canonicalize learning proposals into deterministic representations
  ├── ✓ Emit immutable, write-once LearningProposal wrapped in Universal Provenance Envelope
  └── ✓ Propose versioned IntelligenceProfile vNext referencing parentVersion
  ↓
PROHIBITED ACTIONS (CANNOT)
  ├── ✗ Modify evaluation results or fit scores
  ├── ✗ Modify planning decisions or action sequences
  ├── ✗ Mutate orchestration state
  ├── ✗ Modify policy decisions or bypass governance gates
  ├── ✗ Mutate human approvals or sign review gates
  ├── ✗ Modify frozen application artifacts or execution receipts
  ├── ✗ Mutate historical outcome records or feedback records
  ├── ✗ Mutate candidate profile or inject unverified credentials
  ├── ✗ Direct evaluator-weight or planner-rule mutation
  ├── ✗ Direct discovery-rule or orchestration mutation
  ├── ✗ Automatic profile activation (requires explicit human review)
  ├── ✗ Self-approve proposals
  └── ✗ Directly execute dispatches
  ↓
MUTABLE STATE SCOPE
  └── none (Emits write-once, deeply frozen LearningProposal instances)
  ↓
EXTERNAL ACTIONS
  └── none (Zero outbound network access; purely internal regression analysis)
  ↓
OUTPUT
  └── AgentLearningProposal (AgentProposal<LearningProposal>)
  ↓
AUDIT EVENT
  └── `agent.learning.proposed` (with learningId, currentVersion, proposedVersion, changeCount)
  ↓
HUMAN APPROVAL?
  └── MANDATORY. Activating an intelligence profile requires human candidate review.
```

### H. 🧪 Controlled Experimentation Agent Contract (`agt-experiment-v1`)

The Controlled Experimentation Agent runs side-by-side deterministic replays of proposed intelligence profiles ($I_{v+1}$) against baseline profiles ($I_v$) across standardized benchmark datasets. It measures comparative metrics and detects regressions. It cannot self-activate profiles, mutate historical truth, or execute applications.

```text
INPUTS
  └── LearningProposal, IntelligenceProfile (Baseline), IntelligenceProfile (Candidate), ExperimentDataset
  ↓
EVIDENCE ACCESS
  └── read_only (Read-only observation of dataset and profile parameters)
  ↓
ALLOWED ACTIONS (CAN)
  ├── ✓ Ingest verified LearningProposal and canonical ExperimentDataset
  ├── ✓ Replay candidate vs baseline profiles under identical deterministic conditions
  ├── ✓ Compute comparative performance metrics (fit delta, gap drift, ranking stability)
  ├── ✓ Measure regressions and improvements against tolerance thresholds
  ├── ✓ Compute deterministic replay digest (replayHash)
  ├── ✓ Emit immutable, write-once ExperimentResult wrapped in Universal Provenance Envelope
  └── ✓ Propose experiment recommendation ('APPROVE_FOR_REVIEW' | 'REJECT_REGRESSION')
  ↓
PROHIBITED ACTIONS (CANNOT)
  ├── ✗ Modify historical evaluations, plans, orchestrations, policy decisions, or outcomes
  ├── ✗ Mutate benchmark datasets or candidate profiles
  ├── ✗ Direct evaluator-weight or planner-rule mutation
  ├── ✗ Direct discovery-rule or orchestration mutation
  ├── ✗ Automatically activate candidate profiles into production
  ├── ✗ Self-approve proposals or experiment results
  ├── ✗ Execute applications or dispatch dispatches
  └── ✗ Bypass Policy Guard review
  ↓
MUTABLE STATE SCOPE
  └── none (Emits write-once, deeply frozen ExperimentResult instances)
  ↓
EXTERNAL ACTIONS
  └── none (Purely internal side-by-side replay engine)
  ↓
OUTPUT
  └── AgentExperimentProposal (AgentProposal<ExperimentResult>)
  ↓
AUDIT EVENT
  └── `agent.experiment.completed` (with experimentId, learningProposalId, overallStatus, regressionsDetected)
  ↓
HUMAN APPROVAL?
  └── MANDATORY. Activating an experimental profile into production requires explicit human review.
```

---

## 4. The Unbroken Unidirectional Authority Pipeline

The permission model enforces a strict unidirectional pipeline. No agent can bypass intermediate gates:

```text
Discovery Agent (Read-only Market Scout)
       │
       ▼
   Job Source (Ingested & Provenance Attached)
       │
       ▼
Candidate Evidence (Immutable Evidence Snapshot)
       │
       ▼
Evaluation Agent (Gap Analysis & Evidence Citation)
       │
       ▼
Planning Agent (Pacing & Scheduling Proposal)
       │
       ▼
Agent Orchestrator (Assembles Workspace Draft)
       │
       ▼
  POLICY GUARD (Scans Truth Score, Credential Boundaries, Sanity)
       │
       ▼
HUMAN APPROVAL (Explicit Candidate Review & Signature Recorded)
       │
       ▼
FROZEN ARTIFACT (Locked with rja-c14n-v1-sha256 Fingerprint)
       │
       ▼
v4.6.1 EXECUTION (Single-flight Mutex, Idempotency Receipt Issued)
       │
       ▼
OBSERVABLE EVENTS (Append-Only Event-Sourced Outcome States)
       │
       ▼
MEASURED OUTCOMES (Turnaround & ROI Derived Exclusively from Recruiter Replies)
       │
       ▼
EVIDENCE FEEDBACK (Immutable Observation of Discrepancies & Calibration Signals)
       │
       ▼
CONTROLLED LEARNING (Detects Patterns & Synthesizes Versioned Adaptation Diff)
       │
       ▼
CONTROLLED EXPERIMENTATION (Side-by-Side Replay Benchmark vs Baseline Profile)
       │
       ▼
POLICY GUARD & HUMAN APPROVAL (Gate for Future Profile Activation)
       │
       ▼
NEW INTELLIGENCE PROFILE vNext (Applies Strictly to Future Runs Only)
```

---

## 5. Violation Handling & Fail-Closed Enforcement

If any agent attempts an operation outside its contract:
1. **Immediate Execution Halt**: The Policy Guard terminates the operation.
2. **Hard Audit Log**: An `agent.authority_violation` event is emitted containing `agent_id`, `attempted_operation`, `prohibited_rule`, and timestamp.
3. **Fail-Closed State**: The application package remains in `draft` or `blocked` status. It cannot transition to `ready_to_apply`.
4. **Human Notification**: An escalation alert is logged to the candidate's workspace dashboard.
