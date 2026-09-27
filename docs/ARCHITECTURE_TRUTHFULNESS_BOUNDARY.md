# Architecture: The Application Truthfulness Boundary

## The Foundational Principle

> **"Generation is never evidence."**

In Remote Job Accelerator (RJA), artificial intelligence serves exclusively as an engine for structuring, phrasing, tailoring, and explaining. The AI layer is never an authoritative source of candidate qualifications, career history, credentials, employer tenure, achievements, or metrics.

---

## 1. The 8-Stage Invariant Pipeline

Every candidate workflow strictly obeys the linear invariant pipeline:

```text
EVIDENCE
   │
   ▼
ANALYSIS
   │
   ▼
GENERATION
   │
   ▼
TRUTH VALIDATION
   │
   ▼
HUMAN APPROVAL
   │
   ▼
EXECUTION
   │
   ▼
OBSERVATION
   │
   ▼
OUTCOME
```

No stage in this pipeline may bypass an earlier stage, nor may any downstream generation re-enter the upstream evidence layer as ground truth.

---

## 2. Separation of Responsibilities

| Layer | Permitted Operations | Prohibited Operations |
| :--- | :--- | :--- |
| **Evidence** | Retrieve and validate candidate records, parse resumes with length & sanitization boundaries, store structured profiles. | Inventing experience, extrapolating degrees, or inferring unstated certifications. |
| **Analysis** | Extract canonical job requirements, classify required vs. preferred criteria, map deterministic skill overlap. | Hiding genuine qualification gaps, fabricating job requirements, or mutating match metrics. |
| **Matching** | Compute deterministic 4-dimensional fit scores (Role, Technical, Leadership, Seniority/Remote). | Permitting AI models to alter or hallucinate the numerical match score or tier. |
| **Generation** | Rephrase verified evidence for ATS readability, format reverse-chronological experience, draft cover letters and screening answers. | Inventing employer names, projecting unverified tools/languages, or fabricating quantified metrics. |
| **Truth Validation** | Scan generated text for unverified high-stakes credentials (PMP, PE, CISSP, PhD, MBA), detect tenure inflation, compute truth scores. | Silently tolerating hallucinations or assuming generative output is factual. |
| **Human Review** | Present the complete application package to the candidate, require explicit confirmation and signature. | Assuming automated candidate consent, submitting unreviewed drafts, or bypassing the review gate. |
| **Execution** | Verify approved SHA-256 content fingerprints, enforce idempotent submission, dispatch via ATS or validated email. | Silently modifying approved text during transit, dispatching unapproved artifacts, or retrying non-idempotently. |
| **Observation** | Record discrete state transition events (`draft`, `review`, `approved`, `ready_to_apply`, `applied`, `interview`, `offer`). | Treating outcome states as ephemeral mutable fields without auditable event logs. |
| **Outcome** | Track response rates, interview conversion, offer velocity, and measurable career ROI against original evidence. | Attributing career outcomes to generative text without causal evidence. |

---

## 3. The Truthfulness Boundary Architecture

```text
                 ┌──────────────────────────────────────────────┐
                 │                EVIDENCE LAYER                │
                 ├──────────────────────────────────────────────┤
                 │ • Verified Candidate Structured Profile      │
                 │ • Verified Master Resume Text                │
                 │ • Extracted Canonical Job Requirements       │
                 │ • Explicit Qualification Matches / Citations │
                 └──────────────────────┬───────────────────────┘
                                        │
                                        ▼
                 ┌──────────────────────────────────────────────┐
                 │               GENERATION LAYER               │
                 ├──────────────────────────────────────────────┤
                 │ • ATS Resume Bullet Wording & Formatting     │
                 │ • Tailored Cover Letter & Direct Email Pitch │
                 │ • Targeted Screening Answers (100–200 words) │
                 │ • Strategic Positioning Advice               │
                 └──────────────────────┬───────────────────────┘
                                        │
                                        ▼
                 ┌──────────────────────────────────────────────┐
                 │       APPLICATION TRUTHFULNESS GUARD         │
                 │         (lib/applications/truthfulness.ts)   │
                 └──────────────────────┬───────────────────────┘
                                        │
                                 Unsupported Claims?
                                   ┌────┴────┐
                                  YES        NO
                                   │         │
                                   ▼         ▼
                              [HARD BLOCK] [HUMAN REVIEW GATE]
                                   │         │
                            Cannot Approve   Candidate Signature Required
                                             │
                                             ▼
                                     [ready_to_apply]
                                             │
                                             ▼
                                     [applied / tracked]
```

### The Two-Key Protection Standard
An application package cannot transition to `ready_to_apply` or `applied` unless two independent keys are satisfied:
1. **Automated Key**: The Application Truthfulness Guard reports `is_truthful: true` and zero unsupported credential claims.
2. **Human Key**: The candidate provides explicit review confirmation and signature recorded with an immutable timestamp (`human_approved_at`).

---

## 4. Forward Architecture: Controlled Execution & Outcome Intelligence (v4.6)

As RJA expands from preparation into controlled execution, two additional security boundaries are enforced:

### A. Approved Artifact SHA-256 Fingerprinting
To eliminate **approved-content mutation**, every human approval computes a cryptographic digest of the complete package:
$$\text{fingerprint} = \text{SHA-256}(\text{tailored\_resume} \parallel \text{cover\_letter} \parallel \text{screening\_answers})$$
The execution engine must recompute and verify this digest prior to transmission. If a single character differs, execution is halted with an immediate hard block.

### B. Evidence Snapshotting
Whenever an application is approved, an immutable snapshot of the supporting candidate profile and raw evidence is permanently linked to the application record (`evidence_snapshot_id`). If the candidate subsequently updates their master profile, historical applications remain fully auditable against the exact evidence that supported them on the day of submission.

### C. Event-Sourced Outcome State Machine
Status transitions are modeled as discrete historical events rather than mutable column updates:

```text
Application Draft Created
          ↓
Application Review Started
          ↓
Human Approval Recorded
          ↓
Application Ready to Apply
          ↓
Submission Dispatched / Confirmed
          ↓
Application Viewed by Recruiter
          ↓
Recruiter Response Received
          ↓
Screening Scheduled
          ↓
Technical / Team Interviews
          ↓
Final Round
          ↓
Offer Extended / Accepted / Rejected
```

---

## 5. RJA Architectural Progression

```text
v4.3 — Security Baseline & CI Foundation
       Can we trust the system environment and runtime safety?
          ↓
v4.4 — Production Job Intelligence
       Can the system accurately normalize, deduplicate, and match jobs?
          ↓
v4.5 — Application Intelligence & Truthfulness Boundary
       Can the system prepare truthful, evidence-backed application packages?
          ↓
v4.6 — Controlled Execution & Outcome Intelligence
       Can the system safely execute approved applications and measure real career ROI?
          ↓
v5.0 — Agentic Career Operations Platform
       Can autonomous agents orchestrate multi-channel career growth predictably?
```
