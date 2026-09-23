# RJA v4.3 — Supabase Authentication & Recovery Configuration Guide

This document defines the exact production and local Supabase Authentication settings required for **Remote Job Accelerator (RJA) v4.3** Password Recovery and Authentication Lifecycle.

---

## 1. Project Reference & Environment

| Property | Value | Status |
| :--- | :--- | :--- |
| **Supabase Project Ref** | `ozqfvrklhcaktgfrqrjy` | `Already configured` |
| **Supabase Project URL** | `https://ozqfvrklhcaktgfrqrjy.supabase.co` | `Already configured` |
| **Auth Provider** | Supabase GoTrue / Auth | `Already configured` |
| **Client Library** | `@supabase/ssr` (v0.7.0) | `Already configured` |
| **Cookie Architecture** | `sb-ozqfvrklhcaktgfrqrjy-auth-token` (Chunked HTTP-only cookies) | `Already configured` |

---

## 2. Supabase Dashboard URL Configuration

Navigate to: **Supabase Dashboard → Authentication → URL Configuration**

### Site URL
* **Development / Local**: `http://localhost:3000`
* **Production**: `https://<your-production-domain>.com`
* **Status**: `Needs verification` (Ensure your active environment URL is set as Site URL)

### Redirect URLs (Allowed Callback URLs)
Ensure the following exact redirect URLs are whitelisted in **Authentication → URL Configuration → Redirect URLs**:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/confirm
http://localhost:3000/reset-password
https://<your-production-domain>.com/auth/callback
https://<your-production-domain>.com/auth/confirm
https://<your-production-domain>.com/reset-password
```

* **Status**: `Needs configuration` (Add any production deployment domains or staging domains)

---

## 3. Email & Template Configuration

Navigate to: **Supabase Dashboard → Authentication → Email Templates**

### Password Reset Email Template
* **Subject**: `Reset Your RJA Password`
* **Body / Action URL**:
  ```html
  <h2>Reset Password</h2>
  <p>Follow this link to reset the password for your Remote Job Accelerator account:</p>
  <p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset Password</a></p>
  ```
  *(Alternatively, if using code exchange: `{{ .ConfirmationURL }}` redirecting to `{{ .SiteURL }}/auth/callback?next=/reset-password`)*
* **Status**: `Needs configuration` (Verify action link format matches the `/auth/callback` endpoint)

### Email Confirmation (Signup)
* **Body / Action URL**:
  ```html
  <h2>Confirm your signup</h2>
  <p>Follow this link to confirm your user account:</p>
  <p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
  ```
* **Status**: `Already configured`

---

## 4. SMTP / Email Provider Configuration

Navigate to: **Supabase Dashboard → Project Settings → Authentication → SMTP Settings**

| Setting | Recommendation | Current Status | Notes |
| :--- | :--- | :--- | :--- |
| **Provider** | Custom SMTP (Resend / SendGrid / AWS SES) | `Needs verification` | Default Supabase email has strict rate limits (30 emails/hr) intended only for development. |
| **Sender Email** | `auth@<your-domain>.com` | `Needs configuration` | Must match your verified domain DNS records (SPF, DKIM, DMARC). |
| **Sender Name** | `Remote Job Accelerator` | `Needs configuration` | Friendly sender name for candidate trust. |
| **Rate Limiting** | Handled natively by Supabase Auth (GoTrue) | `Already configured` | Supabase blocks repetitive password reset attempts with HTTP 429. |

---

## 5. Security & Session Settings

Navigate to: **Supabase Dashboard → Authentication → Configuration**

| Setting | Recommended Value | Status |
| :--- | :--- | :--- |
| **Enable Email Signup** | `ON` | `Already configured` |
| **Enable Password Sign-in** | `ON` | `Already configured` |
| **Confirm Email** | `OFF` (or `ON` if strict verification required) | `Already configured` |
| **Secure Password Hash** | `Argon2id` / `Bcrypt` (Supabase Default) | `Already configured` |
| **JWT Expiry Limit** | `3600 seconds` (1 hour) | `Already configured` |
| **Refresh Token Expiry** | `2592000 seconds` (30 days) | `Already configured` |
| **Detect Session in URL** | `Enabled` in `@supabase/ssr` browser client | `Already configured` |

---

## 6. Summary Checklist for DevOps / Admins

- [ ] Confirm `Site URL` in Supabase matches your primary hosting URL.
- [ ] Add `http://localhost:3000/auth/callback` and production callback URLs to `Redirect URLs`.
- [ ] Confirm Password Reset email template redirects to `/auth/callback?next=/reset-password`.
- [ ] For production traffic, configure custom SMTP (e.g. Resend) to eliminate default rate limits.
