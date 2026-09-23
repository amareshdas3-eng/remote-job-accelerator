-- RJA v4.3 Phase 6 Production Hardening & SaaS Readiness Migration
-- 1. Multi-User Security & RLS Enforcement on Entitlements and Webhook Events
-- 2. Concurrency Protection & Application Idempotency Unique Constraint

-- Enable RLS on entitlements and webhook_events
alter table if exists public.entitlements enable row level security;
alter table if exists public.webhook_events enable row level security;

-- Policy: Authenticated users can only view their own active entitlement by email
drop policy if exists "entitlement owner read" on public.entitlements;
create policy "entitlement owner read" on public.entitlements
  for select using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Policy: Webhook events restricted exclusively to service_role
drop policy if exists "webhook events service role only" on public.webhook_events;
create policy "webhook events service role only" on public.webhook_events
  for all using (
    auth.role() = 'service_role'
  ) with check (
    auth.role() = 'service_role'
  );

-- Application Integrity: Ensure unique application per user and canonical job
-- Eliminates duplicate rows under concurrent requests or double-clicks
create unique index if not exists idx_uniq_user_job_application
  on public.applications(user_id, job_id)
  where job_id is not null;
