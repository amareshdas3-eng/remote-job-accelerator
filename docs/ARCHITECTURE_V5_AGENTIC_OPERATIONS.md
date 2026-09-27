# Architecture: v5.0 Agentic Career Operations

## The Governing Invariant of Agentic Autonomy

> **"Increase autonomy. Never increase authority merely because autonomy increased."**

As Remote Job Accelerator (RJA) advances from controlled execution into multi-agent career operations, autonomy expands across market discovery, candidate gap evaluation, and application pacing. However, the system's **authority boundaries remain strictly invariant**.

The proven, frozen v4.6.1 cryptographic execution substrate sits permanently below the agentic layer. Agents propose; the substrate verifies, gates, executes, and records.

---

## 1. The v5.0 Substrate Stack

```text
                 AGENT ORCHESTRATOR
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     Discovery       Evaluation      Planning
        Agent           Agent          Agent
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                  POLICY / GUARD
                         │
                         ▼
                  HUMAN APPROVAL
                         │
                         ▼
                FROZEN ARTIFACT
                         │
                         ▼
                v4.6.1 EXECUTION
                         │
                         ▼
                    EVENTS
                         │
                         ▼
                    OUTCOMES
```

### The Architectural Rule of Substrate Invariance
The v4.6.1 execution substrate is **never rewritten or loosened** to accommodate agentic workflows. Instead, the multi-agent system is designed as an upstream proposal and scheduling layer that outputs standardized application packages into the unchanged v4.6.1 pipeline.

---

## 2. Specialized Agent Taxonomy & Responsibilities

In v5.0, autonomous responsibilities are partitioned among four specialized agents with strictly scoped capabilities:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          AGENT ORCHESTRATOR                            │
│  • Synthesizes market signals, gap scores, and candidate preferences   │
│  • Manages workflow state across sub-agents                            │
│  • Assembles coherent draft application proposals                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│ DISCOVERY AGENT  │       │ EVALUATION AGENT │       │  PLANNING AGENT  │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ • ATS crawling   │       │ • Skill mapping  │       │ • Application    │
│ • Board scraping │       │ • Gap scoring    │       │   pacing / rate  │
│ • Job deduping   │       │ • Positioning    │       │ • Multi-channel  │
│ • Canonicalization│      │ • Credential     │       │   scheduling     │
│   of listings    │       │   citation check │       │ • Tier prioritization
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

### A. Discovery Agent
- **Scope**: Market intelligence, job board discovery, and ATS posting ingestion.
- **Authority**: Read-only exploration. Normalizes job records via `lib/jobs/normalizer.ts` and deduplicates via `lib/jobs/dedup.ts`.
- **Prohibition**: Cannot alter candidate profiles, cannot trigger applications.

### B. Evaluation Agent
- **Scope**: Candidate ↔ Job gap scoring, strategic positioning, and qualification citation analysis.
- **Authority**: Evaluative analysis. Calculates 4D fit scores and citations against verified candidate evidence.
- **Prohibition**: Cannot fabricate credentials, cannot extrapolate unstated experience, cannot artificially inflate fit scores.

### C. Planning Agent
- **Scope**: Application scheduling, pacing, tier prioritization, and channel selection (direct portal, ATS, recruiter email).
- **Authority**: Scheduling proposal. Proposes when and where applications should be submitted to maximize interview velocity.
- **Prohibition**: Cannot execute dispatches directly, cannot bypass human review deadlines.

### D. Agent Orchestrator
- **Scope**: Top-level coordinator synthesizing discovery, evaluation, and pacing into complete application workspace packages.
- **Authority**: Package assembly. Prepares tailored resume, cover letter, and screening answers for evaluation.
- **Prohibition**: Cannot self-approve packages, cannot sign candidate reviews.

---

## 3. The Agent Authority Contract (`AgentAuthorityContract`)

Before introducing any autonomous agent into v5.0, an explicit, machine-readable **AgentAuthorityContract** must be declared:

```text
AgentAuthorityContract
├── input_sources          # Authorized data ingestion streams (read-only APIs, boards)
├── evidence_access        # Permitted snapshot & candidate evidence access
├── allowed_operations     # Explicitly permitted deterministic/generative functions
├── prohibited_operations  # Banned mutations, execution hooks, or backpropagation
├── mutable_state          # Ephemeral workspace state scoped strictly to the agent
├── external_actions       # Outbound network requests permitted (rate-limited)
├── approval_boundary      # Interface through which human consent must be requested
├── audit_events           # Structured telemetry events emitted on every transition
├── failure_behavior       # Fallback protocol on timeout, model abort, or error
└── escalation_path        # Explicit routing to human operator on uncertainty
```

### The Unbroken Authority Flow

No agent is permitted a shortcut around this unidirectional flow:

```text
Discovery Agent
   │
   │ READ
   ▼
Job Source
   │
   ▼
Candidate Evidence
   │
   │ READ / ANALYZE
   ▼
Evaluation Agent
   │
   │ PROPOSE
   ▼
Orchestrator
   │
   │ PROPOSE
   ▼
Policy Guard
   │
   │ REQUIRE CONSENT
   ▼
Human
   │
   │ APPROVE
   ▼
Immutable Artifact
   │
   │ SHA-256 verified
   ▼
v4.6.1 Execution
```

---

## 4. The Multi-Tier Defense Layers

Between agent proposal and real-world execution stand three impenetrable gates:

```text
PROPOSAL (Agents)
    │
    ▼
┌──────────────────────────────────────────────┐
│ 1. POLICY / GUARD LAYER                      │
│ • Application Truthfulness Guard             │
│ • Credential Verification Audit (PE/PMP/PhD) │
│ • Anti-Spam / Rate Limit Gating              │
│ • Sanity & Tone Thresholds                   │
└──────────────────────┬───────────────────────┘
                       │ Passes Truth Audit
                       ▼
┌──────────────────────────────────────────────┐
│ 2. HUMAN APPROVAL GATE                       │
│ • Candidate Review Workspace                 │
│ • Authenticated Candidate Signature          │
│ • Explicit Timestamped Review Record         │
└──────────────────────┬───────────────────────┘
                       │ Explicit Candidate Signature
                       ▼
┌──────────────────────────────────────────────┐
│ 3. CRYPTOGRAPHIC ARTIFACT LOCK (v4.6.1)      │
│ • Byte Canonicalization (rja-c14n-v1-sha256) │
│ • SHA-256 Fingerprint Generated & Sealed     │
│ • Evidence Snapshot Bound (evidence_hash)    │
└──────────────────────┬───────────────────────┘
                       │ Sealed Payload
                       ▼
             v4.6.1 EXECUTION ENGINE
```

---

## 5. The Prohibited Agent Capabilities ("Negative Capabilities")

To guarantee architectural stability, the v5.0 specification defines **Negative Capabilities**—operations that agents are mathematically and architecturally prevented from executing:

| Prohibited Action | Architectural Enforcement |
| :--- | :--- |
| **Self-Approval** | Execution engine strictly checks `approved_by` against authenticated user session. Agents cannot generate valid reviewer credentials. |
| **Post-Approval Content Mutation** | Any change to a single character, byte, or metadata property changes the SHA-256 fingerprint, triggering an immediate `MUTATION_BLOCKED` hard halt. |
| **Evidence Invention** | Ground truth is restricted to the verified `EvidenceSnapshot`. Agent generation cannot backpropagate into candidate master records. |
| **Runaway Dispatch** | Execution lock (`acquireExecutionLock`) limits dispatches to single-flight; destination idempotency stops repeated submissions. |
| **Receipt Forgery** | `SubmissionReceipt` is generated exclusively by the low-level execution engine after network confirmation. |
| **Attribution Fabrication** | Outcome events and ROI metrics are ingested exclusively from verified recruiter response timestamps, never inferred by agents. |

---

## 6. Phased Implementation Sequence: Read-Only Autonomy First

v5.0 implementation begins with orchestration and read-only autonomy, preserving the execution substrate unchanged:

```text
Phase A: Agent Authority Contracts
         Formal specification of authority, evidence access, permissions, and forbidden actions.
            ↓
Phase B: Discovery Agent
         Read-only job discovery, multi-board scraping, ATS normalization, and provenance tracking.
            ↓
Phase C: Evaluation Agent
         Evidence-backed qualification mapping, 4D fit scoring, and gap detection.
            ↓
Phase D: Planning Agent
         Application pacing, batch scheduling, and tier prioritization proposals.
            ↓
Phase E: Agent Orchestrator
         Combine proposals into coherent workspaces without gaining execution authority.
            ↓
Phase F: Policy Guard
         Central enforcement point scanning truthfulness scores and credential bounds.
            ↓
Phase G: Human Approval
         Mandatory candidate review workspace with authenticated signature.
            ↓
Phase H: Existing Execution Substrate
         Hand off approved package directly to the unchanged v4.6.1 cryptographic execution engine.
```

---

## 7. Architectural Progression: v4.x to v5.0

```text
v4.3 Security Baseline
      │ Can we trust our execution environment?
      ▼
v4.4 Job Intelligence
      │ Can we normalize and score jobs deterministically?
      ▼
v4.5 Application Intelligence
      │ Can we draft truthful packages bounded by evidence?
      ▼
v4.6 Controlled Execution
      │ Can we dispatch with idempotency and audit outcomes?
      ▼
v4.6.1 Cryptographic Integrity
      │ Can we mathematically lock approved content?
      ▼
v5.0 Agentic Career Operations
        Can autonomous agents orchestrate career acceleration
        without undermining the evidence and integrity substrate?
```

By keeping the v4.6.1 cryptographic substrate strictly below the agent layer, RJA v5.0 achieves **high autonomy with zero loss of control**.

