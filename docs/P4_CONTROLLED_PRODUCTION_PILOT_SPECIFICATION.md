# RJA v5.0: Phase P4 Controlled Production Pilot Specification

**Phase:** P4 — Controlled Production Pilot & Operational Evidence  
**Release Baseline:** RJA v5.0.0 (`v5.0.0` Frozen Core — Architecture Zero-Drift)  
**Status:** Pre-Registered Pilot Protocol & Measurement Specification  
**Cohort Size:** 5 Verified Technical Candidates across 25 Real Remote Job Applications  
**Document Version:** 1.0.0  

---

## 1. Pilot Objective & The Crucial Distinction

Phase P4 transitions RJA from engineering and benchmark validation into **real user operational evidence**:

| Phase | Core Question Answered | Nature of Evidence |
| :---: | :--- | :--- |
| **P2** | *"Does RJA perform against a controlled real-world benchmark?"* | Benchmark & Synthetic Double-Blind Evidence |
| **P3** | *"Can RJA withstand operational failure conditions?"* | Chaos, Resilience & Hardening Proof |
| **P4** | ***"Can real users operate RJA successfully?"*** | **Empirical Operational Pilot Evidence** |

### Pilot Invariant
> **Do not optimize the system during the pilot.**  
> The system under pilot is the certified, frozen `v5.0.0` core.

---

## 2. P4 Governance Invariant & Change Proposal Protocol

> **“The pilot may generate operational evidence, but pilot observations cannot silently modify the certified v5.0.0 architecture or historical records.”**

Any operational friction, edge case, or capability gap observed during the pilot does **NOT** trigger on-the-fly code edits. Instead, it must be captured as a formal **Change Proposal (CP)** for human review:

```
                          REAL PILOT USERS
                                 │
                                 ▼
                     CONTROLLED PRODUCTION PILOT
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
Operational Telemetry      User Feedback               Failure & Latency
     │                           │                           │
     └───────────────────────────┼───────────────────────────┘
                                 ▼
                          CHANGE PROPOSAL
                     (Formal RFC Specification)
                                 │
                                 ▼
                         HUMAN REVIEW GATE
                                 │
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
              REJECT           DEFER          APPROVE
           (Out of Scope)  (Backlog Item)  (Targeted for
                                            Future v5.1.0)
```

---

## 3. Pre-Registered Pilot Scorecard (14 Operational Dimensions)

Rather than arbitrary thresholds, P4 establishes a comprehensive empirical measurement framework:

| Dimension | Measure / Metric | Target Focus | Data Capture Mechanism |
| :--- | :--- | :--- | :--- |
| **1. Adoption** | Users completing workflows | Cohort retention & active engagement | Unique candidate IDs completing $\ge 1$ application |
| **2. Completion** | Started $\to$ completed workflows | Funnel drop-off & completion rate | Ratio of T8 dispatches to T0 discoveries |
| **3. Governance** | Policy blocks / human decisions | Safe intervention rate vs rubber-stamping | Count of Policy Guard blocks and required decisions |
| **4. Reliability** | Errors / successful recoveries | Uncaught exception rate (target: 0) | Operational error logs & retry telemetry |
| **5. Speed** | Human preparation + review time | Real wall-clock review & decision time | Stopwatch telemetry on sovereign review gate (T6) |
| **6. Evidence** | Verified / total claims | Factual claim grounding fidelity | Strict snapshot reference audit per claim |
| **7. Quality** | Independent quality assessment | Professional tone & role alignment | Blind evaluation score (1–5 scale) |
| **8. Corrections** | Edits per completed application | Human friction & manual override rate | Levenshtein edit distance & candidate override count |
| **9. Cost** | AI tokens + human review cost | True economic unit cost per job | Token pricing + labor baseline ($60.00/hr) |
| **10. ATS Ingestion** | Successful package ingestion | Structural compatibility across ATSs | Greenhouse, Lever, and Workday parsing audit |
| **11. Auditability** | Complete cryptographic trace | Merkle/hash chain completeness (T0–T12) | `verifyUnifiedLifecycleAuditTrail` validation |
| **12. Determinism** | Repeated identical-input behavior | Byte-level fingerprint stability | Canonical digest verification (`rja-c14n-v1-sha256`) |
| **13. Support** | Incidents / user intervention | Operational support requests | Incident tickets per completed application |
| **14. Security** | Security events / secret exposure | Secret leakage or authority breach | Automated secret scan & authority invariant audit |

---

## 4. Controlled Pilot Cohort Design

The pilot cohort is defined in [`tests/fixtures/p4_pilot_cohort.json`](file:///c:/RJA/v4.3/app/tests/fixtures/p4_pilot_cohort.json):

### Candidate Demographics ($N = 5$)
1. **Sarah Jenkins (`cand-pilot-01`):** Staff Backend & Distributed Systems Engineer (8 yrs, Go/Rust/Kafka/K8s). Target: High-throughput infrastructure roles (Stripe, Figma, DoorDash, Cloudflare, Block).
2. **Marcus Vance (`cand-pilot-02`):** Lead SRE & Platform Infrastructure Engineer (9 yrs, K8s/Terraform/AWS/Prometheus). Target: Cloud reliability roles (Datadog, Snowflake, HashiCorp, Uber, Elastic).
3. **Elena Rostova (`cand-pilot-03`):** Senior ML Platform Engineer (7 yrs, Python/PyTorch/Spark/Ray). Target: AI/ML systems roles (OpenAI, Anthropic, W&B, Scale AI, Cohere).
4. **David Chen (`cand-pilot-04`):** Principal Enterprise Cloud Architect (12 yrs, Java/Distributed/AWS/Azure). Target: Strategic architecture roles (Capital One, JPMorgan, Cisco, Salesforce, MongoDB).
5. **Aisha Patel (`cand-pilot-05`):** Engineering Manager - Platform (11 yrs, Leadership/Agile/Hiring/K8s). Target: Engineering leadership roles (Reddit, Spotify, Airbnb, Pinterest, Shopify).

### Application Distribution ($N = 25$)
- **Greenhouse:** 12 applications
- **Lever:** 4 applications
- **Workday:** 9 applications

---

## 5. Change Proposal Format Standard

When operational friction is observed during pilot execution, it must be documented using this standard template:

```markdown
### Change Proposal: [CP-XXX] [Short Title]
- **Originating Application ID:** app-pilot-XXX
- **Affected Lifecycle Stage:** T0..T12
- **Observed Behavior:** What happened during the pilot?
- **Root Cause:** Architectural, schema, or UX friction point.
- **Proposed Modification:** Exact recommended code or prompt adjustment.
- **Authority & Governance Assessment:** Does this increase agent authority? (Must be NO).
- **Disposition:** [APPROVED FOR FUTURE v5.1.0 | DEFERRED | REJECTED]
```

---

## 6. Pilot Execution & Measurement Protocol

The pilot test harness [`tests/p4_controlled_production_pilot.mjs`](file:///c:/RJA/v4.3/app/tests/p4_controlled_production_pilot.mjs) must:
1. Execute all 25 candidate-job pairs through the full T0–T12 lifecycle.
2. Record real wall-clock latency, token usage, and human review decisions.
3. Verify that zero unauthorized executions occur.
4. Record all 14 scorecard dimensions.
5. Generate formal Change Proposals for any observed edge cases or policy friction.
6. Verify zero drift on `lib/execution/` and `lib/agents/`.
