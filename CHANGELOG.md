# Changelog

## 4.3.1 — Security Hardening & CI Reproducibility Baseline

- **Remediated Mammoth Dependency Vulnerability**: Upgraded `mammoth` to `1.13.0` to address GHSA-rmjr-87wv-gf87 directory traversal advisory with zero breaking changes.
- **Added Automated DOCX Security Regression Suite**: Added `tests/test_docx_mammoth_security.mjs` verifying valid extraction, malformed zip resilience, and hostile zip-slip path traversal sanitization as a permanent gate in `npm test`.
- **Zero-Vulnerability Audit Baseline**: Verified clean dependency tree with `npm audit` reporting 0 vulnerabilities.
- **Hardened CI Environment Configuration**: Configured deterministic environment defaults and secret overrides in `.github/workflows/ci.yml` and `.env.example`.
- **Created SECURITY.md Policy**: Formulated responsible disclosure procedures, secret vs. placeholder hierarchy principles, and historical audit log.

## 4.3.0 — Customer-Ready Launch Edition

- Rebuilt the authenticated workspace as a guided customer command center.
- Added first-run Pro onboarding/paywall with clear value framing.
- Added resume import UX for PDF, DOCX and TXT with review-before-save workflow.
- Added richer job intake cards and auditable source messaging.
- Added requirement-level fit intelligence presentation and score visualization.
- Added evidence-safe tailored resume presentation and cover-letter generation.
- Added interview coach dashboard with role-specific question cards.
- Added application pipeline counts and inline status updates.
- Added job/application history visibility.
- Added account settings with data export and explicit destructive-delete confirmation.
- Added responsive mobile/tablet navigation and customer-facing empty/loading/error states.
- Added v4.3 CI/deployment metadata and additive database migration for cover letters.
