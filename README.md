# Remote Job Accelerator v4.3

A deployment-grade AI career workspace: **resume evidence → job → fit intelligence → evidence-safe tailored resume → interview rehearsal → application pipeline**.

## Production hardening
- Supabase Auth + RLS + server-only service role
- Gumroad entitlement lifecycle + idempotent webhook
- Durable Postgres rate limiting
- PDF/DOCX/TXT resume extraction with size/type controls
- SSRF-resistant job ingestion
- Same-origin checks + security headers/CSP/HSTS
- Server-only AI credentials and evidence-preservation prompts
- One-time extension OAuth exchange + short-lived credential
- Application ownership/status validation
- Data export + account deletion
- Health/readiness endpoint
- CI-ready typecheck/build/smoke test workflow

See `docs/LAUNCH.md` before production deployment.


## v4.3 Customer-Ready Launch Edition
- Guided evidence vault with PDF/DOCX/TXT import and review
- Pro paywall/onboarding experience
- Job history and richer opportunity ingestion UI
- Fit intelligence decision view
- Evidence-safe resume studio + cover-letter generation
- Interview rehearsal dashboard
- Application pipeline with inline stage updates
- Account settings, data export and explicit account deletion confirmation
- Responsive mobile/tablet UI and launch-grade empty/loading/error states
- Browser extension capture path retained and versioned 4.3
