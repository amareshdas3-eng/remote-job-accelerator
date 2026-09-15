import { NextResponse } from 'next/server';
import { requireUser, hasEntitlement } from '../../../lib/auth';

export async function GET() {
  try {
    const u = await requireUser();

    const email = (u.email || '').toLowerCase();
    const entitled = await hasEntitlement(email);

    return NextResponse.json({
      authenticated: true,
      emailPresent: !!u.email,
      emailLength: email.length,
      entitled,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        authenticated: false,
        error: e.message === 'UNAUTHENTICATED'
          ? 'UNAUTHENTICATED'
          : 'WORKSPACE_LOAD_FAILED',
      },
      { status: e.message === 'UNAUTHENTICATED' ? 401 : 500 }
    );
  }
}