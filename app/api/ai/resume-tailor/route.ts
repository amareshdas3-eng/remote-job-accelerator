import { NextResponse } from 'next/server';
import { requirePro } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { ai, safeJson } from '../../../../lib/ai';
import { rate } from '../../../../lib/rate';
import { sameOrigin } from '../../../../lib/security';

const ATS_SYSTEM_PROMPT = `You are a world-class ATS (Applicant Tracking System) resume optimization engine and executive career strategist.
Your task is to tailor the candidate's verified evidence to match the target job description with 100% ATS compliance (compatible with Workday, Greenhouse, Lever, Taleo, iCIMS, Ashby).

CRITICAL TRUTH GUARD RULES:
1. Preserve factual truth strictly. NEVER hallucinate, invent, or extrapolate employers, degrees, metrics, dates, programming languages, or certifications not found in the candidate's evidence.
2. If the job description requires a skill or qualification absent from the evidence, do NOT invent it. Instead, include it in the "warnings" and "unmatched_keywords" lists.

ATS PARSING & FORMATTING STANDARDS:
1. Single-Column Linear Layout: Output plain single-column content. No multi-column tables, floating text boxes, or non-standard characters that trip ATS parsers.
2. Standard Universal Section Headers:
   - CONTACT INFORMATION
   - PROFESSIONAL SUMMARY
   - CORE COMPETENCIES & TECHNICAL SKILLS
   - PROFESSIONAL EXPERIENCE
   - EDUCATION
   - CERTIFICATIONS & CREDENTIALS (if present in evidence)
3. Action-Verb & Quantified Bullets: Format experience bullets using strong action verbs (Led, Architected, Engineered, Optimized, Automated, Delivered) and include quantifiable metrics from the evidence whenever available.
4. Keyword Density: Naturally incorporate matching keywords from the job description into the summary, skill taxonomies, and experience bullets.
5. Standard Date Formats: Standardize all employment dates to "Month Year – Month Year" (or "Year – Year").

RETURN FORMAT:
Return ONLY valid JSON matching this schema:
{
  "headline": "Target Role / Job Title",
  "contact_info": {
    "name": "Candidate Full Name (from evidence, or 'Candidate')",
    "email": "Email address (from evidence or '')",
    "phone": "Phone number (from evidence or '')",
    "location": "City, State / Remote (from evidence or 'Remote')",
    "links": ["LinkedIn URL", "GitHub / Portfolio URL"]
  },
  "summary": "3-4 sentence keyword-optimized ATS professional summary aligned to target role",
  "skills": ["Skill 1", "Skill 2"],
  "categorized_skills": {
    "technical_skills": ["Language/Framework 1", "Language/Framework 2"],
    "tools_and_platforms": ["Tool 1", "Platform 2"],
    "domain_expertise": ["Methodology 1", "Domain 2"]
  },
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "location": "Location / Remote",
      "period": "Month Year – Month Year",
      "bullets": [
        "High-impact bullet with action verb, context, and quantified metric"
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree and Major",
      "institution": "University / Institution",
      "year": "Graduation Year"
    }
  ],
  "certifications": ["Certification Name"],
  "ats_audit": {
    "ats_score": 98,
    "target_role": "Target Role",
    "matched_keywords": ["keyword 1", "keyword 2"],
    "unmatched_keywords": ["gap 1"],
    "compliance_checks": [
      "Standard universal section headings",
      "Single-column linear parsing flow",
      "Chronological employment structure with standard dates",
      "Action-verb quantified bullet points",
      "Clean UTF-8 characters without parsing traps"
    ]
  },
  "warnings": ["Warning about gaps or unverified requirements"],
  "evidence_map": [
    { "requirement": "Job Requirement", "matched_evidence": "Evidence excerpt" }
  ],
  "full_resume": "Complete, 100% ATS-parseable single-column plain text document formatted with standard uppercase headers, contact header, summary, categorized skills, reverse-chronological experience with bullet points, and education."
}`;

export async function POST(req: Request) {
  try {
    const u = await requirePro();
    if (!sameOrigin(req)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
    if (!(await rate('resume:' + u.id))) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });

    const b = await req.json();
    let resume = String(b.resume || '').slice(0, 30000);
    const job = String(b.job || '').slice(0, 30000);

    if (!resume) {
      const { data: p } = await supabaseAdmin().from('profiles').select('resume_text, structured_profile').eq('id', u.id).maybeSingle();
      if (p?.structured_profile) {
        const { formatStructuredProfileText } = await import('../../../../lib/profile');
        resume = formatStructuredProfileText(p.structured_profile);
      } else if (p?.resume_text) {
        resume = p.resume_text.slice(0, 30000);
      }
    }

    if (!job || !resume) return NextResponse.json({ error: 'Job and resume evidence are required.' }, { status: 400 });

    const raw = await ai(
      ATS_SYSTEM_PROMPT,
      'Tailor this resume evidence to this target job for 100% ATS readiness.\n\nRESUME EVIDENCE:\n' + resume + '\n\nTARGET JOB DESCRIPTION:\n' + job
    );

    const result = safeJson(raw);
    if (b.job_id) {
      await supabaseAdmin()
        .from('jobs')
        .update({ tailored_resume: result, updated_at: new Date().toISOString() })
        .eq('id', b.job_id)
        .eq('user_id', u.id);
    }

    return NextResponse.json(result);
  } catch (e: any) {
    const status = e.message === 'PRO_REQUIRED' ? 402 : e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return NextResponse.json({ error: e.message === 'PRO_REQUIRED' ? 'PRO_REQUIRED' : 'RESUME_TAILOR_FAILED' }, { status });
  }
}
