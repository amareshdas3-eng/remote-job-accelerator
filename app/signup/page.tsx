'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { getStoredAttribution } from '../../lib/attribution';
import { trackEvent } from '../../lib/analytics';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const r = useRouter();

  const go = async () => {
    trackEvent('signup_started', { email });
    const s = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const attribution = getStoredAttribution();
    const { data, error } = await s.auth.signUp({
      email,
      password,
      options: {
        data: {
          attribution: attribution || { channel: 'direct', capturedAt: new Date().toISOString() },
        },
      },
    });

    if (error) {
      setMsg(error.message);
    } else {
      trackEvent('signup_completed', {
        email,
        channel: attribution?.channel || 'direct',
        source: attribution?.source,
        campaign: attribution?.campaign,
      });
      setMsg(data.session ? 'Account created.' : 'Check your email to confirm your account.');
      if (data.session) r.push('/dashboard');
    }
  };

  return (
    <main className="auth">
      <div className="card">
        <b>
          RJA<span>•</span>
        </b>
        <h1>Build your workspace</h1>
        <p>Free account first. Pro features activate after purchase.</p>
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {msg && <div className="notice">{msg}</div>}
        <button className="btn" onClick={go}>
          Create account
        </button>
        <a href="/login">Already have an account?</a>
      </div>
    </main>
  );
}
