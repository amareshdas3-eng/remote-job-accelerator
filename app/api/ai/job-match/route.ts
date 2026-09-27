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
    if (!(await rate('match:' + u.id))) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });

    const b = await req.json();
    let resume = String(b.resume || '').slice(0, 30000);
    const job = String(b.job || '').slice(0, 30000);

    let structuredProfile: any = null;
    const admin = supabaseAdmin();
    if (!resume) {
      const { data: p } = await admin.from('profiles').select('resume_text, structured_profile').eq('id', u.id).maybeSingle();
      if (p?.structured_profile) {
        structuredProfile = p.structured_profile;
        const { formatStructuredProfileText } = await import('../../../../lib/profile');
        resume = formatStructuredProfileText(p.structured_profile);
      } else if (p?.resume_text) {
        resume = p.resume_text.slice(0, 30000);
      }
    } else {
      const { data: p } = await admin.from('profiles').select('structured_profile').eq('id', u.id).maybeSingle();
      if (p?.structured_profile) structuredProfile = p.structured_profile;
    }

    if (!job || !resume) {
      return NextResponse.json({ error: 'Job and resume evidence are required.' }, { status: 400 });
    }

    // 1. Compute authoritative deterministic match metrics
    const { computeCandidateJobMatch } = await import('../../../../lib/matching/engine');
    const deterministic = computeCandidateJobMatch(
      {
        title: b.title || 'Target Role',
        company: b.company || 'Target Company',
        description: job,
        skills: Array.isArray(b.skills) ? b.skills : [],
      },
      structuredProfile,
      resume
    );

    // 2. Generate AI Explanation Layer
    let aiExplanation: any = {};
    try {
      const raw = await ai(
        'You are an evidence-first career analyst providing an explanation for a candidate match. Return ONLY valid JSON with keys verdict, strengths (array), gaps (array), actions (array), matched_requirements (array of {requirement,evidence,status}), truth_flags (array), why_matched (array), strategic_advice. Never invent candidate qualifications, employers, degrees, tools, metrics or outcomes. Distinguish explicit evidence from inference.',
        `Analyze this job against this resume evidence.
DETERMINISTIC EVALUATION:
- Fit Score: ${deterministic.fit_score}/100 (Tier: ${deterministic.tier})
- Role Alignment: ${deterministic.dimensions.role_alignment}/25
- Technical Skills: ${deterministic.dimensions.technical_skills}/35
- Leadership: ${deterministic.dimensions.leadership}/20
- Seniority/Remote: ${deterministic.dimensions.seniority_remote}/20
- Matched Skills: ${deterministic.matched_skills.join(', ')}
- Missing Skills: ${deterministic.missing_skills.join(', ')}

JOB:
${job}

RESUME EVIDENCE:
${resume}`
      );
      aiExplanation = safeJson(raw);
    } catch (aiErr) {
      console.warn('[AI Job Match] AI explanation fallback operational:', aiErr);
    }

    // 3. Composite Result: Deterministic Metrics + AI Explanation
    const result = {
      score: deterministic.fit_score,
      fit_score: deterministic.fit_score,
      tier: deterministic.tier,
      dimensions: deterministic.dimensions,
      matched_skills: deterministic.matched_skills,
      missing_skills: deterministic.missing_skills,
      why_matched: Array.isArray(aiExplanation?.why_matched) && aiExplanation.why_matched.length > 0
        ? aiExplanation.why_matched
        : deterministic.why_matched,
      strategic_advice: aiExplanation?.strategic_advice || deterministic.strategic_advice,
      verdict: aiExplanation?.verdict || (deterministic.tier === 'exceptional' ? 'Exceptional Fit' : deterministic.tier === 'strong' ? 'Strong Match' : 'Potential Match'),
      strengths: Array.isArray(aiExplanation?.strengths) && aiExplanation.strengths.length > 0
        ? aiExplanation.strengths
        : deterministic.why_matched,
      gaps: Array.isArray(aiExplanation?.gaps) && aiExplanation.gaps.length > 0
        ? aiExplanation.gaps
        : deterministic.missing_skills,
      actions: Array.isArray(aiExplanation?.actions) && aiExplanation.actions.length > 0
        ? aiExplanation.actions
        : [`Highlight verified capability in ${deterministic.matched_skills.slice(0, 2).join(' and ') || 'core role requirements'}.`],
      matched_requirements: Array.isArray(aiExplanation?.matched_requirements) ? aiExplanation.matched_requirements : [],
      truth_flags: Array.isArray(aiExplanation?.truth_flags) ? aiExplanation.truth_flags : [],
    };

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

    // Track product telemetry
    try {
      const { trackServerEvent } = await import('../../../../lib/analytics');
      await trackServerEvent('match_explanation_viewed', {
        jobId: finalJobId,
        company: b.company,
        fitScore: deterministic.fit_score,
        tier: deterministic.tier,
      }, u.id);
      await trackServerEvent('why_match_opened', {
        jobId: finalJobId,
        fitScore: deterministic.fit_score,
      }, u.id);
    } catch {
      // Non-fatal telemetry
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
