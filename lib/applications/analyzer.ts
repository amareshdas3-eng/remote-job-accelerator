import type { JobRequirement } from './types';

export function extractJobRequirements(jobTitle: string, jobDescription: string): JobRequirement[] {
  const requirements: JobRequirement[] = [];
  const lines = (jobDescription || '').split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);

  let currentCategory: 'required' | 'preferred' = 'required';
  let counter = 1;

  for (const line of lines) {
    const lLower = line.toLowerCase();

    // Check header cues
    if (/preferred|nice to have|bonus|plus|desired|ideal candidate/i.test(lLower)) {
      currentCategory = 'preferred';
      continue;
    } else if (/requirements|qualifications|what you bring|must have|what you'll need|minimum/i.test(lLower)) {
      currentCategory = 'required';
      continue;
    }

    // Identify requirement-like bullets
    const isBullet = /^[-*•·–—]|\d+\.|\b(experience with|proven track record|strong background|proficiency in|ability to|responsible for|bachelor|master|degree|years of)\b/i.test(line);

    if (isBullet && line.length > 15 && line.length < 350) {
      const cleanStatement = line.replace(/^[-*•·–—\d.)\s]+/, '').trim();
      
      // Extract keywords (technologies, frameworks, methods, metrics)
      const keywords = cleanStatement
        .split(/[\s,/:;()]+/)
        .map((w) => w.replace(/[^a-zA-Z0-9+#.-]/g, '').trim())
        .filter((w) => w.length > 2 && !/^(and|with|the|for|from|that|this|have|will|must|such|able|work|team)$/i.test(w))
        .slice(0, 8);

      let domain = 'technical';
      if (/lead|manage|direct|mentor|strategy|governance|budget|pmp|agile/i.test(cleanStatement)) {
        domain = 'leadership';
      } else if (/degree|bachelor|master|phd|certif|license/i.test(cleanStatement)) {
        domain = 'education_credential';
      } else if (/remote|async|distributed|collaborat|communicat/i.test(cleanStatement)) {
        domain = 'collaboration_remote';
      }

      requirements.push({
        id: `req-${counter++}`,
        category: currentCategory,
        statement: cleanStatement,
        keywords,
        domain,
      });

      if (requirements.length >= 15) break;
    }
  }

  // Baseline fallback if job description did not have structured bullet lists
  if (requirements.length === 0) {
    requirements.push(
      {
        id: 'req-1',
        category: 'required',
        statement: `Demonstrated professional experience in ${jobTitle} execution and system delivery.`,
        keywords: [jobTitle.split(' ')[0], 'Execution', 'Delivery'],
        domain: 'technical',
      },
      {
        id: 'req-2',
        category: 'required',
        statement: 'Proven ability to lead technical initiatives and direct cross-functional projects.',
        keywords: ['Leadership', 'Projects', 'Delivery'],
        domain: 'leadership',
      },
      {
        id: 'req-3',
        category: 'preferred',
        statement: 'Strong track record of asynchronous remote ownership and autonomous delivery.',
        keywords: ['Remote', 'Asynchronous', 'Ownership'],
        domain: 'collaboration_remote',
      }
    );
  }

  return requirements;
}
