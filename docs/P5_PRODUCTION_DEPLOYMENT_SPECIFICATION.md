# RJA v5.0: Phase P5 Production & Market Deployment Specification

**Phase:** P5 — Production & Market Deployment  
**Release Baseline:** RJA v5.0.0 (`v5.0.0` Frozen Core — Architecture Zero-Drift)  
**Status:** Pre-Registered Production Specification & Deployment Governance  
**Document Version:** 1.0.0  

---

## 1. Executive Summary & Strategic Positioning

With the completion of the Phase P4 Controlled Production Pilot, the Remote Job Accelerator (RJA) has graduated from an experimental agent framework into an **Operated Product**:

> **“A governed agentic application system where AI can propose and reason across a complete workflow, while execution authority remains explicitly controlled by deterministic infrastructure and human approval.”**

The fundamental invariant remains inviolate:
$$\text{Agent Intelligence} \neq \text{Agent Authority}$$

P5 is an **operational deployment and market operation phase**, not another architecture change phase. The core v5.0.0 substrate remains strictly frozen.

---

## 2. The Five Practical Questions of Production Deployment

Phase P5 explicitly measures and answers five foundational operational questions:

```
                    P5 OPERATIONAL EVALUATION ARCHITECTURE
                                       │
         ┌─────────────────┬───────────┼───────────┬─────────────────┐
         ▼                 ▼           ▼           ▼                 ▼
   1. UNASSISTED     2. CONTINUOUS  3. MULTI-   4. ECONOMIC     5. REPRODUCIBLE
    ONBOARDING        OPERATIONS     TENANT      SURVIVAL         DEPLOYMENT
     Can users        Can system    ISOLATION    Can costs       Can env be
    setup alone?     run 24/7?     keep data    scale safely?   duplicated?
                                   isolated?
```

### Question 1: Can a new user onboard without engineering assistance?
- **Self-Service Verification:** Measurement of the complete onboarding journey from account creation and resume ingestion to evidence snapshot creation.
- **Tracked Metrics:**
  - Setup completion rate ($\ge 90\%$)
  - Configuration errors ($< 5\%$)
  - Time-to-first-application ($< 10\text{ minutes}$)
  - Support interventions ($< 0.1\text{ per user}$)
  - Onboarding drop-off / abandonment rate

### Question 2: Can RJA operate continuously without intervention?
- **24/7 Operational Uptime:** Sustained execution of autonomous Discovery, Evaluation, and Planning agents with fail-closed safety.
- **Tracked Metrics:**
  - Daily/weekly workflow throughput
  - Successful dispatch rate
  - Policy Guard intervention frequency
  - Provider failure recovery time (MTTR $< 30\text{ seconds}$)
  - 100% audit log completeness
  - Operational incidents ($< 0.05\text{ per completed workflow}$)

### Question 3: Can the system support concurrent multi-tenant users?
- **6-Layer Isolation Matrix:**
  1. *Tenant Isolation:* Distinct candidate accounts and workspaces.
  2. *Candidate Isolation:* Zero leakage of profile or evidence data between users.
  3. *Job Isolation:* Job matches and applications partitioned cleanly.
  4. *Artifact Isolation:* Tailored packages, fingerprints, and letters strictly bounded.
  5. *Audit Isolation:* Independent cryptographic Merkle traces.
  6. *Authority Isolation:* Agent tokens strictly scoped to single request context; zero privilege escalation.

### Question 4: Can the unit economics survive real-world scale?
- **Empirical Cost Accounting:** Tracking exact AI token costs, human review labor, infrastructure hosting, and support overhead:
  $$\text{Total Cost per Application} = C_{\text{AI}} + C_{\text{Review Labor}} + C_{\text{Infra}} + C_{\text{Support}}$$
- In P4, RJA delivered an observed **$19.8\times$ unit-economic leverage ratio** ($2.23\text{ min}$ review labor + $\$0.042$ AI cost $\approx \$2.28$ total vs. $\$45.00$ manual baseline). P5 verifies whether this efficiency holds as cohort volume expands.

### Question 5: Can deployment be repeated deterministically?
- **Multi-Environment Replicability:** A second, identical production environment (e.g. secondary cloud region, staging-to-prod mirror) must reproduce the exact certified behavior, canonical fingerprints, and zero-drift invariants without modifying the governed substrate.

---

## 3. The P5 Governance Boundary & Evidence Ledger

> **“P5 may deploy and operate v5.0.0, but production usage cannot silently change the certified architecture, governance state, historical records, or authority model.”**

Production usage creates **evidence**, not authority.

```
                    v5.0.0 PRODUCTION BASELINE (🔒 FROZEN)
                                       │
                         ┌─────────────┴─────────────┐
                         ▼                           ▼
                   Production Use              Telemetry & Ledger
                         │                           │
                         └─────────────┬─────────────┘
                                       ▼
                             Continuous Evidence
                                       │
                                       ▼
                              Change Proposal (RFC)
                                       │
                                Human Review
                                 /        \
                                /          \
                            Reject        Approve
                                            │
                                            ▼
                                      v5.1.0 Workstream
```

### The Continuous Production Evidence Ledger Schema
All production lifecycles must append an entry to the immutable ledger:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `p5RunId` | `string` | Unique execution identifier (`p5-run-*`) |
| `timestamp` | `string` | ISO 8601 UTC timestamp |
| `environment` | `string` | Target environment (`prod-us-east`, `prod-eu-west`, `prod-staging`) |
| `version` | `string` | Certified core version (`5.0.0`) |
| `datasetJobId` | `string` | Ingested job posting identifier |
| `workflowOutcome` | `string` | `DISPATCHED_TO_EXTERNAL` \| `POLICY_BLOCKED` \| `HUMAN_REJECTED` |
| `policyDecision` | `string` | `ALLOW_REVIEW` \| `REQUIRE_HUMAN_DECISION` \| `BLOCK` |
| `humanIntervention` | `boolean` | Whether manual edits or waiver notes were required |
| `aiCostUsd` | `number` | Exact token expenditure for 4 agent stages |
| `reviewCostUsd` | `number` | Candidate review time valued at $60.00/hr ($1.00/min) |
| `incidentId` | `string` | Associated operational incident ticket or `NONE` |
| `auditFingerprint` | `string` | Canonical SHA-256 fingerprint (`rja-c14n-v1-sha256`) |
| `finalStatus` | `string` | `SEALED_AND_EXECUTED` \| `HALTED_SAFE` |

---

## 4. Operational SLAs & Invariants

1. **Agent Authority Invariant:** `canExecute === false`, `canApprove === false`, `canMutateEvidence === false` permanently.
2. **Canonicalization Standard:** Unconditionally `rja-c14n-v1-sha256`.
3. **Sovereign Review Gate:** 100% of external dispatches must possess a cryptographically valid human reviewer signature (`candidateSignature`).
4. **Availability SLA:** $99.95\%$ platform uptime.
5. **Data Protection:** Zero secret leakage in telemetry; zero candidate cross-contamination.
