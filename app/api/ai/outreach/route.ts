import { NextResponse } from 'next/server';
import { requirePro } from '../../../../lib/auth';
import { ai, safeJson } from '../../../../lib/ai';
import { rate } from '../../../../lib/rate';
import { sameOrigin } from '../../../../lib/security';
import { supabaseAdmin } from '../../../../lib/supabase';

const OUTREACH_SYSTEM_PROMPT = `You are an elite executive career agent specializing in remote job search networking, cold outreach, and hiring manager conversions.
Generate highly personalized, professional, and respectful networking messages for the candidate reaching out about a remote role.

RULES:
1. Respect platform limits: The LinkedIn invite note MUST be strictly under 300 characters.
2. Ground all value propositions in the candidate's verified evidence. Do not invent achievements.
3. Keep tone authentic, confident, succinct, and low-friction (never beg; offer relevant value and a casual chat).

RETURN ONLY VALID JSON matching this schema:
{
  "target_role": string,
  "target_company": string,
  "recipient_type": string,
  "linkedin_invite": string (under 300 characters, concise connection request),
  "inmail_or_email_pitch": {
    "subject_lines": string[],
    "body": string (150-200 words max, hook, 2 relevant proof points, clear low-friction call to action)
  },
  "follow_up_nudge": string (Short polite follow-up for 5 days later),
  "strategy_tips": string[]
}`;

export async function POST(req: Request) {
  try {
    const u = await requirePro();
    if (!sameOrigin(req)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
    if (!(await rate('outreach:' + u.id))) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });

    const b = await req.json();
    const role = String(b.job_title || 'Target Role').slice(0, 200);
    const company = String(b.company || 'Target Company').slice(0, 200);
    const job = String(b.job_description || '').slice(0, 10000);
    const resume = String(b.resume || '').slice(0, 10000);
    const recipient = String(b.recipient_type || 'recruiter'); // 'recruiter' | 'hiring_manager' | 'peer'
    const jobId = b.job_id ? String(b.job_id).trim() : null;

    const raw = await ai(
      OUTREACH_SYSTEM_PROMPT,
      `TARGET ROLE: ${role}\nCOMPANY: ${company}\nRECIPIENT TYPE: ${recipient}\n\nJOB DESCRIPTION:\n${job}\n\nCANDIDATE EVIDENCE:\n${resume}`
    );

    const result = safeJson(raw);

    if (jobId) {
      const admin = supabaseAdmin();
      const { data: existingJob } = await admin
        .from('jobs')
        .select('metadata')
        .eq('id', jobId)
        .eq('user_id', u.id)
        .maybeSingle();

      const existingMeta = existingJob?.metadata && typeof existingJob.metadata === 'object' ? existingJob.metadata : {};
      const updatedMeta = { ...existingMeta, outreach: result };

      await admin
        .from('jobs')
        .update({ metadata: updatedMeta, updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('user_id', u.id);
    }

    return NextResponse.json(result);
  } catch (e: any) {
    const status = e.message === 'PRO_REQUIRED' ? 402 : e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return NextResponse.json(
      { error: e.message === 'PRO_REQUIRED' ? 'PRO_REQUIRED' : 'OUTREACH_GENERATION_FAILED' },
      { status }
    );
  }
}
