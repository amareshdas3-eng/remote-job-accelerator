create extension if not exists pgcrypto;
create table if not exists profiles(id uuid primary key references auth.users(id) on delete cascade,resume_text text,full_name text,headline text,resume_filename text,resume_mime text,updated_at timestamptz default now());
create table if not exists entitlements(id uuid primary key default gen_random_uuid(),email text not null,product text not null,status text not null default 'active',expires_at timestamptz,source text,updated_at timestamptz default now(),unique(email,product));
create table if not exists jobs(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,url text,title text,company text,description text,match jsonb,tailored_resume jsonb,cover_letter jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
create table if not exists interviews(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,job_id uuid references jobs(id) on delete set null,plan jsonb,created_at timestamptz default now());
create table if not exists applications(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,job_id uuid references jobs(id) on delete set null,company text,role text,job_url text,status text default 'saved',notes text,created_at timestamptz default now(),updated_at timestamptz default now());
create table if not exists webhook_events(id uuid primary key default gen_random_uuid(),event_id text unique,event_type text,payload jsonb,created_at timestamptz default now());
create table if not exists rate_limits(key text not null,bucket timestamptz not null,count integer not null default 0,primary key(key,bucket));
create table if not exists extension_oauth_codes(code_hash text primary key,user_id uuid not null references auth.users(id) on delete cascade,expires_at timestamptz not null,created_at timestamptz default now());
alter table profiles enable row level security; alter table jobs enable row level security; alter table interviews enable row level security; alter table applications enable row level security; alter table rate_limits enable row level security; alter table extension_oauth_codes enable row level security; alter table entitlements enable row level security; alter table webhook_events enable row level security;
drop policy if exists "profile owner" on profiles; create policy "profile owner" on profiles for all using(auth.uid()=id) with check(auth.uid()=id);
drop policy if exists "job owner" on jobs; create policy "job owner" on jobs for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "interview owner" on interviews; create policy "interview owner" on interviews for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "application owner" on applications; create policy "application owner" on applications for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "entitlement owner read" on entitlements; create policy "entitlement owner read" on entitlements for select using(lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists "webhook events service role only" on webhook_events; create policy "webhook events service role only" on webhook_events for all using(auth.role() = 'service_role') with check(auth.role() = 'service_role');
create or replace function consume_rate_limit(p_key text,p_bucket timestamptz,p_limit integer) returns boolean language plpgsql security definer set search_path=public as $$ declare n integer; begin insert into rate_limits(key,bucket,count) values(p_key,p_bucket,1) on conflict(key,bucket) do update set count=rate_limits.count+1 returning count into n; delete from rate_limits where bucket < now()-interval '1 day'; return n <= p_limit; end $$;
revoke all on function consume_rate_limit(text,timestamptz,integer) from public; grant execute on function consume_rate_limit(text,timestamptz,integer) to service_role;

-- v4.3 additive migration for existing deployments
alter table jobs add column if not exists cover_letter jsonb;
alter table jobs add column if not exists company_website text;
alter table jobs add column if not exists application_url text;
alter table jobs add column if not exists remote_status text default '100% Remote';
alter table jobs add column if not exists location text;
alter table jobs add column if not exists salary text;
alter table jobs add column if not exists employment_type text;
alter table jobs add column if not exists source text;
alter table jobs add column if not exists posted_date text;
alter table jobs add column if not exists discovered_date timestamptz default now();
alter table jobs add column if not exists metadata jsonb;

alter table applications add column if not exists route text;
alter table applications add column if not exists route_details jsonb;
alter table applications add column if not exists applied_at timestamptz;
alter table applications add column if not exists next_action text;
alter table applications add column if not exists next_action_date timestamptz;

-- v4.3.1 structured profile & discovery catalog migration
alter table profiles add column if not exists structured_profile jsonb;

create table if not exists discovered_jobs (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  title text not null,
  company text not null,
  url text not null,
  description text,
  salary text,
  location text default '100% Remote',
  remote_status text default '100% Remote',
  source text not null,
  category text default 'general',
  skills text[] default '{}',
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table discovered_jobs enable row level security;
drop policy if exists "discovered jobs readable by all authenticated" on discovered_jobs;
create policy "discovered jobs readable by all authenticated" on discovered_jobs for select using(true);

-- Explicit table permissions (fixes PostgreSQL 42501 permission denied)
grant all on table public.profiles to postgres, service_role, authenticated;
grant all on table public.jobs to postgres, service_role, authenticated;
grant all on table public.interviews to postgres, service_role, authenticated;
grant all on table public.applications to postgres, service_role, authenticated;
grant all on table public.entitlements to postgres, service_role, authenticated;
grant all on table public.webhook_events to postgres, service_role, authenticated;
grant all on table public.discovered_jobs to postgres, service_role, authenticated, anon;
grant all on table public.rate_limits to postgres, service_role;
grant all on table public.extension_oauth_codes to postgres, service_role;

-- Performance indexes for production scale
create index if not exists idx_jobs_user_id on public.jobs(user_id);
create index if not exists idx_applications_user_id on public.applications(user_id);
create index if not exists idx_applications_job_id on public.applications(job_id);
create unique index if not exists idx_uniq_user_job_application on public.applications(user_id, job_id) where job_id is not null;
create index if not exists idx_interviews_user_id on public.interviews(user_id);
create index if not exists idx_interviews_job_id on public.interviews(job_id);
create index if not exists idx_entitlements_email on public.entitlements(email);
create index if not exists idx_discovered_jobs_cat on public.discovered_jobs(category);
create index if not exists idx_discovered_jobs_pub on public.discovered_jobs(published_at desc);
create index if not exists idx_profiles_structured_profile on public.profiles using gin(structured_profile);
