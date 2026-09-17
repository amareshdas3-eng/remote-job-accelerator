import { NextResponse } from 'next/server';
import { requirePro } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { ai, safeJson } from '../../../../lib/ai';
import { rate } from '../../../../lib/rate';
import { sameOrigin } from '../../../../lib/security';

export async function POST(req: Request) {
  try {
    const u = await requirePro();
    if (!sameOrigin(req)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
    if (!rate('match:' + u.id)) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });

    const b = await req.json();
    const resume = String(b.resume || '').slice(0, 30000);
    const job = String(b.job || '').slice(0, 30000);
    if (!job || !resume) {
      return NextResponse.json({ error: 'Job and resume evidence are required.' }, { status: 400 });
    }

    const raw = await ai(
      'You are an evidence-first career analyst. Return ONLY valid JSON with keys score (0-100), verdict, strengths (array), gaps (array), actions (array), matched_requirements (array of {requirement,evidence,status}), truth_flags (array). Never invent candidate qualifications, employers, degrees, tools, metrics or outcomes. Distinguish explicit evidence from inference.',
      'Analyze this job against this resume.\nJOB:\n' + job + '\nRESUME EVIDENCE:\n' + resume
    );
    const result = safeJson(raw);
    const admin = supabaseAdmin();

    let finalJobId = b.job_id || null;

    if (b.job_id) {
      // Update the canonical job record
      await admin
        .from('jobs')
        .update({
          match: result,
          updated_at: new Date().toISOString(),
        })
        .eq('id', b.job_id)
        .eq('user_id', u.id);

      finalJobId = b.job_id;
    } else {
      // Create a new canonical job record if none was specified
      const { data: jobRow } = await admin
        .from('jobs')
        .insert({
          user_id: u.id,
          url: b.url || null,
          title: b.title || 'Target Role',
          company: b.company || 'Target Company',
          description: job,
          match: result,
        })
        .select()
        .single();

      finalJobId = jobRow?.id || null;
    }

    // Keep pipeline application record in sync
    if (finalJobId) {
      await admin
        .from('applications')
        .update({
          status: 'selected',
          updated_at: new Date().toISOString(),
        })
        .eq('job_id', finalJobId)
        .eq('user_id', u.id);
    }

    return NextResponse.json({
      ...result,
      job_id: finalJobId,
    });
  } catch (e: any) {
    const status = e.message === 'PRO_REQUIRED' ? 402 : e.message === 'UNAUTHENTICATED' ? 401 : 500;
    console.error('job_match_error', e);
    return NextResponse.json({ error: e.message || 'AI_MATCH_FAILED' }, { status });
  }
}
