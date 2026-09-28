# RJA v5.0: Phase P5 Operations Runbook

**Phase:** P5 — Production & Market Deployment  
**System Target:** RJA v5.0.0 Production Cluster  
**Audience:** Site Reliability Engineering (SRE), Production Operations, DevSecOps  
**Document Version:** 1.0.0  

---

## 1. System Overview & Deployment Topology

RJA v5.0.0 is architected as a stateless, deterministic governed agentic execution engine backed by immutable audit stores:

```
                          INGRESS / CDN (TLS 1.3 Termination)
                                           │
                                           ▼
                       API GATEWAY / LOAD BALANCER (Round-Robin)
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
          Worker Pods (Cluster A)                       Worker Pods (Cluster B)
        ┌─────────────────────────┐                   ┌─────────────────────────┐
        │  RJA v5.0.0 Stateless   │                   │  RJA v5.0.0 Stateless   │
        │  Core Substrate (Frozen)│                   │  Core Substrate (Frozen)│
        └───────────┬─────────────┘                   └───────────┬─────────────┘
                    │                                             │
                    └──────────────────────┬──────────────────────┘
                                           │
            ┌──────────────────────────────┼──────────────────────────────┐
            ▼                              ▼                              ▼
     PRIMARY POSTGRES              DISTRIBUTED REDIS               OBJECT STORE
  (ACID Ledger & Telemetry)    (Idempotency & Rate Locks)     (Immutable SHA-256 S3)
```

### Critical Operational Invariant
- **Stateless Agent Execution:** All agent reasoning runs inside stateless, ephemeral execution contexts.
- **Immutable Storage:** Output artifacts (resumes, cover letters, receipts) are stored as content-addressed objects indexed by their `rja-c14n-v1-sha256` canonical fingerprint.
- **Substrate Freeze:** SREs cannot patch, hot-reload, or monkey-patch `lib/execution/` or `lib/agents/` in production without a formal release cycle tagged and certified.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-01: Deployment Health Verification & Bootstrapping
1. **Version Handshake:**
   - Execute GET `/api/health/version`. Verify response:
     ```json
     { "status": "HEALTHY", "version": "5.0.0", "coreSubstrateDrift": false }
     ```
2. **Substrate Integrity Verification:**
   - Run cryptographic checksum against certified deployment manifest (`release_manifest_v5.0.0.json`).
   - If checksum mismatch occurs, pod initialization immediately terminates (`CrashLoopBackOff`).
3. **External Connector Validation:**
   - Ping LLM model endpoint, Greenhouse API gateway, and Postgres read/write replica. All must respond within 500ms.

### SOP-02: Stale Idempotency Lock Clearing
When an upstream network partition causes an uncompleted lock state in Redis:
1. Identify locked application ID from operational alert:
   ```bash
   rja-ops lock inspect --app-id <APP_UUID>
   ```
2. Inspect lock age. If lock age $> 300\text{ seconds}$ and worker heartbeat has ceased:
   ```bash
   rja-ops lock release --app-id <APP_UUID> --reason "STALE_HEARTBEAT_TIMEOUT" --operator "<OPERATOR_ID>"
   ```
3. A security audit record `LOCK_FORCED_RELEASE` is automatically appended to the ledger.

### SOP-03: LLM Provider Circuit-Breaker Tripping & Recovery
If the primary LLM provider exhibits consecutive error rates $> 15\%$ over a 60-second sliding window:
1. **Automatic Tripping:** The execution gateway transitions to `CIRCUIT_OPEN` state.
2. **Deterministic Fallback:** Non-dispatched workflows gracefully fall back to the secondary certified inference endpoint (e.g., Anthropic Claude $\to$ Google Gemini or local model fallback).
3. **Manual Override / Reset:**
   - To inspect circuit breaker status:
     ```bash
     rja-ops circuit status --provider primary-llm
     ```
   - To manually reset after provider confirms resolution:
     ```bash
     rja-ops circuit reset --provider primary-llm --operator "<OPERATOR_ID>"
     ```

### SOP-04: Cryptographic Key & Secret Rotation
1. **HMAC Signing Keys:**
   - System supports dual-key signing during active rotation windows (Grace Period: 24 hours).
   - Rotate signing secret via KMS:
     ```bash
     rja-ops secrets rotate --key-type HMAC_AUDIT_V1 --new-key-version 2
     ```
2. **Candidate Key Pairs:**
   - Public keys are indexed by candidate UUID and key version. Historical application packages remain verifiable against their original signing key.

---

## 3. Incident Management & Severity Triage

| Severity | Definition | Target MTTA | Target MTTR | Escalation Path |
| :--- | :--- | :--- | :--- | :--- |
| **P0 - Critical** | Isolation breach, unauthorized external dispatch, data corruption, total service outage | $< 5\text{ min}$ | $< 30\text{ min}$ | SRE Lead + Security Officer + Core Maintainer |
| **P1 - Major** | Circuit breaker tripped, dispatch latency $> 60\text{s}$, degradation $> 10\%$ of workflows | $< 15\text{ min}$ | $< 2\text{ hours}$ | SRE On-Call + Lead Backend Engineer |
| **P2 - Moderate** | Secondary LLM provider fallback active, background telemetry lag | $< 1\text{ hour}$ | $< 8\text{ hours}$ | SRE On-Call |
| **P3 - Minor** | Non-blocking metric ingestion anomaly, minor UI rendering quirk | $< 1\text{ business day}$ | Next Sprint | Operations Support |

### Emergency Kill-Switch SOP (P0 Escalation)
If unauthorized agent behavior or telemetry anomaly is detected:
1. Engage Global Dispatch Kill-Switch:
   ```bash
   rja-ops kill-switch engage --scope ALL_DISPATCHES --reason "P0_INVESTIGATION"
   ```
2. Result:
   - External HTTP connectors to Greenhouse, Lever, and Workday are immediately severed.
   - All in-flight workflows are safely frozen in `AWAITING_SOVEREIGN_REVIEW` state.
   - Zero applications can be dispatched until explicit operator disengagement.

---

## 4. Disaster Recovery & Rollback Matrix

- **Recovery Time Objective (RTO):** $< 5\text{ minutes}$.
- **Recovery Point Objective (RPO):** $0\text{ seconds}$ (All state transitions and ledger events are synchronously written to append-only WAL before client acknowledgement).
- **Rollback Invariant:** Because v5.0.0 is immutable, rolling back simply points traffic to the previous known green container image tag. Database schema is strictly backward-compatible.
