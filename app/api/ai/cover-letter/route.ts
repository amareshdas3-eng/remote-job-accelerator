import {NextResponse} from 'next/server';
import {requirePro} from '../../../../lib/auth';
import {ai,safeJson} from '../../../../lib/ai';
import {rate} from '../../../../lib/rate';
import {sameOrigin} from '../../../../lib/security';
import {supabaseAdmin} from '../../../../lib/supabase';
export async function POST(req:Request){
 try{
  const u=await requirePro();
  if(!sameOrigin(req)) return NextResponse.json({error:'INVALID_ORIGIN'},{status:403});
  if(!(await rate('cover-letter:'+u.id))) return NextResponse.json({error:'RATE_LIMIT'},{status:429});
  const b = await req.json();
  let resume = String(b.resume || '').slice(0, 30000);
  const job = String(b.job || '').slice(0, 30000);
  const tailoredResume = b.tailored_resume ? JSON.stringify(b.tailored_resume).slice(0, 10000) : '';

  if (!resume) {
    const { data: p } = await supabaseAdmin().from('profiles').select('resume_text, structured_profile').eq('id', u.id).maybeSingle();
    if (p?.structured_profile) {
      const { formatStructuredProfileText } = await import('../../../../lib/profile');
      resume = formatStructuredProfileText(p.structured_profile);
    } else if (p?.resume_text) {
      resume = p.resume_text.slice(0, 30000);
    }
  }

  if (!resume || !job) {
    return NextResponse.json({ error: 'Job and resume evidence are required.' }, { status: 400 });
  }

  const systemPrompt = `You are an elite executive career strategist and professional cover letter writer.
Your job is to craft a compelling, tailored cover letter and a direct email application pitch that tell the EXACT SAME professional story as the candidate's tailored ATS resume.

CRITICAL TRUTH GUARD RULES:
1. Strictly evidence-based. Never invent employers, degrees, tools, metrics, dates, responsibilities, or outcomes.
2. Avoid generic AI templates, buzzwords, or exaggerated fluff (e.g. "I am thrilled to apply", "esteemed organization", "perfect fit", "synergistic").
3. Write like a seasoned professional: clear, confident, grounded in quantifiable results, and respectful of the hiring team's time.
4. If a job requirement is not supported by candidate evidence, do NOT invent it. Focus on authentic transferable strengths and note gaps in the "gaps" list.

RETURN FORMAT:
Return ONLY valid JSON matching this schema:
{
  "recipient": "Hiring Manager / Talent Team at [Company Name]",
  "subject": "Application: [Target Role] – [Candidate Full Name]",
  "salutation": "Dear [Hiring Manager / Hiring Team at Company],",
  "letter": "Full 3-4 paragraph tailored cover letter...",
  "email_pitch": "Concise 2-paragraph direct email version for email-based applications...",
  "why_company": "Specific statement connecting candidate background to the company mission/product...",
  "evidence_used": ["Evidence point 1", "Evidence point 2"],
  "gaps": ["Unmatched requirement 1"]
}`;

  const userPrompt = `Create a matching tailored cover letter and email application pitch for this target role.
JOB DESCRIPTION:
${job}

${tailoredResume ? `TAILORED ATS RESUME CONTEXT:\n${tailoredResume}\n\n` : ''}MASTER RESUME EVIDENCE:
${resume}`;

  const raw = await ai(systemPrompt, userPrompt);
  const result = safeJson(raw);
  if (b.job_id) {
    await supabaseAdmin()
      .from('jobs')
      .update({ cover_letter: result, updated_at: new Date().toISOString() })
      .eq('id', b.job_id)
      .eq('user_id', u.id);
  }
  return NextResponse.json(result);
 } catch (e: any) {
  const status = e.message === 'PRO_REQUIRED' ? 402 : e.message === 'UNAUTHENTICATED' ? 401 : 500;
  return NextResponse.json({ error: e.message === 'PRO_REQUIRED' ? 'PRO_REQUIRED' : 'COVER_LETTER_FAILED' }, { status });
 }
}
