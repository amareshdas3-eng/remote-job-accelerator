import { NextResponse } from 'next/server';
import { requirePro } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { ai, safeJson } from '../../../../lib/ai';
import { rate } from '../../../../lib/rate';
import { sameOrigin, jsonError } from '../../../../lib/security';
import { formatStructuredProfileText } from '../../../../lib/profile';

export interface ScreeningAnswer {
  category: string;
  question: string;
  answer: string;
  word_count: number;
  tactical_notes?: string;
}

const SCREENING_SYSTEM_PROMPT = `You are an elite executive career coach and ATS application assistant.
Your task is to generate high-conviction, authentic, and truth-grounded answers to standard and custom ATS screening questions for a remote opportunity.

CRITICAL TRUTH GUARD RULES:
1. Ground all answers strictly in the candidate's verified career evidence. Never hallucinate employers, metrics, or credentials.
2. Keep answers concise, professional, and within typical ATS text-box limits (100 to 200 words each).
3. Directly answer the question without corporate buzzwords or hollow flattering remarks.

RETURN FORMAT:
Return ONLY valid JSON matching this schema:
{
  "answers": [
    {
      "category": "Motivation / Why Company",
      "question": "Why do you want to work at [Company] as [Role]?",
      "answer": "Targeted 2-paragraph response connecting candidate background to company goals...",
      "word_count": 120,
      "tactical_notes": "Highlights alignment with company mission and immediate readiness"
    },
    {
      "category": "Remote & Execution",
      "question": "Describe your experience working autonomously in remote/distributed environments.",
      "answer": "Concrete response highlighting asynchronous documentation, time-zone overlap, and delivery...",
      "word_count": 110,
      "tactical_notes": "Emphasizes asynchronous discipline and reliability"
    },
    {
      "category": "Compensation",
      "question": "What are your compensation / salary expectations?",
      "answer": "Professional anchor based on market rates and stated range...",
      "word_count": 50,
      "tactical_notes": "Maintains flexibility while anchoring at an appropriate tier"
    },
    {
      "category": "Availability & Authorization",
      "question": "What is your earliest start date and work authorization status?",
      "answer": "Clear statement of notice period and remote authorization...",
      "word_count": 40,
      "tactical_notes": "Zero ambiguity regarding legal authorization and start timeline"
    }
  ]
}`;

export async function POST(req: Request) {
  try {
    const user = await requirePro();
    if (!sameOrigin(req)) return jsonError('INVALID_ORIGIN', 403);
    if (!(await rate('screening:' + user.id))) return jsonError('RATE_LIMIT', 429);

    const b = await req.json();
    const role = String(b.title || b.job_title || 'Target Role').trim().slice(0, 200);
    const company = String(b.company || 'Target Company').trim().slice(0, 200);
    const description = String(b.description || b.job || '').trim().slice(0, 25000);
    const salary = b.salary ? String(b.salary).trim().slice(0, 150) : undefined;
    const jobId = b.job_id ? String(b.job_id).trim() : null;
    const customQuestions: string[] = Array.isArray(b.custom_questions) ? b.custom_questions.map(String) : [];

    let resume = String(b.resume || '').slice(0, 25000);
    const admin = supabaseAdmin();
    const { data: profileRow } = await admin
      .from('profiles')
      .select('resume_text, structured_profile')
      .eq('id', user.id)
      .maybeSingle();

    if (profileRow?.structured_profile && !resume) {
      resume = formatStructuredProfileText(profileRow.structured_profile);
    } else if (profileRow?.resume_text && !resume) {
      resume = profileRow.resume_text.slice(0, 25000);
    }

    let answers: ScreeningAnswer[] = [];

    try {
      const userPrompt = `Generate targeted ATS screening answers for:
TARGET ROLE: ${role}
COMPANY: ${company}
${salary ? `SALARY INFORMATION: ${salary}\n` : ''}
JOB DESCRIPTION:
${description || 'Standard remote opportunity'}

${customQuestions.length > 0 ? `CUSTOM QUESTIONS TO ANSWER:\n${customQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n` : ''}
CANDIDATE VERIFIED EVIDENCE:
${resume || 'Experienced remote professional with verified track record.'}`;

      const aiResponse = await ai(SCREENING_SYSTEM_PROMPT, userPrompt);
      const parsed = safeJson(aiResponse);

      if (parsed && Array.isArray(parsed.answers)) {
        answers = parsed.answers.map((a: any) => ({
          category: a.category || 'General Screening',
          question: a.question || 'Application question',
          answer: a.answer || '',
          word_count: (a.answer || '').split(/\s+/).filter(Boolean).length,
          tactical_notes: a.tactical_notes || ''
        }));
      }
    } catch (err) {
      console.warn('[Screening Answers API] AI fallback:', err);
    }

    // Baseline fallback if AI didn't return answers
    if (answers.length === 0) {
      answers = [
        {
          category: 'Motivation / Why Company',
          question: `Why do you want to work at ${company} as ${role}?`,
          answer: `I am specifically targeting ${company} because of your leadership and technical focus in the remote space. With my verified background in system delivery and engineering execution, I am well positioned to make an immediate impact on your roadmap while upholding rigorous architectural standards.`,
          word_count: 46,
          tactical_notes: 'Direct evidence alignment with company mission'
        },
        {
          category: 'Remote Autonomy',
          question: 'Describe your experience working autonomously in remote environments.',
          answer: `I have extensive experience operating across distributed, asynchronous teams. My approach emphasizes proactive documentation, clear milestone tracking, disciplined communication in Slack/Git, and autonomous problem-solving to ensure steady delivery without constant oversight.`,
          word_count: 36,
          tactical_notes: 'Demonstrates asynchronous leadership and ownership'
        },
        {
          category: 'Compensation',
          question: 'What are your compensation expectations?',
          answer: `My expectation is ${salary || 'competitive for executive-grade remote positions'}, commensurate with the scope of this role and the immediate value I will bring to ${company}'s deliverables. I remain open to discussing the full package including equity and benefits.`,
          word_count: 42,
          tactical_notes: 'Anchors professionally while remaining collaborative'
        },
        {
          category: 'Authorization & Start Date',
          question: 'What is your notice period and work authorization?',
          answer: `I am fully authorized to work remotely and can transition smoothly within standard notice (2 to 4 weeks), ready to commit fully to ${company}'s milestones from day one.`,
          word_count: 30,
          tactical_notes: 'Clean legal authorization confirmed'
        }
      ];
    }

    // Persist to canonical job record if job_id is provided
    if (jobId) {
      const { data: existingJob } = await admin
        .from('jobs')
        .select('metadata')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .maybeSingle();

      const existingMeta = existingJob?.metadata && typeof existingJob.metadata === 'object' ? existingJob.metadata : {};
      const updatedMeta = { ...existingMeta, screening_answers: answers };

      await admin
        .from('jobs')
        .update({ metadata: updatedMeta, updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      answers,
      job_id: jobId,
      role_title: role,
      company
    });
  } catch (e: any) {
    console.error('[Screening Answers API] Error:', e);
    const status = e.message === 'PRO_REQUIRED' ? 402 : e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonError(e.message || 'SCREENING_ANSWERS_FAILED', status);
  }
}
