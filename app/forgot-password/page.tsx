'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErr('Please enter your email address.');
      return;
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErr('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
      });

      // Anti-enumeration protection:
      // Regardless of whether the user exists or if Supabase returns rate-limited/user not found,
      // we do not leak user existence. Only genuine system/network errors or rate limits are noted safely.
      if (error && error.status === 429) {
        setErr('Too many requests. Please wait a few minutes before trying again.');
      } else {
        setSubmitted(true);
      }
    } catch {
      setErr('An unexpected network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth">
      <div className="card">
        <b>
          RJA<span>•</span>
        </b>
        <h1>Reset password</h1>
        <p>Enter your account email to receive recovery instructions.</p>

        {submitted ? (
          <>
            <div className="notice" style={{ borderColor: '#2e4d41', background: '#0e1a17', color: '#9af5cf' }}>
              If an account exists for {email.trim()}, you will receive password-reset instructions shortly.
            </div>
            <p style={{ color: '#718087', fontSize: '11px', lineHeight: '1.5' }}>
              Be sure to check your spam or junk folder if you do not see the email within a few minutes.
            </p>
            <a href="/login" className="btn" style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}>
              Return to sign in
            </a>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
            />

            {err && <div className="error">{err}</div>}

            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Sending instructions...' : 'Send reset link'}
            </button>

            <a href="/login">Back to sign in</a>
          </form>
        )}
      </div>
    </main>
  );
}
