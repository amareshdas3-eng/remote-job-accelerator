import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../lib/logger';

function getSafeRedirectPath(candidate: string | null, fallback: string = '/dashboard'): string {
  if (!candidate) return fallback;
  // Prevent protocol-relative redirects: candidate must start with '/' and not '//' or '/\'
  if (candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.startsWith('/\\')) {
    try {
      const parsed = new URL(candidate, 'http://localhost');
      if (parsed.origin === 'http://localhost') {
        return parsed.pathname + parsed.search + parsed.hash;
      }
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const rawNext = searchParams.get('next') ?? (type === 'recovery' ? '/reset-password' : '/dashboard');

  const safeNext = getSafeRedirectPath(rawNext, '/dashboard');
  const targetUrl = new URL(safeNext, origin);

  let response = NextResponse.redirect(targetUrl);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    logger.error('Supabase credentials missing during auth callback');
    return NextResponse.redirect(new URL('/login?error=auth_config_missing', origin));
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(targetUrl);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      logger.info('Auth callback session code exchanged successfully');
      return response;
    }
    logger.warn('Auth code exchange error', { error: error.message });
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });
    if (!error) {
      logger.info('Auth callback OTP verified successfully', { type });
      return response;
    }
    logger.warn('Auth OTP verification error', { error: error.message });
  }

  // If no auth parameters provided or verification failed
  logger.warn('Auth callback incomplete or invalid parameters');
  return NextResponse.redirect(new URL('/login?error=auth_callback_error', origin));
}
