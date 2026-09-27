# RJA v5.0-alpha6: Policy Intelligence & Governance Gate

## 1. Governing Invariant
> **“Policy may govern proposals, but agents cannot manufacture authority.”**
> Agents propose; server policy evaluates; human candidates authorize; cryptographic freeze locks; v4.6.1 execution executes. No agent may transition a proposal directly to freeze or execution.

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
🛡️ POLICY INTELLIGENCE [v5.0-alpha6]
       │ evaluates authenticity, freshness, consistency, compliance
       ▼
👤 HUMAN APPROVAL GATE (Sovereign Candidate Signature)
       │
       ▼
🔒 FREEZE BOUNDARY (rja-c14n-v1-sha256 Sealed Artifact)
       │ zero agent mutation, zero retroactive tampering
       ▼
⚙️ v4.6.1 EXECUTION SUBSTRATE (SEALED)
       │
       ▼
📊 OUTCOMES
```

---

## 2. The Five Governance Questions

The Policy Intelligence engine evaluates incoming proposals against five rigorous criteria:

1. **Authenticity**: Are the cryptographic provenance records, proposal identifiers, candidate snapshot ID, and evidence SHA-256 hash valid and verified?
2. **Freshness**: Are the candidate snapshot, upstream proposals, and dependencies current, or has drift occurred?
3. **Consistency**: Are there unresolved blocking conflicts (e.g., `PLAN_CONTRADICTION`, `SNAPSHOT_DRIFT`, `STALE_PROPOSAL`) or missing dependencies?
4. **Compliance**: Does the proposal conform strictly to safety, pacing, and negative authority contracts (`canExecute: false`, `canApprove: false`, `canMutateEvidence: false`)?
5. **Authorization**: Has an authenticated human candidate explicitly reviewed and signed the package? (Agents are strictly prohibited from signing).

---

## 3. Governance State Machine

```text
                  ┌──────────────────────┐
                  │     ORCHESTRATED     │
                  └──────────┬───────────┘
                             │
                             ▼
                    POLICY EVALUATION
                             │
             ┌───────────────┼───────────────┐
             ↓               ↓               ↓
           BLOCK          REQUIRE          ALLOW
             │         HUMAN DECISION      REVIEW
             │               │               │
             ▼               ▼               ▼
          TERMINAL      HUMAN DECISION   HUMAN GATE
                         RESOLUTION          │
                             │               │
                      ┌──────┴──────┐        │
                      ↓             ↓        │
                    REJECT       APPROVE ◄───┘
                      │             │
                      ▼             ▼
                   TERMINAL   FREEZE ARTIFACT
                                    │
                                    ▼
                                EXECUTION
```

---

## 4. The Freeze Boundary

The **Freeze Boundary** establishes cryptographic immutability prior to execution:
- Human approval is compiled into an immutable artifact sealed with `rja-c14n-v1-sha256`.
- Once frozen, all agents (Discovery, Evaluation, Planning, Orchestrator) and human reviewers have **zero mutable influence**.
- The v4.6.1 execution substrate receives **only** the verified, frozen artifact.
