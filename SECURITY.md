# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 4.3.x   | :white_check_mark: |
| < 4.3.0 | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability in Remote Job Automator (RJA), please report it responsibly:

- **Email**: security@remotejobaccelerator.com (or repository maintainers)
- **Response SLA**: Initial acknowledgment within 48 hours; assessment and remediation plan within 5 business days.
- **Disclosure Policy**: Please do not publish security vulnerabilities publicly in GitHub Issues or pull requests until a coordinated fix and release has been issued.

---

## Security Architecture & Principles

### 1. Secret vs. Placeholder Hierarchy
- **Production Secrets**: Sensitive keys (`SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `GUMROAD_PING_SECRET`, `EXTENSION_JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are injected strictly via secure runtime environments (e.g. Netlify Production, GitHub Actions Encrypted Secrets, or local untracked `.env.local`).
- **CI / Static Test Placeholders**: Continuous integration runs use non-functional placeholder values (`dummy_*`) with fallback logic so builds and tests validate contract correctness deterministically without exposing production credentials.

### 2. Multi-Tenant Data Isolation (Row Level Security)
- Supabase Row Level Security (RLS) is enabled and enforced across all database tables.
- All client-side requests operate under verified user sessions (`auth.uid()`).
- Elevated administrative actions require explicit backend route authentication (`requireUser()`) and service-role scoping.

### 3. File Upload & Document Parsing Safeguards
- **File Constraints**: Maximum upload size capped at 5 MB; MIME types restricted to PDF, DOCX, and TXT.
- **In-Memory Buffer Processing**: Document streams are extracted in-memory; file buffers are never persisted or executed in arbitrary filesystem paths.
- **Sanitization**: Extracted resume text is stripped of null bytes (`\u0000`) and length-capped to 50,000 characters before downstream processing.

---

## Remediated Vulnerabilities & Audit Log

### 1. Mammoth Directory Traversal (GHSA-rmjr-87wv-gf87)
- **Component**: `mammoth` (DOCX parsing library used in [`app/api/resume/upload/route.ts`](app/api/resume/upload/route.ts))
- **Vulnerability**: Moderate severity path traversal advisory in `mammoth <= 1.10.0`.
- **Remediation**:
  - Pinned `mammoth: 1.13.0` in [`package.json`](package.json) and synced lockfile without destructive forced overrides.
  - Added dedicated permanent regression test suite [`tests/test_docx_mammoth_security.mjs`](tests/test_docx_mammoth_security.mjs) verifying:
    1. Valid DOCX text extraction.
    2. Malformed and truncated archive rejection.
    3. Hostile zip-slip directory traversal path resistance (`../../etc/passwd`).
    4. Resume upload pipeline integration.
- **Verification**: `npm audit` reports **0 vulnerabilities**; all 11 CI test suites pass.
- **Baseline Commit**: `3e21cba` (merged into `main` via `ebc9a53`, tagged `v4.3.0-security-baseline`).
