'use client';

import { useState, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const messageParam = searchParams.get('message');
  const errorParam = searchParams.get('error');

  const getNoticeMessage = () => {
    if (messageParam === 'password_updated') {
      return 'Password updated successfully. Please sign in with your new password.';
    }
    return null;
  };

  const getUrlError = () => {
    if (errorParam === 'auth_callback_error') {
      return 'The recovery or authentication link is invalid or has expired.';
    }
    if (errorParam === 'auth_config_missing') {
      return 'Authentication configuration is missing. Please contact support.';
    }
    return null;
  };

  const go = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErr('');
    if (!email.trim() || !password) {
      setErr('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const s = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await s.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErr(error.message);
      } else {
        router.push('/dashboard');
      }
    } catch {
      setErr('An unexpected login error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const notice = getNoticeMessage();
  const urlError = getUrlError();

  return (
    <main className="auth">
      <div className="card">
        <b>
          RJA<span>•</span>
        </b>
        <h1>Welcome back</h1>
        <p>Continue your application workflow.</p>

        {notice && (
          <div className="notice" style={{ borderColor: '#2e4d41', background: '#0e1a17', color: '#9af5cf' }}>
            {notice}
          </div>
        )}

        {urlError && <div className="error">{urlError}</div>}
        {err && <div className="error">{err}</div>}

        <form onSubmit={go} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            disabled={loading}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
            <a
              href="/forgot-password"
              style={{ fontSize: '11px', color: '#849198', textDecoration: 'none' }}
            >
              Forgot password?
            </a>
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <a href="/signup" style={{ textAlign: 'center', marginTop: '10px' }}>
          Create an account
        </a>
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense
      fallback={
        <main className="auth">
          <div className="card">
            <b>
              RJA<span>•</span>
            </b>
            <h1>Welcome back</h1>
            <p>Loading sign in...</p>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
