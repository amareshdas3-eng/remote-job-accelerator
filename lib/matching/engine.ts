import type { CandidateMatchResult, MatchDimensions, MatchTier } from './types.ts';
import type { StructuredProfileData } from '../profile.ts';

interface JobOpportunityData {
  title: string;
  description?: string;
  skills?: string[];
  location?: string;
  remote_status?: string;
  category?: string;
  company?: string;
}

export function computeCandidateJobMatch(
  job: JobOpportunityData,
  profile: StructuredProfileData | null,
  rawEvidence: string = ''
): CandidateMatchResult {
  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();
  const jobSkills = (job.skills || []).map((s) => s.trim());

  // Aggregate candidate signals
  const targetRoles = (profile?.target_roles || []).map((r) => r.toLowerCase());
  const candidateTechSkills = [
    ...(profile?.technical_skills || []),
    ...(profile?.technical_domains || []),
  ].map((s) => s.trim());
  const candidatePmSkills = (profile?.pm_leadership_skills || []).map((s) => s.trim());
  const candidateCerts = (profile?.certifications || []).map((c) => c.trim());
  const yearsExp = profile?.years_experience ? Number(profile.years_experience) || 10 : 10;
  const headline = (profile?.headline || '').toLowerCase();
  const fullEvidence = `${rawEvidence} ${headline} ${JSON.stringify(profile || {})}`.toLowerCase();

  // -------------------------------------------------------------
  // 1. Role Alignment (0 - 25 pts)
  // -------------------------------------------------------------
  let roleScore = 12; // baseline
  let matchedTargetRole: string | null = null;

  for (const tr of targetRoles) {
    if (jobTitle.includes(tr) || tr.includes(jobTitle)) {
      roleScore = 25;
      matchedTargetRole = tr;
      break;
    }
  }

  if (!matchedTargetRole) {
    // Check keyword token overlap
    const titleTokens = jobTitle.split(/[\s,–—\-\/]+/).filter((t) => t.length > 3);
    let tokenMatches = 0;
    for (const t of titleTokens) {
      if (headline.includes(t) || targetRoles.some((r) => r.includes(t)) || fullEvidence.includes(t)) {
        tokenMatches++;
      }
    }
    if (tokenMatches >= 3) {
      roleScore = 23;
    } else if (tokenMatches >= 2) {
      roleScore = 19;
    } else if (tokenMatches >= 1) {
      roleScore = 15;
    }
  }

  // -------------------------------------------------------------
  // 2. Technical Skills Match (0 - 35 pts)
  // -------------------------------------------------------------
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  const allCandidateSkills = [
    ...candidateTechSkills,
    ...candidatePmSkills,
    ...candidateCerts,
  ];

  for (const skill of jobSkills) {
    const sLower = skill.toLowerCase();
    const isDirectMatch = allCandidateSkills.some((cs) => cs.toLowerCase() === sLower || cs.toLowerCase().includes(sLower) || sLower.includes(cs.toLowerCase()));
    const isEvidenceMatch = fullEvidence.includes(sLower);

    if (isDirectMatch || isEvidenceMatch) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  let techScore = 15; // baseline
  if (jobSkills.length > 0) {
    const matchRatio = matchedSkills.length / jobSkills.length;
    if (matchRatio >= 0.8 || matchedSkills.length >= 4) {
      techScore = 35;
    } else if (matchRatio >= 0.5 || matchedSkills.length >= 3) {
      techScore = 30;
    } else if (matchedSkills.length >= 2) {
      techScore = 25;
    } else if (matchedSkills.length >= 1) {
      techScore = 20;
    }
  } else {
    // If job didn't have explicit skills list, inspect description against candidate skills
    let foundInDesc = 0;
    for (const cs of candidateTechSkills) {
      if (jobDesc.includes(cs.toLowerCase())) {
        foundInDesc++;
        if (matchedSkills.length < 5) matchedSkills.push(cs);
      }
    }
    techScore = Math.min(35, 18 + foundInDesc * 4);
  }

  // -------------------------------------------------------------
  // 3. Leadership & Certifications (0 - 20 pts)
  // -------------------------------------------------------------
  let leadershipScore = 10; // baseline
  const leadershipKeywords = ['project management', 'pmp', 'leadership', 'tendering', 'epc', 'budget', 'contracts', 'governance', 'fat/sat', 'o&m'];
  const jobNeedsLeadership = leadershipKeywords.some((k) => jobTitle.includes(k) || jobDesc.includes(k));

  let matchedLeadership = 0;
  for (const pms of candidatePmSkills) {
    if (jobDesc.includes(pms.toLowerCase())) matchedLeadership++;
  }

  const hasPmp = candidateCerts.some((c) => /pmp|prince|pe\b|professional engineer/i.test(c)) || /pmp|pe license/i.test(fullEvidence);

  if (jobNeedsLeadership) {
    if (hasPmp && matchedLeadership >= 2) {
      leadershipScore = 20;
    } else if (hasPmp || matchedLeadership >= 2) {
      leadershipScore = 18;
    } else if (matchedLeadership >= 1) {
      leadershipScore = 15;
    } else {
      leadershipScore = 12;
    }
  } else {
    // Role is individual contributor or general technical
    leadershipScore = 16;
  }

  // -------------------------------------------------------------
  // 4. Seniority & Remote Compatibility (0 - 20 pts)
  // -------------------------------------------------------------
  let seniorityScore = 10;
  const isSeniorRole = /senior|lead|principal|director|manager|head/i.test(jobTitle);

  if (isSeniorRole) {
    if (yearsExp >= 10) {
      seniorityScore = 10;
    } else if (yearsExp >= 5) {
      seniorityScore = 8;
    } else {
      seniorityScore = 6;
    }
  } else {
    seniorityScore = 10;
  }

  let remoteScore = 10;
  const jobIsRemote = /remote|distributed|virtual/i.test(job.remote_status || '') || /remote/i.test(job.location || '');
  if (jobIsRemote) {
    remoteScore = 10;
  } else {
    remoteScore = 6;
  }

  const seniorityRemoteTotal = seniorityScore + remoteScore;

  // -------------------------------------------------------------
  // Total Score & Tier
  // -------------------------------------------------------------
  const rawTotal = roleScore + techScore + leadershipScore + seniorityRemoteTotal;
  const fitScore = Math.min(98, Math.max(50, rawTotal));

  let tier: MatchTier = 'moderate';
  if (fitScore >= 90) tier = 'exceptional';
  else if (fitScore >= 80) tier = 'strong';
  else if (fitScore >= 70) tier = 'moderate';
  else tier = 'exploratory';

  const dimensions: MatchDimensions = {
    role_alignment: roleScore,
    technical_skills: techScore,
    leadership: leadershipScore,
    seniority_remote: seniorityRemoteTotal,
  };

  // -------------------------------------------------------------
  // Human-Readable Explainability ("Why You Match")
  // -------------------------------------------------------------
  const whyMatched: string[] = [];

  if (matchedTargetRole) {
    whyMatched.push(`Direct alignment with your designated target role (${matchedTargetRole}).`);
  } else if (roleScore >= 18) {
    whyMatched.push(`Strong keyword and domain alignment with your executive headline and target focus.`);
  }

  if (matchedSkills.length > 0) {
    const topSkills = matchedSkills.slice(0, 3).join(', ');
    whyMatched.push(`Verified capability in key role requirements: ${topSkills}.`);
  }

  if (hasPmp && jobNeedsLeadership) {
    whyMatched.push('Your professional project management credentials (PMP/PE) validate technical governance requirements.');
  }

  if (yearsExp >= 8 && isSeniorRole) {
    whyMatched.push(`Your ${yearsExp}+ years of background satisfies senior leadership prerequisites.`);
  }

  if (whyMatched.length === 0) {
    whyMatched.push('Role aligns with your core engineering and technical project management background.');
  }

  // Strategic Advice
  let strategicAdvice = `Lead with your verified experience in ${matchedSkills.slice(0, 2).join(' and ') || 'technical execution'}.`;
  if (missingSkills.length > 0) {
    strategicAdvice += ` Address ${missingSkills.slice(0, 2).join(' and ')} in your tailored resume summary to maximize ATS pass rate.`;
  } else {
    strategicAdvice += ' Emphasize asynchronous leadership and remote delivery in your initial outreach.';
  }

  return {
    fit_score: fitScore,
    tier,
    dimensions,
    matched_skills: matchedSkills,
    missing_skills: missingSkills,
    why_matched: whyMatched,
    strategic_advice: strategicAdvice,
  };
}
