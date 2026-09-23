# Remote Job Accelerator (RJA) v4.3 — Architecture Map

This document details the actual system architecture, data models, component dependencies, and integration topology of RJA v4.3 as audited directly from the repository and live Supabase deployment.

---

## 1. High-Level System Topology

```mermaid
graph TD
    User["User Browser / Client"]
    Ext["Chrome Extension (v4.3 Manifest V3)"]
    Next["Next.js 16.3.5 Server (App Router + Turbopack)"]
    Proxy["Next.js Proxy / Middleware (proxy.ts)"]
    
    subgraph "Next.js 16 Server Architecture"
        Proxy --> AuthCheck["Session Token Verification (@supabase/ssr)"]
        Proxy --> SecurityHeaders["Security Headers (CSP, HSTS, X-Frame)"]
        Next --> AppPages["App Pages (/, /login, /signup, /dashboard)"]
        Next --> API["REST API Handlers (/app/api/*)"]
    end
    
    subgraph "Data & Persistence Layer"
        SupaAuth["Supabase Auth (auth.users)"]
        SupaDB[("Supabase PostgreSQL (public)")]
        RLS["Row-Level Security (RLS Policies)"]
    end
    
    subgraph "External Providers & Services"
        Gemini["Google AI Studio / Interactions API (gemini-3.5-flash)"]
        Gumroad["Gumroad Billing & Webhooks"]
        GoogleOAuth["Google OAuth 2.0 (Extension Auth)"]
        PostHog["PostHog Analytics (posthog.ts)"]
        ExtSites["Target Job Sites (LinkedIn, Greenhouse, Lever)"]
    end

    User -->|HTTP/HTTPS| Proxy
    Ext -->|Bearer JWT (15m)| API
    Ext -->|OAuth Flow| GoogleOAuth
    API -->|Service Role / Admin| SupaDB
    API -->|SSR Session| SupaAuth
    API -->|Failover Cascade| Gemini
    API -->|Ingest Fetch| ExtSites
    Gumroad -->|Ping Webhook (HMAC Secret)| API
    API -->|Telemetry Events| PostHog
```

---

## 2. Frontend Component Hierarchy & State Flow

```mermaid
graph TD
    Dashboard["Dashboard.tsx (Canonical State Container)"]
    
    subgraph "Dashboard Primary Views (MAIN_STEPS)"
        Step1["StructuredProfile.tsx (Step: Profile)"]
        Step2["JobDiscovery.tsx (Step: Job Discovery)"]
        Step3["UnifiedJobWorkspace.tsx (Step: Job Workspace)"]
        Step4["KanbanTracker.tsx (Step: Pipeline & Apply)"]
    end
    
    subgraph "UnifiedJobWorkspace Subtabs (WORKSPACE_TABS)"
        Sub1["Overview (Readiness Checklist + Job Description)"]
        Sub2["Match & Signals (Fit Score + Gap Analysis)"]
        Sub3["AtsResumeStudio.tsx (100% ATS Resume + TXT/MD/PDF Export)"]
        Sub4["ATS QC Engine (6-Point Truth & Compliance Audit)"]
        Sub5["Cover Letter & Pitch (Formal Letter + Direct Email Pitch)"]
        Sub6["InterviewSimulator.tsx (STAR Coach + Real-time Feedback)"]
        Sub7["Application Package (Executive Asset Compilation)"]
    end

    subgraph "Supporting & Disconnected Components"
        OppBar["OpportunityWorkspace.tsx (Active Job Switcher)"]
        Analytics["AnalyticsOverview.tsx (Velocity & Conversion)"]
        Orphan1["ActiveJobWorkspace.tsx (ORPHANED / UNUSED)"]
        Orphan2["OutreachEngine.tsx (DISCONNECTED FROM DASHBOARD UI)"]
    end

    Dashboard --> OppBar
    Dashboard --> Step1
    Dashboard --> Step2
    Dashboard --> Step3
    Dashboard --> Step4
    Step3 --> Sub1
    Step3 --> Sub2
    Step3 --> Sub3
    Step3 --> Sub4
    Step3 --> Sub5
    Step3 --> Sub6
    Step3 --> Sub7
    Step4 --> Analytics
```

### State Management & The Canonical `job_id` Backbone
1. **Root State Container**: `components/Dashboard.tsx` maintains:
   - `resume`: Raw string containing candidate master evidence text.
   - `jobs`: Array of `SavedJob` records retrieved from Supabase `jobs` table via `/api/workflow`.
   - `activeJobId`: UUID of the current selected canonical job.
   - `activeJob`: Memoized derive: `jobs.find(j => j.id === activeJobId) || jobs[0]`.
   - `apps`: Array of `Application` records from `/api/applications`.
   - `interviews`: Array of interview plans from `/api/workflow`.
2. **State Propagation**:
   - Every downstream workspace subtab (Match, Tailor, Cover, Interview, Package) binds to `activeJob.id`.
   - Updates mutate the in-memory `jobs` state array: `setJobs(prev => prev.map(x => x.id === activeJob.id ? { ...x, [feature]: result } : x))`.
3. **Identified State Vulnerability**:
   - When a user uploads a resume via `uploadFile(file)` in `Dashboard.tsx:147`, it executes `setResume(j.text)`. Because `/api/resume/upload` returns `{ saved: true, filename, characters }` and NOT `text`, in-memory `resume` state is corrupted to `undefined`.

---

## 3. Database Entity-Relationship Diagram (PostgreSQL)

```mermaid
erDiagram
    USERS ||--|| PROFILES : "has one"
    USERS ||--o{ JOBS : "owns"
    USERS ||--o{ INTERVIEWS : "owns"
    USERS ||--o{ APPLICATIONS : "tracks"
    USERS ||--o{ EXTENSION_OAUTH_CODES : "authorizes"
    JOBS ||--o{ INTERVIEWS : "linked to"
    JOBS ||--o{ APPLICATIONS : "linked to"
    ENTITLEMENTS ||--o{ WEBHOOK_EVENTS : "activated by"

    USERS {
        uuid id PK
        string email
        timestamptz created_at
    }

    PROFILES {
        uuid id PK,FK "references auth.users(id)"
        text resume_text "Raw candidate evidence string"
        text full_name "Currently null in active DB"
        text headline "Currently null in active DB"
        text resume_filename
        text resume_mime
        timestamptz updated_at
    }

    ENTITLEMENTS {
        uuid id PK
        string email "Unique with product"
        string product "remote-job-complete"
        string status "active / inactive"
        timestamptz expires_at
        string source "gumroad"
        timestamptz updated_at
    }

    JOBS {
        uuid id PK
        uuid user_id FK "references auth.users(id)"
        text url "Original posting URL"
        text title "Job title"
        text company "Employer name"
        text description "Job description body"
        jsonb match "Fit score, strengths, gaps, actions"
        jsonb tailored_resume "ATS resume sections, skills, audit"
        jsonb cover_letter "Formal letter, pitch, why_company"
        text company_website
        text application_url
        text remote_status "Default: 100% Remote"
        text location
        text salary
        text employment_type
        text source
        text posted_date
        timestamptz discovered_date
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    INTERVIEWS {
        uuid id PK
        uuid user_id FK "references auth.users(id)"
        uuid job_id FK "references jobs(id)"
        jsonb plan "Questions, rubric, prep plan"
        timestamptz created_at
    }

    APPLICATIONS {
        uuid id PK
        uuid user_id FK "references auth.users(id)"
        uuid job_id FK "references jobs(id)"
        string company
        string role
        string job_url
        string status "selected, in_progress, ready_to_apply, applied, follow_up, screening, interview, offer, closed"
        text notes
        string route "website / email / linkedin"
        jsonb route_details
        timestamptz applied_at
        string next_action
        timestamptz next_action_date
        timestamptz created_at
        timestamptz updated_at
    }

    RATE_LIMITS {
        text key PK "e.g. match:user_id"
        timestamptz bucket PK "1-minute sliding window"
        integer count
    }

    EXTENSION_OAUTH_CODES {
        text code_hash PK "SHA-256 of 32-byte one-time code"
        uuid user_id FK "references auth.users(id)"
        timestamptz expires_at "2 minute expiry"
        timestamptz created_at
    }

    WEBHOOK_EVENTS {
        uuid id PK
        text event_id UK "Gumroad sale_id for idempotency"
        text event_type "gumroad_ping"
        jsonb payload
        timestamptz created_at
    }
```

---

## 4. AI Orchestration & Failover Cascade

```mermaid
sequenceDiagram
    autonumber
    participant UI as Dashboard Client
    participant Route as AI Route (/api/ai/*)
    participant Rate as Postgres RPC (consume_rate_limit)
    participant AI as lib/ai.ts Engine
    participant Cache as In-Memory LRU Cache
    participant GeminiInt as Google Interactions API
    participant GeminiGen as Google generateContent API
    participant DB as Supabase DB

    UI->>Route: POST payload (job, resume, job_id)
    Route->>Route: Verify Origin (sameOrigin) & requirePro()
    Route->>Rate: Check Rate Limit (sliding window)
    Route->>AI: ai(systemPrompt, userPrompt)
    AI->>Cache: Check SHA-256(system:::user)
    alt Cache Hit (<10m TTL)
        Cache-->>AI: Return cached string (0ms, 0 quota)
    else Cache Miss
        loop Max 3 Attempts across Model Pool
            AI->>AI: Throttle (min 250ms spacing)
            AI->>GeminiInt: POST v1beta/interactions (gemini-3.5-flash)
            alt Success (200 OK)
                GeminiInt-->>AI: Return generated content
            else 429 Rate Limit / 503 Overloaded
                AI->>GeminiGen: Fallback to generateContent endpoint
                alt Success (200 OK)
                    GeminiGen-->>AI: Return generated content
                else Failure
                    AI->>AI: Cascade to next model (gemini-3.5-flash-lite, 3.8-flash, 3.6-flash)
                end
            end
        end
        AI->>Cache: Store response in LRU Cache
    end
    AI-->>Route: Return raw response string
    Route->>Route: safeJson(raw) (strips markdown codeblocks & conversational text)
    Route->>DB: UPDATE jobs SET [field] = result WHERE id = job_id
    Route-->>UI: 200 OK (Structured JSON)
```

---

## 5. Job Ingestion Architecture: Current State vs Production Target

### Current Audited Flow (Simulated / Stubs)
```mermaid
graph LR
    Curated["CURATED_REMOTE_JOBS<br/>(6 Hardcoded Jobs in discover/route.ts)"] -->|Filtered by keyword| DiscoveryUI["JobDiscovery.tsx UI"]
    SingleURL["Paste URL<br/>(LinkedIn, Greenhouse, Lever)"] -->|Regex strip HTML| IngestAPI["/api/jobs/ingest<br/>(Returns raw text only)"]
    IngestAPI -->|Does not extract title/company| Fallback["Sets 'Target Remote Role' & 'Target Company'"]
    Adapter["/api/jobs/import"] -->|Hardcoded Stub| MockMsg["'Adapter ready for extraction'"]
```

### Production Target Flow (Automated Pipeline)
```mermaid
graph TD
    subgraph "External Sources"
        Feed1["Remote Job RSS Feeds (RemoteOK, WeWorkRemotely, Arbeitnow, Jobspresso)"]
        Feed2["Public ATS APIs (Greenhouse & Lever Board APIs)"]
        Feed3["Chrome Extension DOM Extractor (Active Tab Parser)"]
        Feed4["Direct User URL Paste"]
    end

    subgraph "Ingestion & Normalization Worker"
        Worker["Job Ingestion & Normalization Worker (Cron / Ingestion Engine)"]
        Extractor["LLM / Schema Extractor (Title, Company, Remote Status, Salary, Requirements)"]
        Deduper["Deduplication Engine (Company + Normalized Title + Location Hash)"]
    end

    subgraph "Database Store"
        MasterJobs[("global_jobs (Master Catalog)")]
        UserJobs[("jobs (User Saved & Selected Canonical Records)")]
    end

    Feed1 --> Worker
    Feed2 --> Worker
    Feed3 --> Extractor
    Feed4 --> Extractor
    Worker --> Extractor
    Extractor --> Deduper
    Deduper --> MasterJobs
    MasterJobs -->|Curated Match| UserJobs
```

---

## 6. Security Boundaries & Protection Topology

1. **Edge / Middleware Boundary (`proxy.ts`)**:
   - CSP: Restricts scripts to `'self' 'unsafe-inline' 'unsafe-eval'`; connect-src to `'self' https://*.supabase.co https://*.posthog.com`.
   - Framing: `X-Frame-Options: DENY`, `frame-ancestors 'none'` (Clickjacking immunity).
   - HSTS: `max-age=31536000; includeSubDomains; preload` on HTTPS.
   - Permissions-Policy: Disables camera, microphone, geolocation.
2. **Origin Validation (`lib/security.ts:sameOrigin`)**:
   - Compares request `origin` against `NEXT_PUBLIC_APP_URL`.
   - Enforced on all mutation routes (`/api/ai/*`, `/api/jobs/select`, `/api/applications`, `/api/resume/upload`, `/api/account/delete`).
3. **Database RLS & Isolation (`api/schema.sql`)**:
   - `profiles`: `auth.uid() = id`
   - `jobs`: `auth.uid() = user_id`
   - `interviews`: `auth.uid() = user_id`
   - `applications`: `auth.uid() = user_id`
   - `rate_limits` & `extension_oauth_codes`: Service-role only.
4. **Known Hardening Gaps (To be remediated)**:
   - Live Supabase instance missing table grants for `service_role` on `jobs`, `interviews`, `rate_limits`, `extension_oauth_codes`.
   - `sameOrigin` returns `true` if `origin` header is absent, allowing server-to-server or non-browser tooling without origin.
   - Rate limit calls missing `await` in several AI routes, bypassing rate limiting.
