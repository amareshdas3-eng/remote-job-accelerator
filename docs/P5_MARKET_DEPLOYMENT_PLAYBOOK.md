# RJA v5.0: Phase P5 Market Deployment Playbook

**Phase:** P5 — Production & Market Deployment  
**Product Baseline:** RJA v5.0.0 Governed Agentic System  
**Audience:** Growth, Operations, Product Engineering, and Customer Success  
**Document Version:** 1.0.0  

---

## 1. Market Positioning & Core Narrative

RJA v5.0.0 is not an autonomous black-box bot that spams recruiters. It is:

> **“A governed career acceleration platform providing elite intelligence assistance with uncompromised human sovereignty.”**

### The 4 Customer Value Pillars
1. **Zero Hallucination Guarantee:** Applications cite 100% verified career evidence. No exaggerated skills, forged dates, or fabricated credentials.
2. **20× Speed Acceleration:** Candidates review and dispatch fully tailored, ATS-optimized packages in 2 minutes instead of 45 minutes.
3. **Fail-Safe Conflict Protection:** The Policy Guard actively blocks contradictory applications, overlapping schedules, and duplicate representations.
4. **Permanent Cryptographic Provenance:** Candidates retain an immutable, verifiable audit certificate for every application dispatched.

---

## 2. Market Cohort Phasing

```
┌────────────────────────────────────────────────────────────────────────┐
│                      P5 MARKET DEPLOYMENT PHASES                       │
├─────────┬──────────────────────────┬──────────────┬────────────────────┤
│ Phase   │ Cohort Focus             │ Scale Target │ Gate Criteria      │
├─────────┼──────────────────────────┼──────────────┼────────────────────┤
│ 5.1     │ Closed Technical Beta    │ 25 Candidates│ Unassisted Onboard │
│         │ (Distributed Systems/SRE)│ 100 Apps     │ Zero Support P0s   │
├─────────┼──────────────────────────┼──────────────┼────────────────────┤
│ 5.2     │ Expanded Tech Cohorts    │ 150 Users    │ Retention > 80%    │
│         │ (ML, Fullstack, Mobile)  │ 1,000 Apps   │ Unit ROI > 15x     │
├─────────┼──────────────────────────┼──────────────┼────────────────────┤
│ 5.3     │ General Market Release   │ Open Sign-Up │ $99.95\%$ Uptime   │
│         │ (All Remote Disciplines) │ Self-Serve   │ Zero Leakage SLA   │
└─────────┴──────────────────────────┴──────────────┴────────────────────┘
```

---

## 3. Self-Serve Customer Journey

```
  1. Instant Resume Ingestion
     Upload PDF/DOCX → Auto-extraction of verified skills, roles, and dates
             │
             ▼
  2. Cryptographic Evidence Snapshot Creation (T1)
     Candidate confirms career facts → Sealed with immutable SHA-256 hash
             │
             ▼
  3. Governed Opportunity Discovery & 4D Matching (T0, T2)
     Real-time remote job intake → Deterministic 0–100 fit scoring & gap identification
             │
             ▼
  4. Autonomous Package Orchestration & Policy Guard (T3, T4, T5)
     4 specialized agents assemble tailored resume, cover letter, and screening answers
     Policy Guard verifies authenticity, negative capabilities, and schedule conflicts
             │
             ▼
  5. Sovereign Human Review Gate (T6) ◄── MANDATORY
     Candidate views diffs, citation highlights, and signs with authenticated signature
             │
             ▼
  6. Cryptographic Freeze & Substrate Dispatch (T7, T8)
     Artifact sealed with rja-c14n-v1-sha256 → Idempotent dispatch to Greenhouse/Lever/Workday
             │
             ▼
  7. Verifiable Submission Receipt & Outcome Analytics (T9)
     Candidate receives immutable audit receipt and live response tracking
```

---

## 4. Customer Support Runbook & SLA

- **Response Time Target:** $< 1\text{ hour}$ for onboarding or subscription queries.
- **Policy Decision Assistance:** In-app explainer when Policy Guard surfaces a required decision (e.g. relocation waiver or schedule conflict).
- **Incident Escalation:** Tier 1 (Self-serve documentation) $\to$ Tier 2 (Customer Operations) $\to$ Tier 3 (Engineering Lead).
- **Zero-Authority Invariant for Support Staff:** Support personnel cannot manually sign off or bypass the Sovereign Review Gate on behalf of candidates.

---

## 5. Economic & Subscription Architecture

| Tier | Monthly Fee | Included Features | Unit Economics |
| :--- | :--- | :--- | :--- |
| **Free Tier** | $\$0.00$ | Profile ingestion, Evidence Snapshot, 4D job discovery, gap analysis | CAC driver; zero API execution cost |
| **Pro Tier** | $\$29.00 / \text{mo}$ | 50 tailored application packages/mo, Policy Guard, Sovereign Review Gate, ATS dispatch | Gross margin $> 90\%$ (AI cost $\approx \$2.10/\text{mo}$) |
| **Executive Tier** | $\$79.00 / \text{mo}$ | Unlimited tailored packages, multi-schedule planning, priority portal dispatch | Gross margin $> 85\%$ |

---

## 6. Feedback Loop to v5.1.0 Workstream

All feedback gathered during market operation follows the certified RFC protocol:
1. Candidate or operations log observation.
2. Formulate formal Change Proposal (CP).
3. Human Architecture Review assigns disposition: **Approve for v5.1.0**, **Defer**, or **Reject**.
4. Core v5.0.0 remains 100% frozen until formal version bump.
