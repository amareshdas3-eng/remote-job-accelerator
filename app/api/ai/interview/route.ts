import { NextResponse } from 'next/server';
import { requirePro } from '../../../../lib/auth';
import { rate } from '../../../../lib/rate';
import { supabaseAdmin } from '../../../../lib/supabase';
import { ai, safeJson } from '../../../../lib/ai';
import { sameOrigin } from '../../../../lib/security';

interface InterviewRequestBody {
  job?: string;
  resume?: string;
  job_id?: string;
}

export async function POST(req: Request) {
  try {
    // 1. Same-origin security check (fail fast before hitting DB/auth services)
    if (!sameOrigin(req)) {
      return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
    }

    // 2. Authentication & subscription tier check
    const user = await requirePro();

    // 3. Rate limiting (10 requests window per user)
    const withinRateLimit = await rate(`interview:${user.id}`, 10);
    if (!withinRateLimit) {
      return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
    }

    // 4. Safe body extraction & validation
    let body: InterviewRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON_BODY' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
    }

    const job = String(body.job || '').slice(0, 30000);
    const resume = String(body.resume || '').slice(0, 30000);

    // Validate that job is non-empty and not just whitespace
    if (!job.trim()) {
      return NextResponse.json({ error: 'Job is required.' }, { status: 400 });
    }

    // 5. Generate AI interview plan
    const systemPrompt =
      'You are a rigorous interview coach. Return ONLY valid JSON with keys role, questions (array), evaluation_rubric (array), preparation_plan (array), candidate_evidence (array), truth_warnings (array). Questions must be grounded in the role. Never invent candidate experience.';
    const userPrompt = `Create an interview plan for this role.\n\nJOB:\n${job}\n\nCANDIDATE EVIDENCE:\n${resume}`;

    const raw = await ai(systemPrompt, userPrompt);
    const result = safeJson(raw);

    // 6. Optionally persist interview plan in Supabase
    if (body.job_id) {
      const { error: dbError } = await supabaseAdmin()
        .from('interviews')
        .insert({
          user_id: user.id,
          job_id: body.job_id,
          plan: result,
        });

      if (dbError) {
        console.error('Failed to save interview plan to database:', dbError);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    const message = error?.message;

    if (message === 'PRO_REQUIRED') {
      return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 402 });
    }

    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    console.error('Unhandled interview route error:', error);
    return NextResponse.json({ error: 'INTERVIEW_FAILED' }, { status: 500 });
  }
}
