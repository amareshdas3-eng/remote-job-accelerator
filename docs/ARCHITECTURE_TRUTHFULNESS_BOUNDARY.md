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
v4.3 — Security Foundation & CI Baseline
       Can we trust the system environment, memory safety, and runtime integrity?
          ↓
v4.4 — Deterministic Job Intelligence
       Can the system accurately normalize, deduplicate, and match jobs deterministically?
          ↓
v4.5 — Truthful Application Generation
       Can the system prepare truthful, evidence-backed application packages with hard truth boundaries?
          ↓
v4.6 — Controlled Application Execution
       Can the system safely execute approved applications with idempotency and measure factual career ROI?
          ↓
v4.6.1 — Cryptographic Execution Integrity & Formal Invariant Hardening
       Can the system mathematically guarantee byte-level canonicalization invariance and zero-tolerance mutation defense?
          ↓
v5.0 — Agentic Career Operations Platform
       Can autonomous agents orchestrate multi-channel career growth without undermining evidence boundaries?
```

---

---

## 6. The Governing Principles of Cryptographic & Agentic Integrity

The platform's security and truthfulness architecture is governed by six invariant principles:

1. **Generation is never evidence.**  
   LLMs structure, tailor, and phrase; they never fabricate credentials, experience, or qualifications.
2. **Human approval is mandatory.**  
   No application package may be dispatched without an authenticated candidate review signature.
3. **Approved content cannot mutate.**  
   Every approved artifact is bound to an immutable byte-level SHA-256 fingerprint verified pre-dispatch.
4. **Execution is idempotent.**  
   Duplicate submission attempts to the same destination are strictly blocked and return existing receipts.
5. **Every consequential transition is observable.**  
   State transitions are append-only event-sourced domain events, not ephemeral mutable rows.
6. **Outcomes are measured from recorded events, not invented attribution.**  
   Conversion rates and career turnaround timelines are computed solely from timestamped recruiter response events.

### The Chain of Architectural Coherence

These six principles form a strictly ordered, mutually dependent sequence:

```text
TRUTH (1. Generation is never evidence)
  ↓
CONSENT (2. Human approval is mandatory)
  ↓
INTEGRITY (3. Approved content cannot mutate)
  ↓
CONTROL (4. Execution is idempotent)
  ↓
AUDITABILITY (5. Every consequential transition is observable)
  ↓
MEASUREMENT (6. Outcomes are measured from recorded events, not invented attribution)
```

### The Seven Non-Negotiable Invariants of Bounded Autonomy

Before advancing toward v5.0 agentic operations, the architecture preserves these fundamental boundaries:

1. **AI may propose.** (Autonomous intelligence formulates strategies, discovers opportunities, and drafts packages).
2. **Evidence establishes truth.** (Structured profiles and verified credentials are the sole ground truth).
3. **Humans establish consent.** (No consequential action occurs without authenticated human signature).
4. **Fingerprints establish integrity.** (Cryptographic byte-level canonicalization locks approved content).
5. **Execution establishes control.** (Single-flight locks and destination-bound idempotency prevent runaway execution).
6. **Events establish auditability.** (Immutable append-only domain events capture every transition).
7. **Outcomes establish measurement.** (ROI and turnaround velocity are measured solely from verified employer responses).

By ensuring these invariants cannot be breached, autonomous agents operate with maximum efficacy without ever obtaining uncontrolled or unverified authority.

---

## 7. The Cryptographic Canonicalizer: Formal Invariants & Equivalence Classes (v4.6.1)

To turn unit-tested hashing into formal verification, the canonicalizer $C(x)$ satisfies strict mathematical invariants verified via property and fuzz testing across randomized valid artifacts:

### A. Idempotency Invariant
$$\forall x \in \text{ValidArtifacts}: \quad C(C(x)) = C(x)$$
Applying canonicalization repeatedly to an already-canonicalized payload produces the exact same canonical string representation.

### B. Determinism Invariant
$$\forall x \in \text{ValidArtifacts}: \quad H(C(x))_1 = H(C(x))_2$$
Independent evaluations of the digest $H(C(x))$ over canonicalized content are strictly deterministic across arbitrary execution runtimes, platforms, and invocations.

### C. Representation-Equivalent Transformations (Preserve Digest)
$$\text{hash}(C(x')) = \text{hash}(C(x))$$
The following transformations alter physical or transport representation without altering semantic content, and **MUST PRESERVE** the digest:
- **Object Key Reordering**: Arbitrary key insertion order at all dictionary depths.
- **Screening Answers Reordering**: Arbitrary permutation of the answers array (sorted deterministically by question identifier with deep tie-breaker).
- **Transport Newline Encoding**: Translations between `\r\n` (Windows CRLF), `\r` (Classic Mac CR), and `\n` (Unix LF).
- **Unicode Canonical Equivalence**: Canonical Decomposition (NFD) normalized to Canonical Composition (NFC).

### D. Representation-Divergent Mutations (Strictly Alter Digest)
$$\text{hash}(C(x'')) \neq \text{hash}(C(x))$$
Any substantive semantic mutation **MUST ALTER** the digest and trigger an immediate hard block:
- **+1 Character**: Adding, mutating, or removing a single ASCII character.
- **+1 Byte**: Mutating a single raw byte in the payload encoding.
- **+1 Unicode Codepoint**: Emoji, zero-width space, non-breaking space, or Cyrillic homoglyph substitution.
- **+1 Metadata Field**: Injecting or modifying metadata on resume, cover letter, or answers.
- **+1 Answer**: Adding, removing, or modifying screening questions or answers.
- **+1 Recipient**: Altering cover letter recipient or salutation.
- **+1 Nested Object Property**: Mutating deep nested dictionary keys or values.

---

## 8. Fundamental Distinction: Representation Equivalence vs. Semantic Equivalence

A core tenet of RJA's cryptographic architecture is the absolute distinction between representation equivalence and semantic equivalence:

> **Canonicalization establishes representation equivalence; it does not establish semantic equivalence.**

### Representation Equivalence (Preserved by Canonicalizer)
Representation-level decisions concern serialization artifacts and transport encodings:
- Normalizing Windows CRLF (`\r\n`) to Unix LF (`\n`)
- Sorting JSON keys alphabetically (`{"a":1,"b":2}` vs `{"b":2,"a":1}`)
- Composing Unicode glyphs (NFD decomposed `e` + `\u0301` to NFC precomposed `\u00e9`)

These transformations represent the **identical semantic meaning** in different byte transport encodings. The canonicalizer projects them into a single deterministic form, resulting in identical SHA-256 digests.

### Semantic Equivalence (Strictly Rejected / Detected)
In contrast, semantic changes alter the factual meaning of the document:
- Changing `"Senior Project Manager"` to `"Project Manager"`
- Changing notice period from `"3 weeks"` to `"2 weeks"`
- Omitting or inserting a single word or credential

Even if two phrases might be loosely "synonymous" in casual English, they are **not representationally equivalent**. The canonicalizer must never attempt NLP or heuristic "fuzzy matching" during fingerprinting. Any semantic or content alteration produces a completely divergent SHA-256 digest, halting dispatch immediately.

This boundary guarantees that autonomous agents can never subtly alter approved application wording under the guise of "minor phrasing polish."

---

## 9. The RJA Verification & Test Pyramid

RJA enforces a multi-tier verification hierarchy executed on every commit and release validation:

```text
                        RJA Verification
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
          Static              Unit          Integration
         Typecheck           Tests             Tests
             │                 │                 │
             └─────────────────┼─────────────────┘
                               │
                         Security Tests
                     (12 Hard Abuse Gates)
                               │
                        Execution Tests
                    (Idempotency & Receipts)
                               │
                        Property Tests
                 (Idempotency & Determinism)
                               │
                         Fuzz Testing
               (250 Random Artifact Mutations)
                               │
                  Golden Compatibility Tests
                 (Immutable Frozen Master Digests)
```

Every single tier is executed synchronously via `npm test` across **17 test suites (100% passing)**.

---

## 10. Canonicalization Contract Freeze & Scheme Versioning

To ensure backward compatibility across all historical application records, the canonicalization contract is frozen under an explicit algorithm scheme:

```typescript
export const DEFAULT_FINGERPRINT_SCHEME = 'rja-c14n-v1-sha256';
```

### Golden Fixture Baseline (`tests/fixtures/canonicalization/`)
The specification is locked against 5 permanent golden fixtures:
1. `artifact-basic.json` — Standard baseline application package (`d7edc7f...`)
2. `artifact-unicode.json` — Multilingual Unicode and composite symbols (`9a4fc05...`)
3. `artifact-newlines.json` — Mixed transport CRLF/CR line endings (`087885f...`)
4. `artifact-nested.json` — Deeply nested dictionaries and metadata (`629dee8...`)
5. `artifact-duplicate-question-ids.json` — Identical question collision tiebreakers (`ca69113...`)

Any future modification to `lib/execution/fingerprint.ts` must prove:
$$\text{existing\_digest} \equiv \text{new\_digest}$$
across all golden fixtures. If the canonicalization specification ever needs to evolve, the scheme identifier will be explicitly versioned:
$$\text{rja-c14n-v1-sha256} \longrightarrow \text{rja-c14n-v2-sha256}$$
preventing ambiguity in historical application receipts or audit trails.


