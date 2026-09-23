import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { sameOrigin } from '../../../../lib/security';

export async function GET() {
  try {
    const user = await requireUser();
    const admin = supabaseAdmin();

    const { data: prof } = await admin
      .from('profiles')
      .select('structured_profile')
      .eq('id', user.id)
      .maybeSingle();

    const sp = prof?.structured_profile || {};
    const shortlisted_ids: string[] = Array.isArray(sp.shortlisted_jobs) ? sp.shortlisted_jobs : [];

    return NextResponse.json({ shortlisted_ids });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'SHORTLIST_FETCH_FAILED' },
      { status: e.message === 'UNAUTHENTICATED' ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!sameOrigin(req)) {
      return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
    }

    const body = await req.json();
    const jobId = String(body.job_id || '').trim();
    const action = body.action || 'toggle'; // 'toggle' | 'add' | 'remove'

    if (!jobId) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: prof } = await admin
      .from('profiles')
      .select('structured_profile')
      .eq('id', user.id)
      .maybeSingle();

    const sp = prof?.structured_profile || {};
    let shortlisted: string[] = Array.isArray(sp.shortlisted_jobs) ? [...sp.shortlisted_jobs] : [];

    let isShortlisted = false;
    const exists = shortlisted.includes(jobId);

    if (action === 'add' || (action === 'toggle' && !exists)) {
      if (!exists) shortlisted.push(jobId);
      isShortlisted = true;
    } else if (action === 'remove' || (action === 'toggle' && exists)) {
      shortlisted = shortlisted.filter((id) => id !== jobId);
      isShortlisted = false;
    }

    const updatedProfile = {
      ...sp,
      shortlisted_jobs: shortlisted,
    };

    await admin
      .from('profiles')
      .update({
        structured_profile: updatedProfile,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      job_id: jobId,
      is_shortlisted: isShortlisted,
      shortlisted_ids: shortlisted,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'SHORTLIST_UPDATE_FAILED' },
      { status: e.message === 'UNAUTHENTICATED' ? 401 : 500 }
    );
  }
}
