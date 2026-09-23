-- Migration: 20260921000001_rja_schema_reconciliation.sql
-- Description: Complete schema reconciliation for Remote Job Accelerator (RJA) v4.3
-- Adds missing columns on jobs, applications, profiles, discovered_jobs table, RLS policies, and grants.

-- ============================================================================
-- 1. JOBS TABLE RECONCILIATION
-- ============================================================================
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cover_letter JSONB;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_website TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS application_url TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS remote_status TEXT DEFAULT '100% Remote';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS salary TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS employment_type TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS posted_date TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS discovered_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ============================================================================
-- 2. APPLICATIONS TABLE RECONCILIATION
-- ============================================================================
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS route TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS route_details JSONB;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS next_action_date TIMESTAMPTZ;

-- ============================================================================
-- 3. PROFILES TABLE RECONCILIATION
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS structured_profile JSONB;

-- ============================================================================
-- 4. DISCOVERED JOBS TABLE (CANONICAL CATALOG)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.discovered_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  salary TEXT,
  location TEXT DEFAULT '100% Remote',
  remote_status TEXT DEFAULT '100% Remote',
  source TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  skills TEXT[] DEFAULT '{}',
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile owner" ON public.profiles;
CREATE POLICY "profile owner" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "job owner" ON public.jobs;
CREATE POLICY "job owner" ON public.jobs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "interview owner" ON public.interviews;
CREATE POLICY "interview owner" ON public.interviews FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "application owner" ON public.applications;
CREATE POLICY "application owner" ON public.applications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "discovered jobs readable by all authenticated" ON public.discovered_jobs;
CREATE POLICY "discovered jobs readable by all authenticated" ON public.discovered_jobs FOR SELECT USING (true);

-- ============================================================================
-- 6. EXPLICIT GRANTS (Fixes PostgreSQL 42501 permission denied)
-- ============================================================================
GRANT ALL ON TABLE public.profiles TO postgres, service_role, authenticated;
GRANT ALL ON TABLE public.jobs TO postgres, service_role, authenticated;
GRANT ALL ON TABLE public.interviews TO postgres, service_role, authenticated;
GRANT ALL ON TABLE public.applications TO postgres, service_role, authenticated;
GRANT ALL ON TABLE public.entitlements TO postgres, service_role, authenticated;
GRANT ALL ON TABLE public.webhook_events TO postgres, service_role, authenticated;
GRANT ALL ON TABLE public.discovered_jobs TO postgres, service_role, authenticated, anon;

-- ============================================================================
-- 7. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON public.interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job_id ON public.interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_discovered_jobs_cat ON public.discovered_jobs(category);
CREATE INDEX IF NOT EXISTS idx_discovered_jobs_pub ON public.discovered_jobs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_structured_profile ON public.profiles USING gin(structured_profile);

-- ============================================================================
-- 8. RELOAD POSTGREST SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';
