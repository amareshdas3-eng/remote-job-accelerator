# RJA v5.0: Phase P5 Production Metrics & Evidence Specification

**Phase:** P5 — Production & Market Deployment  
**System Target:** RJA v5.0.0 Governed Production System  
**Audience:** Data Engineering, FinOps, SRE, Product Operations  
**Document Version:** 1.0.0  

---

## 1. Metric Architecture & Operational Governance

Phase P5 operationalizes continuous production telemetry and empirical evidence recording across 5 core domains:

```
                          PRODUCTION METRIC ENGINE
                                     │
       ┌──────────────┬──────────────┼──────────────┬──────────────┐
       ▼              ▼              ▼              ▼              ▼
  1. ONBOARDING  2. CONTINUOUS  3. MULTI-USER  4. UNIT        5. ENVIRONMENT
    AUTONOMY       OPERATIONS     ISOLATION      ECONOMICS      REPLICABILITY
```

All operational events are captured by `lib/telemetry/productionOps.ts` and logged into the **P5 Production Evidence Ledger**.

---

## 2. Quantitative Metric Matrix & Target Thresholds

### Domain 1: Unassisted User Onboarding
Measures whether a user can register, ingest career evidence, configure search criteria, and generate their first application package without human engineering support.

| Metric | Target SLA | Formula | Data Source |
| :--- | :--- | :--- | :--- |
| **Setup Completion Rate** | $\ge 90.0\%$ | $\frac{\text{Completed Evidence Snapshots}}{\text{Total Onboarding Signups}} \times 100$ | Telemetry Event `ONBOARDING_SNAPSHOT_SEALED` |
| **Configuration Error Rate** | $< 5.0\%$ | $\frac{\text{Malformed Profile Submissions}}{\text{Total Profile Attempts}} \times 100$ | Schema Validation Errors |
| **Time-to-First-Application (TTFA)** | $< 10.0\text{ min}$ | $\text{Timestamp}_{\text{First Dispatch}} - \text{Timestamp}_{\text{Signup}}$ | User Journey Latency Timer |
| **Support Intervention Rate** | $< 0.10\text{ / user}$ | $\frac{\text{Support Tickets During Setup}}{\text{Total New Users}}$ | Zendesk / Operations Ledger |
| **Onboarding Abandonment Rate** | $< 10.0\%$ | $\frac{\text{Dropoffs Prior to First Evaluation}}{\text{Total Signups}} \times 100$ | Funnel Drop-off Telemetry |

### Domain 2: Continuous Production Operations
Measures continuous 24/7 reliability, autonomous job discovery, Policy Guard safety, and MTTR.

| Metric | Target SLA | Formula | Data Source |
| :--- | :--- | :--- | :--- |
| **Platform Availability** | $\ge 99.95\%$ | $\frac{\text{Uptime Minutes}}{\text{Total Minutes}} \times 100$ | Synthetic Ping / SRE Monitor |
| **Successful Completion Rate** | $\ge 95.0\%$ | $\frac{\text{Dispatched Workflows}}{\text{Total Eligible Approved Applications}} \times 100$ | Execution Substrate Log |
| **Policy Guard Intervention Frequency**| $5.0\% - 15.0\%$ | $\frac{\text{Policy Blocks or Human Decisions}}{\text{Total Workflow Lifecycles}} \times 100$ | Policy Guard Ledger |
| **Provider MTTR** | $< 30.0\text{ sec}$ | $\text{Timestamp}_{\text{Failover Ready}} - \text{Timestamp}_{\text{Provider Outage}}$ | Circuit Breaker Telemetry |
| **Audit Completeness** | $100.0\%$ | $\frac{\text{Workflows with Valid Hash Chain}}{\text{Total Executed Workflows}} \times 100$ | Merkle Tree Validator |
| **Operational Incident Rate** | $< 0.05\text{ / workflow}$ | $\frac{\text{P0 + P1 Incidents}}{\text{Total Completed Workflows}}$ | PagerDuty / Incident Ledger |

### Domain 3: Multi-User Isolation
Measures boundary integrity across Tenant, Candidate, Job, Artifact, Audit, and Authority layers.

| Metric | Target SLA | Formula | Verification |
| :--- | :--- | :--- | :--- |
| **Tenant Boundary Violations** | $\mathbf{0.00\%}$ | $\text{Count}(\text{Cross-Tenant Queries Accepted})$ | Automated Query Audit |
| **Candidate Vault Cross-Talk** | $\mathbf{0.00\%}$ | $\text{Count}(\text{Candidate Evidence Leaked to Peer})$ | Cryptographic Token Audit |
| **Artifact Cross-Contamination**| $\mathbf{0.00\%}$ | $\text{Count}(\text{Artifact Linked to Wrong Candidate})$ | Content-Address Hash Match |
| **Authority Escalation Attempts** | $\mathbf{0.00\%}$ | $\text{Count}(\text{Agent API Calls Authorized directly})$ | Substrate Execution Filter |

### Domain 4: Production Unit Economics
Direct empirical tracking of real AI tokens, human review labor, infrastructure, and support costs.

$$\text{Total Cost per Application} = C_{\text{AI}} + C_{\text{Review}} + C_{\text{Infra}} + C_{\text{Support}}$$

| Cost Component | P4 Pilot Baseline | P5 Target SLA | Unit Calculation |
| :--- | :--- | :--- | :--- |
| **AI Inference ($C_{\text{AI}}$)** | $\$0.042$ | $\le \$0.080$ | Exact token consumption across 4 stages |
| **Review Labor ($C_{\text{Review}}$)** | $\$2.23$ ($2.23\text{ min}$) | $\le \$3.00$ ($\le 3.0\text{ min}$) | Candidate review duration valued at $\$60.00/\text{hr}$ |
| **Cloud Hosting ($C_{\text{Infra}}$)**| $\$0.008$ | $\le \$0.020$ | Container compute + database compute per app |
| **Support Overhead ($C_{\text{Support}}$)**| $\$0.000$ | $\le \$0.150$ | Blended support staff cost per dispatched app |
| **Total Cost / Application** | **$\$2.28$** | **$\le \$3.25$** | Sum of 4 operational cost streams |
| **Manual Application Baseline**| $\$45.00$ ($45.0\text{ min}$) | $\$45.00$ | Industry manual application preparation benchmark |
| **Observed Economic Leverage** | **$19.8\times$** | **$\ge 13.8\times$** | $\frac{\$45.00}{\text{Total Cost per Application}}$ |

> *Note on Economic Extrapolation:* The P4 $19.8\times$ economic leverage is treated as the certified pilot benchmark. P5 tracks actual scale metrics without assuming identical leverage at higher market volumes.

### Domain 5: Multi-Environment Replicability
Validates that a secondary production environment produces bit-for-bit identical outputs without substrate drift.

| Metric | Target SLA | Verification Method |
| :--- | :--- | :--- |
| **Fingerprint Reproducibility** | $100.0\%$ | Canonical SHA-256 matches exactly across Environment A and B |
| **Execution Zero-Drift** | $0\text{ drift bytes}$ | `diff -r lib/execution/ envA/lib/execution/ envB/lib/execution/` |
| **Deterministic State Replay** | $100.0\%$ | Replaying audit event stream yields identical terminal state |

---

## 3. The P5 Production Evidence Ledger

Every production execution lifecycle writes an immutable entry into `p5_production_evidence_ledger.json`:

```json
{
  "p5RunId": "p5-run-20260928-001",
  "timestamp": "2026-09-28T06:00:00.000Z",
  "environment": "prod-us-east-1",
  "version": "5.0.0",
  "datasetJobId": "job-p5-sre-01",
  "workflowOutcome": "DISPATCHED_TO_EXTERNAL",
  "policyDecision": "ALLOW_REVIEW",
  "humanIntervention": false,
  "aiCostUsd": 0.0418,
  "reviewCostUsd": 1.95,
  "incidentId": "NONE",
  "auditFingerprint": "8d3fa8795c2f90a98297b83d1c1a938c83759cfb6c507c992d99e52c803328e7",
  "finalStatus": "SEALED_AND_EXECUTED"
}
```
