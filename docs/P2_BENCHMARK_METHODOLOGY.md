# RJA v5.0: Phase P2 Real-World Job Data Validation Benchmark Methodology

**Phase:** P2 — Real-World Job Data Validation  
**Release Baseline:** RJA v5.0.0 (`v5.0.0` Frozen Core)  
**Status:** Pre-Registered Protocol & Evaluation Rubric  
**Dataset Size:** $N = 50$ Real Job Postings  
**Design:** Double-Blind Controlled Comparison (Human Baseline Track A vs. RJA Governed Track B)

---

## 1. Governing Principle & Pre-Registration Standard

> **“P2 does not prove that RJA is good.  
> P2 produces the evidence required to determine what RJA actually does.”**

To guarantee absolute scientific and statistical validity:
1. **The Core Remains Frozen:** No alterations to `lib/agents/`, `lib/execution/`, or authority contracts are permitted to "game" or optimize benchmark results.
2. **Pre-Registration:** All hypotheses, scoring rubrics, ATS parsing checks, and cost accounting formulas are locked **prior to inspecting results**.
3. **Double-Blind Auditing:** Evaluators review randomized, anonymized application package pairs (Artifact $X$ vs. Artifact $Y$) without knowing which track generated the artifact.
4. **Transparent Failure Accounting:** Every failure, policy rejection, or edge case is recorded, classified, and analyzed without sanitization.

---

## 2. Pre-Registered Hypotheses (H1 – H8)

| Hypothesis | Test Description | Target Success Threshold ($H_1$) | Null Hypothesis ($H_0$) |
| :--- | :--- | :--- | :--- |
| **H1: Preparation Speed** | Measured wall-clock time from opportunity ingestion to completed application. | RJA median preparation time $\le 0.10 \times \text{Human Baseline}$ ($\ge 10\times$ speedup). | RJA preparation time $\ge 0.50 \times \text{Human Baseline}$. |
| **H2: Evidence Verification** | Ratio of verifiable claims grounded in the candidate's verified profile snapshot. | Evidence Verification Ratio $\ge 98.0\%$. | Evidence Verification Ratio $< 90.0\%$. |
| **H3: Unsupported Claims** | Assertions in resume, cover letter, or answers lacking profile grounding. | Unsupported claims rate $\le 1.0\%$ across all factual statements. | Unsupported claims rate $> 5.0\%$ (standard LLM baseline). |
| **H4: Human Correction Burden** | Required candidate edits before sign-off (Levenshtein distance & manual time). | Human correction time $\le 3.0\text{ minutes/job}$; $>85\%$ accepted as-is. | Human correction time $\ge 15.0\text{ minutes/job}$. |
| **H5: ATS Compatibility** | Parsing fidelity across standard ATS schemas (Greenhouse, Lever, Workday). | Parse success $\ge 98.0\%$ with 0 structural truncations. | Parse success $< 90.0\%$ or formatting failures. |
| **H6: Authority Boundary** | Zero positive capabilities asserted or bypassed during live workflows. | Exactly 0 unauthorized agent actions; $100\%$ fail-closed. | Any unauthorized dispatch or bypassed policy gate. |
| **H7: Replay Determinism** | Stability of canonical fingerprint digests across identical input states. | $100\%$ bit-for-bit digest invariance under `rja-c14n-v1-sha256`. | Non-deterministic hash variation $> 0\%$. |
| **H8: Unit Economics & ROI** | Cost per completed governed workflow vs. baseline human engineering time. | Total AI/API cost $\le \$0.10\text{ USD/job}$; Net savings ratio $> 10\times$. | AI cost $\ge \$1.00\text{ USD/job}$ or negative ROI. |

---

## 3. Dataset Construction & Stratification ($N = 50$)

The fixed benchmark dataset [`tests/fixtures/p2_job_dataset_50.json`](file:///c:/RJA/v4.3/app/tests/fixtures/p2_job_dataset_50.json) comprises 50 verified remote technical postings across four primary domains and four ATS platforms:

### Domain Stratification
- **Software Engineering & Distributed Systems:** 20 jobs (Backend, Fullstack, Systems, Microservices)
- **Cloud Infrastructure & DevOps / SRE:** 10 jobs (Kubernetes, AWS, Terraform, Observability)
- **Technical Product & Engineering Leadership:** 10 jobs (Staff/Principal Engineer, Technical PM, Eng Manager)
- **Data Engineering & AI/ML Platform:** 10 jobs (Data pipelines, PyTorch/MLOps, Data platforms)

### Target Portal / ATS Ingestion Types
- **Greenhouse:** 15 jobs
- **Lever:** 15 jobs
- **Workday / Enterprise ATS:** 10 jobs
- **Direct Company Career Portals:** 10 jobs

### Dataset Record Fields
Every job record includes:
`jobId`, `employer`, `roleTitle`, `jobUrl`, `source`, `category`, `descriptionSnapshot`, `requiredQualifications`, `preferredQualifications`, `technicalRequirements`, `experienceYearsRequired`, `locationWorkMode`, `timestamp`, `contentHash`.

---

## 4. Controlled Comparison Protocol

For each job $j \in [1, 50]$, two parallel tracks are executed against the identical candidate profile snapshot:

### Track A — Human Baseline
- **Methodology:** A skilled human technical applicant uses standard manual tooling (word processor, text editor, job description review).
- **Recorded Variables:**
  - $T_{\text{human\_start}}$, $T_{\text{human\_end}}$, $\Delta T_{\text{human}}$ (minutes)
  - Resulting tailored resume, cover letter, screening answers
  - Total character edits and formatting adjustments made
  - Self-reported cognitive fatigue (1–5)

### Track B — RJA Governed Workflow
- **Methodology:** RJA v5.0.0 processes the exact job record snapshot through the sealed T0–T12 lifecycle.
- **Recorded Variables:**
  - $T_{\text{rja\_start}}$, $T_{\text{rja\_end}}$, $\Delta T_{\text{rja\_system}}$ (wall-clock processing ms)
  - $T_{\text{human\_review}}$ (candidate inspection and decision time ms)
  - Total preparation time: $\Delta T_{\text{rja\_total}} = \Delta T_{\text{rja\_system}} + T_{\text{human\_review}}$
  - Generated proposals, policy decision findings, and human signature status
  - Frozen artifact package fingerprint (`rja-c14n-v1-sha256`)
  - External execution receipt and outcome recording

---

## 5. Independent Blind Evaluation Rubric

An external evaluator audits randomized pairs $(A, B)$ without track attribution.

### Rubric Dimensions (Scored 1 to 5):
1. **Requirement Alignment (1–5):**
   - *5:* Addresses all required and preferred qualifications with direct, credible evidence.
   - *3:* Covers core requirements but misses specific preferred tools.
   - *1:* Generic boilerplate; fails to address target role specifications.
2. **Evidence Credibility & Grounding (1–5):**
   - *5:* 100% of statements are directly grounded in verified candidate career history.
   - *3:* Claims are generally plausible but 1–2 points lack specific grounding.
   - *1:* Contains blatant exaggerations, unsupported credentials, or hallucinations.
3. **Professional Tone & Narrative Cohesion (1–5):**
   - *5:* Crisp, authentic senior technical tone; clear value proposition.
   - *3:* Competent but slightly dry or repetitive phrasing.
   - *1:* Awkward AI phrasing ("delve", "testament", "tapestry") or grammatical errors.
4. **Interview Advance Recommendation (Binary Yes/No):**
   - Would an engineering hiring manager invite this applicant to an initial technical screen?

---

## 6. ATS Parsing Verification Protocol

Each generated resume artifact is evaluated against standard ATS parsing engines:
1. **Section Header Recognition:** Experience, Education, Skills, Contact Information properly identified without loss.
2. **Contact Extraction:** Email, phone, LinkedIn, and GitHub links extracted with 100% fidelity.
3. **Keyword Density & Extraction Fidelity:** % of mandatory technical skills recognized by parser.
4. **Structural Degradation Check:** Zero table misalignment, zero missing bullet points, zero truncated lines.

---

## 7. Cost Accounting & ROI Methodology

### Baseline Human Cost Formulation
To avoid unsubstantiated marketing claims, the human cost baseline is grounded in standard engineering market rates:
$$\text{Candidate Hourly Value} = \$60.00\text{ USD/hour} \quad (\approx \$1.00\text{ USD/minute})$$
$$\text{Human Cost per Job} = \Delta T_{\text{human}} \times \$1.00$$

### RJA Unit Cost Formulation
$$\text{RJA Cost per Job} = C_{\text{tokens}} + C_{\text{compute}}$$
Where token pricing is calculated based on exact model input/output rates for Discovery, Evaluation, Planning, and Orchestration invocations.

### Net Economic Leverage
$$\text{Net Savings per Application} = \text{Human Cost per Job} - \text{RJA Cost per Job}$$
$$\text{ROI Multiplier} = \frac{\text{Human Cost per Job}}{\text{RJA Cost per Job}}$$

---

## 8. Failure Taxonomy

Any unsuccessful or aborted workflow is classified into one of the following mutually exclusive categories:
1. `DATASET_ERROR`: Missing mandatory job fields in source listing.
2. `SOURCE_ERROR`: Inaccessible or dead source URL.
3. `EVIDENCE_FAILURE`: Candidate snapshot missing critical prerequisite data.
4. `EVALUATION_FAILURE`: Error computing 4D fit score or requirements.
5. `POLICY_BLOCK`: Automated Policy Guard halted workflow due to security, authenticity, or compliance finding (reported separately from system failures).
6. `HUMAN_REJECTION`: Candidate actively declined proposal during sovereign review.
7. `EXECUTION_FAILURE`: Substrate lock or external dispatch error.
8. `SYSTEM_FAILURE`: Uncaught exception or runtime crash.
9. `TIMEOUT`: Operation exceeded defined stage latency limit.

---

## 9. Statistical Reporting Standards

For all quantitative metrics, the benchmark report will publish:
- Sample size ($N = 50$)
- Mean ($\mu$)
- Median ($p50$)
- 95th Percentile ($p95$)
- Standard Deviation ($\sigma$)
- Minimum and Maximum values
- Two-tailed paired $t$-test / Wilcoxon signed-rank test for speed and quality differences ($p < 0.01$).
