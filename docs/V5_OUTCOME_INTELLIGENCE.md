# RJA v5.0-alpha7: Outcome Intelligence & Temporal Integrity

## 1. Governing Invariant
> **“Outcome Intelligence observes history; it does not rewrite history.”**
> Outcomes may inform future intelligence, but they must never rewrite historical truth or retroactively alter an executed artifact, receipt, or upstream evaluation.

```text
🔎 Discovery Agent
       │
       ▼
📁 Evidence Snapshot (Immutable Baseline)
       │
       ▼
🧠 Evaluation Agent
       │
       ▼
📋 Planning Agent
       │
       ▼
🤖 Agent Orchestrator
       │
       ▼
🛡️ Policy Intelligence (Server Policy Guard)
       │
       ▼
👤 Human Approval Gate (Sovereign Candidate Signature)
       │
       ▼
🔒 Frozen Artifact (rja-c14n-v1-sha256)
       │
       ▼
⚙️ v4.6.1 Execution Substrate (Receipt Issued)
       │
       ▼
📊 OUTCOME INTELLIGENCE [v5.0-alpha7]
       │
       ├── Reads Execution Receipt
       ├── Reads Frozen Artifact
       ├── Classifies Observations
       ├── Identifies Deviations (Planned vs Observed)
       └── Emits Immutable OutcomeRecord
              │
              ▼
       Future Baseline Evidence (Bounded Feedback)
```

---

## 2. Temporal Integrity & Write-Once Immutability

The RJA pipeline is strictly unidirectional across time:
1. $T_0$: Discovery Proposal
2. $T_1$: Evidence Snapshot
3. $T_2$: Evaluation Proposal
4. $T_3$: Planning Proposal
5. $T_4$: Policy Decision Proposal
6. $T_5$: Human Approval Gate
7. $T_6$: Freeze Boundary
8. $T_7$: Execution Dispatch & Receipt Generation
9. $T_8$: Outcome Observation & Record Generation

**Prohibited Retroactive Operations:**
- At $T_8$, Outcome Intelligence cannot modify $T_0-T_7$.
- Execution receipts remain the final word on substrate dispatch.
- Frozen artifacts remain cryptographically sealed under `rja-c14n-v1-sha256`.
- Deviations between planned and observed actions generate new historical records rather than modifying historical plans.

---

## 3. Deviation Intelligence

Outcome Intelligence evaluates:
$$\text{PLANNED} \quad \text{vs} \quad \text{EXECUTED} \quad \text{vs} \quad \text{OBSERVED}$$

When execution diverges (e.g., submission timing delay, employer platform response, route variance), Outcome Intelligence captures the divergence as an `OutcomeDeviation`:
- `TIMING`: Latency or dispatch window shifts.
- `SCOPE`: Channel or credential variations.
- `DEPENDENCY`: Pre-dispatch requirement resolution differences.
- `RESULT`: Confirmation receipts, application IDs, interview invitations, or rejections.
- `EXECUTION_FAILURE`: Transient network or portal failures.
