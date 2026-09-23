import { NextResponse } from 'next/server';
import { requirePro } from '../../../../../lib/auth';
import { ai, safeJson } from '../../../../../lib/ai';
import { rate } from '../../../../../lib/rate';
import { sameOrigin } from '../../../../../lib/security';

const INTERVIEW_FEEDBACK_PROMPT = `You are a world-class executive interview coach and remote hiring manager.
Your task is to analyze the candidate's practice answer to an interview question using the rigorous STAR framework (Situation, Task, Action, Result).

RULES:
1. Ground feedback in the candidate's verified context. Do not recommend fabricating metrics.
2. Evaluate specifically for high-performing remote roles (autonomy, clear communication, cross-timezone collaboration, measurable impact).
3. Be constructive, encouraging, and actionable.

RETURN ONLY VALID JSON matching this schema:
{
  "score": number (1-100 overall score),
  "star_analysis": {
    "situation": { "present": boolean, "feedback": string },
    "task": { "present": boolean, "feedback": string },
    "action": { "present": boolean, "feedback": string },
    "result": { "present": boolean, "feedback": string }
  },
  "strengths": string[],
  "improvements": string[],
  "improved_answer": string (An executive-ready, polished STAR-method rewrite grounded in the candidate's answer),
  "remote_signal": string (Coaching note on how this answer signals remote competence, e.g. async documentation, ownership)
}`;

export async function POST(req: Request) {
  try {
    const u = await requirePro();
    if (!sameOrigin(req)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
    if (!(await rate('feedback:' + u.id))) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });

    const b = await req.json();
    const question = String(b.question || '').slice(0, 2000);
    const answer = String(b.answer || '').slice(0, 10000);
    const job = String(b.job || '').slice(0, 10000);
    const resume = String(b.resume || '').slice(0, 10000);

    if (!question || !answer) {
      return NextResponse.json({ error: 'Question and answer are required.' }, { status: 400 });
    }

    const raw = await ai(
      INTERVIEW_FEEDBACK_PROMPT,
      `INTERVIEW QUESTION:\n${question}\n\nCANDIDATE ANSWER:\n${answer}\n\nTARGET JOB CONTEXT:\n${job || 'Remote Tech Opportunity'}\n\nCANDIDATE EVIDENCE:\n${resume || 'Self-reported evidence'}`
    );

    const result = safeJson(raw);
    return NextResponse.json(result);
  } catch (e: any) {
    const status = e.message === 'PRO_REQUIRED' ? 402 : e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return NextResponse.json(
      { error: e.message === 'PRO_REQUIRED' ? 'PRO_REQUIRED' : 'INTERVIEW_FEEDBACK_FAILED' },
      { status }
    );
  }
}
