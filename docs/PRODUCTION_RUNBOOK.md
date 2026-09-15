# RJA 4.3 Production Runbook

## Required services
- Next.js 15 / Node 20 deployment (Vercel is supported by default configuration).
- Supabase project with `api/schema.sql` applied.
- AI provider compatible with the server-side OpenAI-style chat endpoint.
- Gumroad product + ping webhook.
- Optional PostHog analytics.

## Go-live sequence
1. Create a fresh Supabase production project.
2. Run the complete `api/schema.sql` in the SQL editor.
3. Set all variables from `.env.example` in the deployment platform.
4. Deploy and verify `/api/health`.
5. Create a real RJA test account and verify email/password authentication.
6. Test resume import with PDF, DOCX and TXT; confirm extracted text is editable before saving.
7. Test a public LinkedIn, Greenhouse and Lever job URL in staging.
8. Test AI match → tailor → cover letter → interview.
9. Test application creation and status changes.
10. Complete a real Gumroad purchase and confirm entitlement activation using the same email.
11. Test refund/cancellation handling in a controlled test event.
12. Configure the extension's production app URL and test OAuth exchange.
13. Run `npm run typecheck`, `npm test`, and `npm run build` in CI.

## Security gates
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `AI_API_KEY` to browser code.
- Rotate all production secrets before launch if they were ever committed or shared.
- Keep the Gumroad webhook secret private.
- Use a production Supabase project with backups and appropriate retention.
- Review CSP and third-party domains before adding analytics or embeds.
- Treat account deletion as destructive and verify it in staging first.

## Known hardening boundary
The v4.3 package uses durable Supabase rate limiting. If the rate-limit RPC is unavailable, the current compatibility behavior is availability-first. For a high-abuse public launch, change sensitive AI endpoints to fail closed and/or add Redis/Upstash as a secondary limiter.
