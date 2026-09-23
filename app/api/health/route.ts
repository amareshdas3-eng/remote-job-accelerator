import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabase';

export async function GET() {
  const dbConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const aiConfigured = !!process.env.AI_API_KEY;

  let authUser: { authenticated: boolean; email?: string } = { authenticated: false };

  try {
    const s = await supabaseServer();
    const { data: { user } } = await s.auth.getUser();
    if (user) {
      authUser = {
        authenticated: true,
        email: user.email,
      };
    }
  } catch {}

  return NextResponse.json({
    status: 'ok',
    version: '4.3.0',
    timestamp: new Date().toISOString(),
    services: {
      database: dbConfigured ? 'configured' : 'unconfigured',
      ai: aiConfigured ? 'configured' : 'unconfigured',
    },
    auth: authUser,
  }, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' }
  });
}