-- Migration: 20260920000001_add_structured_profile.sql
-- Description: Add structured_profile JSONB column to profiles with GIN indexing and RLS grants

-- 1. Add structured_profile JSONB column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS structured_profile JSONB;

-- 2. Performance GIN index for JSONB attribute querying and containment searches
CREATE INDEX IF NOT EXISTS idx_profiles_structured_profile ON public.profiles USING gin (structured_profile);

-- 3. Explicit permissions (fixes PostgreSQL 42501 for authenticated users and service_role)
GRANT ALL ON TABLE public.profiles TO postgres, service_role, authenticated;

-- 4. Verify RLS policy for profile owner
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile owner" ON public.profiles;
CREATE POLICY "profile owner" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
