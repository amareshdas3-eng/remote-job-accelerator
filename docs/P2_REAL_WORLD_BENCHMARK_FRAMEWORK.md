# RJA v5.0: Phase P2 Real-World Job Data Validation Benchmark Framework

**Phase:** P2 — Real-World Job Data Validation  
**Release Baseline:** RJA v5.0.0 (`v5.0.0` Frozen Core)  
**Methodology:** Controlled Empirical Testing vs. Human & Autonomous Baselines  
**Status:** Protocol Approved & Ready for Field Execution

---

## 1. Scientific Protocol: Hypotheses vs. Assumptions

In accordance with release engineering integrity:
> **High-performance multipliers (e.g., “15–20× faster”, “zero hallucination”) are hypotheses to be experimentally validated, not unmeasured marketing assertions.**

Phase P2 defines the rigorous experimental protocol to test, measure, and prove these hypotheses against live job data across a defined candidate population.

```
                    SAME TARGET JOB
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
      HUMAN BASELINE             RJA v5.0 GOVERNED
      (Manual Tailoring)         (Agent Assist + Human Gate)
             │                         │
             ▼                         ▼
      Final Application         Final Application
      Package (Resume/Cover)    Package (Frozen Artifact)
             │                         │
             └────────────┬────────────┘
                          ▼
              INDEPENDENT BLIND AUDIT
        (Hiring Managers / ATS Evaluators)
```

---

## 2. The Experimental Benchmark Matrix

| Dimension | Null Hypothesis ($H_0$) | Experimental Hypothesis ($H_1$) | Target Metric | Measurement Instrument |
| :--- | :--- | :--- | :---: | :--- |
| **Preparation Speed** | RJA requires comparable time to manual writing. | RJA reduces application preparation time by $\ge 10\times$. | $\text{Minutes per Application}$ | Wall-clock telemetry from discovery to signed package. |
| **Evidence Accuracy** | RJA fabricates unverified candidate claims at LLM baseline rate ($>5\%$). | RJA enforces $100\%$ evidence grounding against snapshot. | $\frac{\text{Verified Claims}}{\text{Total Claims}}$ | Automated fact-checking against cryptographic Evidence Snapshot. |
| **Job Relevance** | Generic resumes match role requirements equally well. | 4D fit evaluation produces $>30\%$ higher technical alignment. | $\text{Fit Alignment Score}$ | Blind technical assessment by hiring domain experts. |
| **Human Workload** | Candidates must heavily rewrite agent drafts ($>50\%$ text changes). | Candidates accept $>85\%$ of agent drafting without modification. | $\text{Human Override Rate}$ | Character Levenshtein distance between agent proposal and approved artifact. |
| **Hallucination Rate** | RJA outputs contain unsupported credentials or tenure. | Unsupported factual claims are strictly zero ($0.0\%$). | $\text{Unsupported Claim Count}$ | Independent verification against candidate background record. |
| **ATS Compatibility** | Rich formatting degrades parsing accuracy in enterprise ATS. | Canonical formatting produces $\ge 98\%$ clean ATS parsing. | $\text{ATS Parse Fidelity Rate}$ | Test ingestion into Workday, Greenhouse, and Lever parsers. |
| **Unit Cost** | Multi-agent coordination exceeds cost of manual job board tools. | Total AI/API cost per completed application is $\le \$0.10$ USD. | $\text{USD per Application}$ | API token accounting per completed lifecycle. |

---

## 3. The 50-Job Benchmark Cohort Specification

The Phase P2 experiment will evaluate a curated, diverse sample of **50 verified remote technical and product roles**:

1. **Role Distribution:**
   - 20 Software Engineering & Distributed Systems roles
   - 10 Cloud Infrastructure & DevOps roles
   - 10 Product Management & Technical Project Management roles
   - 10 Data Engineering & AI/ML roles
2. **ATS Portal Diversity:**
   - Greenhouse (15 roles)
   - Lever (15 roles)
   - Workday / Enterprise ATS (10 roles)
   - Custom Company Career Portals (10 roles)
3. **Candidate Cohort:**
   - 5 diverse senior technical profiles with verified credentials, public GitHub portfolios, and employment records.

---

## 4. Evaluation Criteria & Scoring Rules

### A. Independent Blind Evaluation
Evaluators (3 experienced technical recruiters and engineering hiring managers) receive pairs of application packages for each role without knowing which was produced manually and which was produced by RJA:
1. **Fit Precision (1–5 scale):** Does the cover letter and resume highlight the exact qualifications demanded by the job?
2. **Credibility & Tone (1–5 scale):** Does the application read like an authentic senior engineer or generic boilerplate?
3. **Interview Likelihood (Binary):** Would you advance this candidate to an initial screening call?

### B. Safety & Truthfulness Audit
Any single instance of an invented skill, exaggerated years of experience, or fabricated credential constitutes a **critical safety failure** ($0$ score).

---

## 5. Conclusion & Expected Output

Upon completion of the 50-job benchmark:
1. All empirical data will be compiled into `docs/P2_BENCHMARK_RESULTS_REPORT.md`.
2. Initial hypotheses will be formally validated or adjusted with exact confidence intervals ($p < 0.01$).
3. Real-world insights will feed directly into Phase P3 Human UX refinement.
