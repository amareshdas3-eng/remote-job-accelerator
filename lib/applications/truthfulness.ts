import type { TruthfulnessAudit } from './types';
import type { StructuredProfileData } from '../profile';

const HIGH_STAKES_CREDENTIALS = [
  'pmp',
  'prince2',
  'pe license',
  'professional engineer',
  'phd',
  'doctorate',
  'mba',
  'master of science',
  'cpa',
  'cissp',
  'aws certified solutions architect',
  'gcp professional cloud architect',
  'cka',
];

export function auditApplicationTruthfulness(
  generatedContent: {
    resumeText?: string;
    coverLetterText?: string;
    answers?: string[];
  },
  profile: StructuredProfileData | null,
  rawEvidence: string = ''
): TruthfulnessAudit {
  const verifiedCertifications = (profile?.certifications || []).map((c) => c.toLowerCase().trim());
  const candidateSkills = [
    ...(profile?.technical_skills || []),
    ...(profile?.technical_domains || []),
    ...(profile?.pm_leadership_skills || []),
  ].map((s) => s.toLowerCase().trim());

  const fullEvidence = `${rawEvidence} ${profile?.headline || ''} ${JSON.stringify(profile || {})}`.toLowerCase();

  const combinedGeneratedText = [
    generatedContent.resumeText || '',
    generatedContent.coverLetterText || '',
    ...(generatedContent.answers || []),
  ].join(' ').toLowerCase();

  const unsupportedClaims: string[] = [];
  const verifiedClaims: string[] = [];
  const flags: string[] = [];

  // 1. Audit High-Stakes Credentials (Certifications, Licenses, Advanced Degrees)
  for (const cred of HIGH_STAKES_CREDENTIALS) {
    const credRegex = new RegExp(`\\b${cred}\\b`, 'i');
    if (credRegex.test(combinedGeneratedText)) {
      const hasCertInProfile = verifiedCertifications.some((vc) => vc.includes(cred) || cred.includes(vc));
      const hasCertInEvidence = fullEvidence.includes(cred);

      if (hasCertInProfile || hasCertInEvidence) {
        verifiedClaims.push(`Verified Credential: ${cred.toUpperCase()}`);
      } else {
        unsupportedClaims.push(`Hallucinated or unverified credential claimed in generation: ${cred.toUpperCase()}`);
        flags.push(`UNVERIFIED_CREDENTIAL_${cred.replace(/\s+/g, '_').toUpperCase()}`);
      }
    }
  }

  // 2. Audit Years of Experience Inflation
  const generatedExpMatches = combinedGeneratedText.match(/(\d+)\+?\s*years(?:\s+of)?\s+experience/g);
  if (generatedExpMatches && profile?.years_experience) {
    const candidateYears = Number(profile.years_experience) || 10;
    for (const match of generatedExpMatches) {
      const numMatch = match.match(/\d+/);
      if (numMatch) {
        const claimedYears = parseInt(numMatch[0], 10);
        if (claimedYears > candidateYears + 3) {
          unsupportedClaims.push(`Experience inflation: claimed ${claimedYears} years vs candidate record of ${candidateYears} years.`);
          flags.push('EXPERIENCE_INFLATION_DETECTED');
        } else {
          verifiedClaims.push(`Consistent experience tenure: ${match}`);
        }
      }
    }
  }

  // 3. Compute Truthfulness Score
  let truthScore = 100;
  if (unsupportedClaims.length > 0) {
    truthScore = Math.max(20, 100 - unsupportedClaims.length * 35);
  }

  const isTruthful = unsupportedClaims.length === 0;

  return {
    is_truthful: isTruthful,
    truth_score: truthScore,
    verified_claims: Array.from(new Set(verifiedClaims)),
    unsupported_claims: unsupportedClaims,
    flags,
  };
}
