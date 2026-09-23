# Supabase Structured Profile Persistence — RJA v4.3 Phase 1

This document specifies the architecture, data model, database schema, security rules, and client-server synchronization lifecycle for structured candidate profile persistence in Remote Job Accelerator (RJA) v4.3.

---

## 1. Architectural Overview

In RJA v4.3, the candidate's career evidence serves as the ground truth for all downstream AI engines (Job Match, ATS Resume Studio, Cover Letter Pitch, and STAR Interview Coach). Prior to Phase 1, career profile state was held in React memory with static defaults.

Phase 1 establishes durable, authenticated PostgreSQL persistence using Supabase:

```text
Candidate Input / Resume Upload
             ↓
Zod Validation & Bounds Checking (lib/profile.ts)
             ↓
Authenticated API Layer (/api/profile, /api/workflow, /api/resume/upload)
             ↓
Supabase PostgreSQL (profiles.structured_profile JSONB)
             ↓
Client Hydration across page reload, login/logout, multi-session
             ↓
Downstream AI Workspace Engines (Job Match, Tailor, Cover Letter, Interview)
```

---

## 2. Database Schema & Migration

### Canonical Schema (`api/schema.sql`)
```sql
-- Profiles table definition
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_text TEXT,
  full_name TEXT,
  headline TEXT,
  resume_filename TEXT,
  resume_mime TEXT,
  structured_profile JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance GIN index for JSONB attribute traversal
CREATE INDEX IF NOT EXISTS idx_profiles_structured_profile ON public.profiles USING gin (structured_profile);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile owner" ON public.profiles;
CREATE POLICY "profile owner" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Explicit table permissions
GRANT ALL ON TABLE public.profiles TO postgres, service_role, authenticated;
```

### Migration History
- `supabase/migrations/20260920000001_add_structured_profile.sql`: Additive migration script adding `structured_profile JSONB`, GIN index, table grants, and RLS policies.

---

## 3. Structured Profile Data Model

The data model reflects the exact fields utilized across the RJA dashboard and discovery engine:

```typescript
export interface StructuredProfileData {
  full_name?: string;
  headline?: string;
  years_experience?: number | string;
  professional_summary?: string;
  target_roles?: string[];
  target_industries?: string[];
  remote_preferences?: {
    remote_only?: boolean;
    timezones?: string[];
    preferred_contract?: string;
    target_compensation?: string;
  };
  technical_domains?: string[];
  technical_skills?: string[];
  pm_leadership_skills?: string[];
  ai_capabilities?: string[];
  employers?: Array<{
    company: string;
    role: string;
    period: string;
    location?: string;
    key_achievement?: string;
  }>;
  education?: Array<{
    degree: string;
    institution: string;
    year?: string;
  }>;
  certifications?: string[];
  raw_evidence?: string;
}
```

---

## 4. Server-Side Validation (`lib/profile.ts`)

Validation is enforced using Zod before any database write:
- **Object Integrity**: Non-null JSON object structure.
- **Type Safety**: Enforces strings, string arrays, numbers, and nested sub-schemas (`RemotePreferencesSchema`, `EmployerSchema`, `EducationSchema`).
- **Payload Limits**: Maximum payload size capped at 500 KB (`MAX_PROFILE_PAYLOAD_BYTES`) to prevent denial-of-service or database bloat.
- **Data Version Safety**: Payloads lacking all career signals are rejected with HTTP 400 to prevent accidental overwrite or erasure of valid existing profiles.

---

## 5. API Contracts

### 5.1 `GET /api/profile`
- **Authentication**: Required (`requireUser()` cookie session).
- **Authorization**: Accesses only `id = auth.uid()`.
- **Response**:
  ```json
  {
    "profile": { "id": "...", "full_name": "...", "resume_text": "..." },
    "structured_profile": { ... }
  }
  ```

### 5.2 `PUT /api/profile` / `PATCH /api/profile`
- **Authentication**: Required (`requireUser()`).
- **Origin Guard**: `sameOrigin(req)`.
- **Payload**: `{ "structured_profile": { ... }, "resume_text"?: "..." }`
- **Behavior**: Safe upsert (INSERT if row does not exist, UPDATE if row exists). Never allows user A to modify user B.

### 5.3 `GET /api/workflow`
- **Behavior**: Loads entitled status, full candidate profile (including `structured_profile`), canonical jobs, pipeline applications, and interview plans in a single consolidated round-trip.

---

## 6. Resilience & Fallback Protocol

If deployed against a Supabase environment where the PostgreSQL DDL has not yet been applied (PostgreSQL error `42703` / PostgREST `PGRST204`):
1. **Fallback Persistence**: The structured JSON is automatically encoded in a deterministic envelope (`<!-- RJA_STRUCTURED_PROFILE_V1:... -->`) inside `profiles.resume_text`.
2. **Transparent Retrieval**: `extractEmbeddedStructuredProfile` recovers the structured profile on read.
3. **Zero Data Loss**: Candidate experience, skills, and preferences are 100% preserved regardless of remote schema state.

---

## 7. Service-Role Isolation

- `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to trusted server-side code (`lib/supabase.ts`, `lib/auth.ts`, `app/api/*`).
- Browser clients strictly use `@supabase/ssr` `createBrowserClient` with public anon credentials and authenticated cookies.

---

## 8. Verification & Test Suite

Run the dedicated test suite:
```bash
node --env-file=.env.local tests/phase1_profile_persistence.mjs
```
The suite verifies:
1. Migration & schema consistency.
2. Zero service-role exposure in client bundles.
3. Zod schema validation & boundary defenses.
4. Non-destructive format & envelope serialization.
5. Live Supabase database upsert, read-back, and user isolation.
6. Failure safety (anti-data loss on malformed input).
7. AI route persisted profile consumption.
8. Dashboard & UI component hydration.
