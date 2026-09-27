import type { ApplicationPackage, CandidateGapAnalysis, JobRequirement, TruthfulnessAudit } from './types';
import type { StructuredProfileData } from '../profile';
import { extractJobRequirements } from './analyzer';
import { analyzeCandidateGaps } from './gaps';
import { auditApplicationTruthfulness } from './truthfulness';

export function buildApplicationPackage(params: {
  id?: string;
  jobId: string;
  applicationId?: string;
  userId: string;
  company: string;
  role: string;
  jobUrl?: string;
  jobDescription: string;
  profile: StructuredProfileData | null;
  rawEvidence?: string;
  tailoredResume?: any;
  coverLetter?: any;
  screeningAnswers?: any;
  currentStatus?: ApplicationPackage['status'];
  humanReviewed?: boolean;
}): ApplicationPackage {
  const requirements = extractJobRequirements(params.role, params.jobDescription);
  const gapAnalysis = analyzeCandidateGaps(requirements, params.profile, params.rawEvidence || '');

  const truthAudit = auditApplicationTruthfulness(
    {
      resumeText: params.tailoredResume?.full_resume || params.tailoredResume?.summary || '',
      coverLetterText: params.coverLetter?.letter || '',
      answers: Array.isArray(params.screeningAnswers?.answers)
        ? params.screeningAnswers.answers.map((a: any) => a.answer)
        : [],
    },
    params.profile,
    params.rawEvidence || ''
  );

  const now = new Date().toISOString();

  return {
    id: params.id || `pkg-${params.jobId.slice(0, 16)}`,
    job_id: params.jobId,
    application_id: params.applicationId,
    user_id: params.userId,
    status: params.currentStatus || 'draft',
    route: 'website',
    company: params.company,
    role: params.role,
    job_url: params.jobUrl,
    requirements,
    gap_analysis: gapAnalysis,
    tailored_resume: params.tailoredResume || null,
    cover_letter: params.coverLetter || null,
    screening_answers: params.screeningAnswers || null,
    truthfulness: truthAudit,
    human_reviewed: params.humanReviewed || false,
    created_at: now,
    updated_at: now,
  };
}

export function approveApplicationPackage(
  pkg: ApplicationPackage,
  reviewerSignature: string
): { success: boolean; package: ApplicationPackage; error?: string } {
  if (!reviewerSignature || reviewerSignature.trim().length === 0) {
    return {
      success: false,
      package: pkg,
      error: 'Reviewer signature or explicit candidate approval confirmation is required.',
    };
  }

  // Human Review Gate: only mark ready_to_apply if truthfulness passes
  if (!pkg.truthfulness.is_truthful && pkg.truthfulness.unsupported_claims.length > 0) {
    return {
      success: false,
      package: pkg,
      error: `Cannot approve application package with unsupported claims: ${pkg.truthfulness.unsupported_claims.join('; ')}`,
    };
  }

  const now = new Date().toISOString();
  const approvedPackage: ApplicationPackage = {
    ...pkg,
    status: 'ready_to_apply',
    human_reviewed: true,
    human_approved_at: now,
    updated_at: now,
    notes: pkg.notes
      ? `${pkg.notes}\nApproved by candidate: ${reviewerSignature} at ${now}`
      : `Approved by candidate: ${reviewerSignature} at ${now}`,
  };

  return {
    success: true,
    package: approvedPackage,
  };
}
