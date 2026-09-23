import { NextResponse } from 'next/server';
import { requirePro } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { ai, safeJson } from '../../../../lib/ai';
import { rate } from '../../../../lib/rate';
import { sameOrigin, jsonError } from '../../../../lib/security';
import { buildDeterministicStrategy, ApplicationStrategy } from '../../../../lib/strategy/engine';
import { formatStructuredProfileText } from '../../../../lib/profile';

const STRATEGY_SYSTEM_PROMPT = `You are a world-class executive career campaign strategist and talent positioning expert.
Your job is to formulate a high-conviction, tailored Application Strategy for an executive/senior candidate targeting a specific remote role.

CRITICAL TRUTH GUARD RULES:
1. Strictly ground all strategy, positioning hooks, and evidence anchors in the candidate's verified career evidence.
2. NEVER invent achievements, credentials, or technologies not present in the candidate profile.
3. Identify genuine friction points / hiring hurdles (e.g. overqualification, missing non-core technology, remote time zone, transition context) and formulate proactive, evidence-based mitigations.

RETURN FORMAT:
Return ONLY valid JSON matching this schema:
{
  "role_title": "Target Role",
  "company": "Company Name",
  "strategic_angle": "1-2 sentence core positioning thesis framing candidate as the ideal solution to the company's hiring need",
  "positioning_hook": "A punchy 2-sentence opening narrative hook for outreach, cover letters, and recruiter screens",
  "core_themes": [
    "Theme 1: Technical mastery point directly addressing job requirements",
    "Theme 2: Remote leadership / autonomous delivery proof point",
    "Theme 3: Business impact and operational velocity proof point"
  ],
  "hurdles": [
    {
      "hurdle": "Potential recruiter hesitation or qualification friction point",
      "mitigation": "Proactive tactical counter-argument or framing technique",
      "evidence_anchor": "Specific metric or achievement from candidate evidence verifying capability"
    }
  ],
  "compensation_guidance": {
    "stated_range": "Stated job salary or 'Competitive Executive Grade'",
    "target_anchor": "Specific suggested dollar anchor for initial screen",
    "negotiation_angle": "Rationale based on candidate background and immediate impact"
  },
  "recommended_route": "Tactical advice on applying (e.g. Direct ATS portal + executive LinkedIn outreach to talent lead)",
  "elevator_pitch": "30-second conversational pitch grounded in candidate background"
}`;

export async function POST(req: Request) {
  try {
    const user = await requirePro();
    if (!sameOrigin(req)) return jsonError('INVALID_ORIGIN', 403);
    if (!(await rate('strategy:' + user.id))) return jsonError('RATE_LIMIT', 429);

    const b = await req.json();
    const role = String(b.title || b.job_title || 'Target Role').trim().slice(0, 200);
    const company = String(b.company || 'Target Company').trim().slice(0, 200);
    const description = String(b.description || b.job || '').trim().slice(0, 25000);
    const salary = b.salary ? String(b.salary).trim().slice(0, 150) : undefined;
    const jobId = b.job_id ? String(b.job_id).trim() : null;

    let resume = String(b.resume || '').slice(0, 25000);
    let structuredProfile: any = null;

    const admin = supabaseAdmin();
    const { data: profileRow } = await admin
      .from('profiles')
      .select('resume_text, structured_profile')
      .eq('id', user.id)
      .maybeSingle();

    if (profileRow?.structured_profile) {
      structuredProfile = profileRow.structured_profile;
      if (!resume) resume = formatStructuredProfileText(structuredProfile);
    } else if (profileRow?.resume_text && !resume) {
      resume = profileRow.resume_text.slice(0, 25000);
    }

    let strategyResult: ApplicationStrategy;

    try {
      const userPrompt = `Formulate an executive Application Strategy for this opportunity.

TARGET ROLE: ${role}
COMPANY: ${company}
${salary ? `SALARY / COMPENSATION: ${salary}\n` : ''}
JOB DESCRIPTION:
${description || 'Standard remote opportunity for ' + role + ' at ' + company}

CANDIDATE VERIFIED EVIDENCE:
${resume || 'Experienced remote professional with documented technical accomplishments.'}`;

      const aiResponse = await ai(STRATEGY_SYSTEM_PROMPT, userPrompt);
      const parsed = safeJson(aiResponse);

      if (parsed && parsed.strategic_angle && Array.isArray(parsed.core_themes)) {
        strategyResult = {
          ...parsed,
          role_title: role,
          company,
          generated_at: new Date().toISOString()
        };
      } else {
        strategyResult = buildDeterministicStrategy({ title: role, company, description, salary }, structuredProfile, resume);
      }
    } catch (aiErr) {
      console.warn('[Strategy API] AI call fallback to deterministic strategy:', aiErr);
      strategyResult = buildDeterministicStrategy({ title: role, company, description, salary }, structuredProfile, resume);
    }

    // Persist to canonical job record if job_id provided
    if (jobId) {
      const { data: existingJob } = await admin
        .from('jobs')
        .select('metadata')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .maybeSingle();

      const existingMeta = existingJob?.metadata && typeof existingJob.metadata === 'object' ? existingJob.metadata : {};
      const updatedMeta = { ...existingMeta, strategy: strategyResult };

      await admin
        .from('jobs')
        .update({ metadata: updatedMeta, updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      strategy: strategyResult,
      job_id: jobId,
      message: `Application strategy formulated for ${role} at ${company}.`
    });
  } catch (e: any) {
    console.error('[Strategy API] Error:', e);
    const status = e.message === 'PRO_REQUIRED' ? 402 : e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonError(e.message || 'STRATEGY_GENERATION_FAILED', status);
  }
}
