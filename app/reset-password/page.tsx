'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState('');

  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session) {
            setHasValidSession(true);
          } else {
            // Also check for hash fragment token in case of direct URL redirect
            const hash = typeof window !== 'undefined' ? window.location.hash : '';
            if (!hash || !hash.includes('access_token')) {
              setHasValidSession(false);
            }
          }
          setCheckingSession(false);
        }
      } catch {
        if (mounted) {
          setHasValidSession(false);
          setCheckingSession(false);
        }
      }
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (session) {
        setHasValidSession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Password requirements
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumOrSpecial = /[\d\W]/.test(password);
  const isMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLength && hasUpper && hasLower && hasNumOrSpecial && isMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');

    if (!isFormValid) {
      if (!hasMinLength) {
        setErr('Password must be at least 8 characters long.');
        return;
      }
      if (!hasUpper || !hasLower) {
        setErr('Password must contain both uppercase and lowercase letters.');
        return;
      }
      if (!hasNumOrSpecial) {
        setErr('Password must contain at least one number or special character.');
        return;
      }
      if (!isMatch) {
        setErr('Passwords do not match.');
        return;
      }
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        // Human-friendly error messages without exposing internals
        if (error.message.includes('expired') || error.message.includes('token')) {
          setErr('Your recovery session has expired. Please request a new password reset link.');
          setHasValidSession(false);
        } else if (error.status === 429) {
          setErr('Too many requests. Please wait a moment and try again.');
        } else {
          setErr(error.message || 'Unable to update password. Please try again.');
        }
      } else {
        setSuccess(true);
      }
    } catch {
      setErr('A network error occurred while updating your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="auth">
        <div className="card" style={{ textAlign: 'center' }}>
          <b>
            RJA<span>•</span>
          </b>
          <h1>Verifying link...</h1>
          <p>Validating your secure password recovery session.</p>
        </div>
      </main>
    );
  }

  if (!hasValidSession && !success) {
    return (
      <main className="auth">
        <div className="card">
          <b>
            RJA<span>•</span>
          </b>
          <h1>Link expired or invalid</h1>
          <p>This password reset link is invalid, expired, or has already been used.</p>
          <div className="error" style={{ marginBottom: '8px' }}>
            Recovery sessions are time-limited for security.
          </div>
          <a href="/forgot-password" className="btn" style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}>
            Request new reset link
          </a>
          <a href="/login">Return to sign in</a>
        </div>
      </main>
    );
  }

  return (
    <main className="auth">
      <div className="card">
        <b>
          RJA<span>•</span>
        </b>
        <h1>Set new password</h1>
        <p>Enter and confirm your new account password.</p>

        {success ? (
          <>
            <div className="notice" style={{ borderColor: '#2e4d41', background: '#0e1a17', color: '#9af5cf' }}>
              Your password has been updated successfully!
            </div>
            <p style={{ color: '#718087', fontSize: '11px', lineHeight: '1.5' }}>
              You are now securely signed in with your new credentials.
            </p>
            <button
              className="btn"
              onClick={() => router.push('/dashboard')}
              style={{ width: '100%', marginTop: '8px' }}
            >
              Continue to Dashboard
            </button>
            <a
              href="/login?message=password_updated"
              style={{ textAlign: 'center', display: 'block', fontSize: '10px', color: '#849198', marginTop: '6px' }}
            >
              Or sign in again
            </a>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                required
                style={{ width: '100%', paddingRight: '60px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 0,
                  color: '#718087',
                  fontSize: '11px',
                  padding: '4px 6px',
                  cursor: 'pointer',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                required
                style={{ width: '100%', paddingRight: '60px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 0,
                  color: '#718087',
                  fontSize: '11px',
                  padding: '4px 6px',
                  cursor: 'pointer',
                }}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Password requirements checklist */}
            <div
              style={{
                background: '#080d11',
                border: '1px solid #1c282e',
                borderRadius: '9px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '10px',
              }}
            >
              <div style={{ color: hasMinLength ? '#9af5cf' : '#647179' }}>
                {hasMinLength ? '✓' : '○'} At least 8 characters
              </div>
              <div style={{ color: hasUpper ? '#9af5cf' : '#647179' }}>
                {hasUpper ? '✓' : '○'} At least 1 uppercase letter
              </div>
              <div style={{ color: hasLower ? '#9af5cf' : '#647179' }}>
                {hasLower ? '✓' : '○'} At least 1 lowercase letter
              </div>
              <div style={{ color: hasNumOrSpecial ? '#9af5cf' : '#647179' }}>
                {hasNumOrSpecial ? '✓' : '○'} At least 1 number or special character
              </div>
              {confirmPassword.length > 0 && (
                <div style={{ color: isMatch ? '#9af5cf' : '#f1aaaa' }}>
                  {isMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                </div>
              )}
            </div>

            {err && <div className="error">{err}</div>}

            <button type="submit" className="btn" disabled={loading || !isFormValid}>
              {loading ? 'Updating password...' : 'Update password'}
            </button>

            <a href="/login">Cancel and return to sign in</a>
          </form>
        )}
      </div>
    </main>
  );
}
