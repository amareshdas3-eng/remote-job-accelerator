# RJA v4.3 — PHASE 3: PRODUCTION REAL JOB INGESTION & JOB DISCOVERY REPORT

**Remote Job Accelerator (RJA) v4.3**  
**Engineering Checkpoint: Phase 3 Completion**  
**Execution Mode:** Production-Grade Architecture & Verification  
**Database Backend:** Supabase Postgres (`discovered_jobs`, `jobs`, `applications`)

---

## 1. Executive Summary

Phase 3 transitions RJA v4.3 from static curated job lists into an enterprise-grade, multi-source, live job ingestion and discovery engine. The application now integrates:
1. **Public ATS & Remote Job Source Adapters**: Greenhouse API, Lever Postings API, RemoteOK API, and universal Schema.org (`JobPosting` JSON-LD & OpenGraph) web page parsers.
2. **Deterministic Deduplication & Canonical Normalization**: Automatic tracking parameter stripping (`utm_*`, `gh_src`, `ref`), canonical URL normalization, cryptographic/composite deduplication keys (`source:company:job_id`), role categorization (`electrical`, `project_management`, `ai_operations`, etc.), skill extraction, and remote status categorization.
3. **Database-Backed Persistence & Idempotency**: Live upsert into Supabase `discovered_jobs` on unique `external_id`, preventing duplicate entries while refreshing active job data.
4. **Live Job Discovery with Candidate Fit Scoring**: `/api/jobs/discover` queries Supabase `discovered_jobs` with server-side pagination, multi-criteria filtering (`category`, `q`, `remote_only`), dynamic match preview calculation against candidate evidence profile, and fallback auto-seeding.
5. **Seamless Pipeline Conversion (`discovered_jobs` → `jobs` → `applications`)**: Both `/api/jobs/select` and `/api/jobs/import` support 1-click promotion of discovered jobs into the user's canonical application workspace and 8-stage pipeline CRM.

All changes passed full TypeScript typechecking (`0` errors), Next.js production build (`32/32` routes compiled), smoke/phase tests (`12/12` specification phases, `7/7` smoke checks), Phase 1 profile persistence (`8/8`), Schema E2E (`9/9`), Phase 2 authentication lifecycle (`11/11`), AI resilience (`4/4`), and Phase 3 job ingestion verification (`9/9`).

---

## 2. Architecture & File Matrix

```
lib/jobs/
├── types.ts                # TypeScript interfaces: NormalizedJob, JobCategory, IngestionResult, JobSourceAdapter
├── dedup.ts                # canonicalizeUrl (strips query/tracking tags) & generateDeduplicationKey
├── normalizer.ts           # stripHtml, detectCategory, extractSkills, normalizeRemoteStatus, normalizeJobRecord
├── adapters/
│   ├── greenhouse.ts       # Greenhouse Board API & single posting URL parser
│   ├── lever.ts            # Lever Postings API & single posting URL parser
│   ├── remoteok.ts         # RemoteOK Public Feed parser
│   └── jsonld.ts           # Universal Schema.org/JobPosting JSON-LD & OG metadata extractor
└── ingestion.ts            # persistDiscoveredJobs (upsert into discovered_jobs), ingestJobsFromSource, ingestJobFromUrl

app/api/jobs/
├── discover/route.ts       # Live Supabase discovery endpoint with pagination, filters, candidate fit scoring
├── ingest/route.ts         # Multi-source batch ingestion & scheduled sync runner
├── import/route.ts         # Single URL live job importer with auto-promotion to canonical jobs
└── select/route.ts         # 1-Click promotion linking discovered_jobs -> jobs -> applications

components/dashboard/
└── JobDiscovery.tsx        # Modern UI with live feed sync, category filtering, search, pagination & 1-click select
```

---

## 3. Ingestion & Normalization Specifications

### A. URL Canonicalization & Deduplication
To ensure job postings from disparate boards, email campaigns, and aggregators do not create duplicate records:
* Tracking query parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gh_src`, `ref`, `source`, `fbclid`, `gclid`) are stripped.
* Hashes/fragments and trailing slashes are removed.
* Hostnames are lowercased.
* Deduplication keys follow the deterministic format:
  ```text
  <source>:<company-slug>:<external-job-id>
  ```
  Example: `greenhouse:automattic-inc:12345` or `url:<md5-hash-of-canonical-url>`

### B. Normalization Pipeline
Raw inputs from REST endpoints, JSON-LD blocks, or HTML are converted into `NormalizedJob`:
* **Title & Company**: Stripped of formatting noise and standardized.
* **Remote Status**: Evaluated into `'remote' | 'hybrid' | 'onsite'` based on title, description, and location metadata.
* **Category Auto-Detection**: Classified into `'electrical'`, `'project_management'`, `'ai_operations'`, `'industrial'`, `'software'`, or `'other'`.
* **Skills Dictionary Extraction**: Matched against candidate domain skills (Electrical Engineering, Erection & Commissioning, SCADA, AI Agentic Ops, Cloud, etc.).
* **Salary Normalization**: Min, max, currency, and period mapped into a clean string display (`$150,000 - $180,000/yr`).

### C. Live Database Persistence (`discovered_jobs`)
* The Supabase `discovered_jobs` table stores:
  `id`, `external_id` (UNIQUE), `title`, `company`, `url`, `description`, `salary`, `location`, `remote_status`, `source`, `category`, `skills`, `published_at`, `created_at`.
* Ingestion utilizes `upsert(..., { onConflict: 'external_id' })` to guarantee idempotency.

---

## 4. API Endpoints Upgraded

### 1. `GET /api/jobs/discover`
* **Parameters**:
  * `page` (default: 1)
  * `limit` (default: 10, max: 50)
  * `category` (all, electrical, project_management, ai_operations, industrial, software, other)
  * `q` (free-text search on title, company, description, skills)
  * `remote_only` (boolean flag)
* **Response**:
  ```json
  {
    "jobs": [
      {
        "id": "ea81138b-7d8f-49f0-9cb5-6c1abd5a4fc6",
        "title": "Remote Grid Automation Lead",
        "company": "NextGen Power Systems",
        "url": "https://careers.nextgenpower.com/jobs/98214",
        "location": "Remote - US / Global",
        "remote_status": "remote",
        "category": "electrical",
        "skills": ["Electrical Engineering", "SCADA", "Substation"],
        "match_preview": {
          "score": 88,
          "strengths": ["Matched domain profile skills: Electrical Engineering", "Direct fit for project & technical execution"],
          "growth_areas": ["Align ATS keywords for specific proprietary software"]
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "total_pages": 5,
      "has_more": true
    },
    "source": "discovered_jobs_database"
  }
  ```
* **Auto-Seed Fallback**: If the database contains zero discovered jobs, the endpoint automatically seeds high-yield curated roles into `discovered_jobs` so users never see an empty state.

### 2. `POST /api/jobs/ingest`
* **Feed Sync Mode**: `{ "source": "all" | "greenhouse" | "lever" | "remoteok", "limit": 20 }`
  Syncs active public feeds and returns batch statistics (`inserted`, `updated`, `skipped`, `errors`).
* **Single URL Mode**: `{ "url": "https://...", "text": "optional job text" }`
  Directly ingests a job posting URL using the appropriate adapter.

### 3. `POST /api/jobs/import`
* Allows authenticated users to import any external job URL or pasted posting.
* Automatically ingests into `discovered_jobs`, promotes it to a canonical `jobs` record, creates an initial `applications` dossier, and returns the canonical `job_id` ready for the Unified Job Workspace.

### 4. `POST /api/jobs/select`
* Enhanced with `discovered_job_id` support: looks up the record from `discovered_jobs` to automatically populate canonical `jobs` and link the initial `applications` record in a single atomic transaction.

---

## 5. Verification & Test Evidence

### A. Phase 3 Test Suite (`tests/phase3_job_ingestion.mjs`)
```text
================================================================
  RJA v4.3 — PHASE 3 JOB INGESTION & DISCOVERY TEST SUITE       
================================================================

[Test 1] Verifying URL canonicalization and deduplication keys...
✓ Deduplication key verified: greenhouse:automattic-inc:12345

[Test 2] Verifying canonical job normalization & categorization...
✓ Skills extracted: [Electrical Engineering, Erection & Commissioning, Project Management]
✓ Normalization pipeline produced compliant NormalizedJob record

[Test 3] Verifying Schema.org JobPosting JSON-LD extractor...
✓ JSON-LD extracted: "Staff Cloud Systems Architect" at CloudScale Global ($190000 – $230000 YEAR)

[Test 4] Testing live Supabase discovered_jobs persistence...
✓ Successfully persisted 2 jobs into Supabase discovered_jobs
✓ Idempotent upsert verified: zero duplicate entries created on re-ingestion

[Test 5] Querying persisted jobs from discovered_jobs...
✓ Retrieved persisted discovered job: ea81138b-7d8f-49f0-9cb5-6c1abd5a4fc6 (Remote Grid Automation Lead)

[Test 6] Verifying conversion of discovered_job into canonical user job...
✓ Canonical job created from discovered job: dbf5123a-bad2-4513-9060-e560503cb451
✓ Application pipeline dossier established: 9858fd29-002d-4cab-b145-a0d5dd854b68 (status: selected)

[Test 7] Verifying live job adapters and URL parsers...
✓ Job source adapters verified with clean null fallbacks on unapproved URLs

[Test 8] Verifying ingestJobFromUrl with custom text fallback...
✓ Ingested custom job successfully: "Senior Propulsion Test Director" at SpaceX Infrastructure

[Test 9] Cleaning up test records...
✓ Teardown complete: All temporary records removed.

================================================================
  ALL 9 PHASE 3 INGESTION & DISCOVERY CHECKS PASSED!            
================================================================
```

### B. Full Verification & Regression Baseline
| Suite | Scope | Result |
|---|---|---|
| `npm run typecheck` | Full repository TypeScript verification | **0 errors** |
| `npm test` | Smoke checks (7/7) & 12 specification phases | **19/19 passed** |
| `phase3_job_ingestion.mjs` | Adapters, JSON-LD, deduplication, live Supabase upsert/read/promote | **9/9 passed** |
| `phase2_auth_lifecycle.mjs` | Auth recovery, token hash, password reset, RLS isolation | **11/11 passed** |
| `phase1_profile_persistence.mjs` | Structured profile JSONB CRUD, validation, AI injection | **8/8 passed** |
| `schema_reconciliation_e2e.mjs` | Canonical job `application_url`, pipeline `applied_at` & route | **9/9 passed** |
| `ai_resilience.mjs` | Gemini multi-model failover, 429 backoff, safeJson parser | **4/4 passed** |
| `npm run build` | Next.js Turbopack production compilation (32 routes) | **32/32 routes compiled** |

---

## 6. Conclusion

Phase 3 is 100% complete and fully verified. The Remote Job Accelerator (RJA) v4.3 now possesses a world-class, production-ready job ingestion, deduplication, discovery, and conversion pipeline backed by live Supabase storage.
