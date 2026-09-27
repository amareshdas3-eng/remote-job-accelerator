import type { JobRequirement, CandidateGapAnalysis, RequirementMatch } from './types';
import type { StructuredProfileData } from '../profile';

export function analyzeCandidateGaps(
  requirements: JobRequirement[],
  profile: StructuredProfileData | null,
  rawEvidence: string = ''
): CandidateGapAnalysis {
  const candidateSkills = [
    ...(profile?.technical_skills || []),
    ...(profile?.technical_domains || []),
    ...(profile?.pm_leadership_skills || []),
    ...(profile?.certifications || []),
  ].map((s) => s.trim().toLowerCase());

  const targetRoles = (profile?.target_roles || []).map((r) => r.toLowerCase());
  const yearsExp = profile?.years_experience ? Number(profile.years_experience) || 10 : 10;
  const headline = (profile?.headline || '').toLowerCase();
  const fullText = `${rawEvidence} ${headline} ${JSON.stringify(profile || {})}`.toLowerCase();

  const matches: RequirementMatch[] = [];
  const gaps: string[] = [];

  let verifiedCount = 0;
  let partialCount = 0;
  let gapCount = 0;

  for (const req of requirements) {
    const statementLower = req.statement.toLowerCase();
    const matchingCandidateSkills: string[] = [];

    // Check candidate skills match
    for (const cs of candidateSkills) {
      if (cs && (statementLower.includes(cs) || req.keywords.some((kw) => kw.toLowerCase() === cs))) {
        matchingCandidateSkills.push(cs);
      }
    }

    // Check years of experience match
    const expMatch = statementLower.match(/(\d+)\+?\s*years/);
    let satisfiesExp = true;
    if (expMatch && expMatch[1]) {
      const requiredYears = parseInt(expMatch[1], 10);
      satisfiesExp = yearsExp >= requiredYears;
    }

    // Check evidence text presence
    const foundKeywordsInText = req.keywords.filter((kw) => fullText.includes(kw.toLowerCase()));
    const keywordOverlapRatio = req.keywords.length > 0 ? foundKeywordsInText.length / req.keywords.length : 0;

    let status: 'verified' | 'partial' | 'unsupported' = 'unsupported';
    let citation: string | undefined = undefined;
    let capability: string | undefined = undefined;

    if ((matchingCandidateSkills.length >= 2 || keywordOverlapRatio >= 0.5) && satisfiesExp) {
      status = 'verified';
      verifiedCount++;
      capability = matchingCandidateSkills.length > 0
        ? `Direct skill alignment: ${matchingCandidateSkills.join(', ')}`
        : `Verified capability in ${req.keywords.slice(0, 3).join(', ')}`;
      citation = `Candidate profile verifies ${yearsExp}+ years experience matching requirement keywords.`;
    } else if (matchingCandidateSkills.length >= 1 || keywordOverlapRatio >= 0.25 || fullText.includes(req.statement.slice(0, 30).toLowerCase())) {
      status = 'partial';
      partialCount++;
      capability = matchingCandidateSkills.length > 0
        ? `Transferable capability: ${matchingCandidateSkills.join(', ')}`
        : `Adjacent background in ${req.domain || 'technical execution'}`;
      citation = 'Adjacent experience identified; needs emphasis in tailored resume.';
    } else {
      status = 'unsupported';
      gapCount++;
      gaps.push(req.statement);
    }

    matches.push({
      requirement_id: req.id,
      statement: req.statement,
      category: req.category,
      status,
      evidence_citation: citation,
      candidate_capability: capability,
    });
  }

  // Calculate deterministic readiness score (0 - 100)
  const total = requirements.length;
  let readinessScore = 50;
  if (total > 0) {
    const rawScore = ((verifiedCount * 1.0 + partialCount * 0.5) / total) * 100;
    readinessScore = Math.min(98, Math.max(45, Math.round(rawScore)));
  }

  // Strategic positioning
  let strategicPositioning = `Emphasize your ${verifiedCount} directly verified capabilities in the opening executive summary.`;
  if (partialCount > 0) {
    strategicPositioning += ` Frame your ${partialCount} transferable skills with concrete project outcomes.`;
  }
  if (gaps.length > 0) {
    strategicPositioning += ` Proactively address key gap (${gaps[0].slice(0, 60)}...) in your screening answers.`;
  }

  return {
    total_requirements: total,
    verified_count: verifiedCount,
    partial_count: partialCount,
    gap_count: gapCount,
    readiness_score: readinessScore,
    matches,
    gaps,
    strategic_positioning: strategicPositioning,
  };
}
