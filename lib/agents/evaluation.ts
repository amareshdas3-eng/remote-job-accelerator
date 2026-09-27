// lib/agents/evaluation.ts
// RJA v5.0: 🧠 Autonomous Evaluation Agent (Analysis-Only)
// Milestone v5.0-alpha3: Evaluation Intelligence & Bounded Evidence Boundary
// Invariant: "Generation is never evidence."

import crypto from 'node:crypto';
import type {
  AgentProposal,
  DiscoveryProposal,
  EvaluatedRequirement,
  EvaluationAgentProposal,
  EvaluationProposal,
  EvidenceCitation,
  ProvenanceRecord,
  RequirementClassification,
  RequirementMatchStatus,
} from './types';
import type { EvidenceSnapshot } from '../execution/types';
import { EVALUATION_AGENT_CONTRACT } from './contracts';

export interface EvaluationOptions {
  reviewRequested?: boolean;
  reviewReason?: string;
  evaluatedAt?: string;
}

/**
 * Classifies a raw requirement into 'required' vs 'preferred'.
 * Heuristic parses explicit optional / preferred language.
 */
export function classifyRequirement(rawReq: string): RequirementClassification {
  if (!rawReq || typeof rawReq !== 'string') return 'required';
  const preferredRegex =
    /\b(preferred|nice to have|plus|bonus|optional|ideally|advantageous|not required|desired)\b/i;
  return preferredRegex.test(rawReq) ? 'preferred' : 'required';
}

function cleanTerm(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesWord(text: string, term: string): boolean {
  if (!text || !term) return false;
  const escaped = escapeRegExp(term.trim());
  const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}($|[^a-zA-Z0-9])`, 'i');
  return regex.test(text);
}

/**
 * Searches a candidate's verified evidence snapshot for proof supporting a job requirement.
 * Returns valid citations pointing strictly to snapshot data.
 * Does NOT generate, hallucinate, or synthesize unverified evidence.
 */
export function findEvidenceInSnapshot(
  rawRequirement: string,
  snapshot: EvidenceSnapshot
): EvidenceCitation[] {
  if (!snapshot || !snapshot.profile_data) return [];
  const citations: EvidenceCitation[] = [];
  const profile = snapshot.profile_data as any;
  const reqLower = rawRequirement.toLowerCase();

  // 1. Search candidate skills
  if (Array.isArray(profile.skills)) {
    for (const skill of profile.skills) {
      const skillStr = String(skill).trim();
      if (!skillStr) continue;
      if (matchesWord(rawRequirement, skillStr)) {
        citations.push({
          fact: skillStr,
          source_field: 'skills',
          evidence_snapshot_id: snapshot.id,
          evidence_hash: snapshot.evidence_hash,
        });
      }
    }
  }

  // 2. Search candidate certifications
  if (Array.isArray(profile.certifications)) {
    for (const cert of profile.certifications) {
      const certStr = String(cert).trim();
      if (!certStr) continue;
      if (matchesWord(rawRequirement, certStr)) {
        citations.push({
          fact: certStr,
          source_field: 'certifications',
          evidence_snapshot_id: snapshot.id,
          evidence_hash: snapshot.evidence_hash,
        });
      }
    }
  }

  // 3. Search candidate headline
  if (profile.headline && typeof profile.headline === 'string') {
    const headlineWords = profile.headline.split(/\s+/).filter((w: string) => w.length > 3);
    for (const w of headlineWords) {
      if (matchesWord(rawRequirement, w)) {
        citations.push({
          fact: profile.headline,
          source_field: 'headline',
          evidence_snapshot_id: snapshot.id,
          evidence_hash: snapshot.evidence_hash,
        });
        break;
      }
    }
  }

  // 4. Search years of experience if experience number is mentioned
  if (profile.years_experience !== undefined) {
    const years = Number(profile.years_experience);
    const expMatch = reqLower.match(/(\d+)\+?\s*(?:to\s*\d+\s*)?years?/);
    if (expMatch) {
      const requiredYears = parseInt(expMatch[1], 10);
      if (years >= requiredYears) {
        citations.push({
          fact: `${years} years experience (meets ${requiredYears}+ years requirement)`,
          source_field: 'years_experience',
          evidence_snapshot_id: snapshot.id,
          evidence_hash: snapshot.evidence_hash,
        });
      }
    }
  }

  // Deduplicate citations by fact + source_field
  const seen = new Set<string>();
  return citations.filter((c) => {
    const key = `${c.source_field}:${c.fact.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Verifies whether an evidence citation is authentic and matches the referenced snapshot.
 */
export function verifyEvidenceCitation(
  citation: EvidenceCitation,
  snapshot: EvidenceSnapshot
): boolean {
  if (!citation || !snapshot) return false;
  if (citation.evidence_snapshot_id !== snapshot.id) return false;
  if (citation.evidence_hash !== snapshot.evidence_hash) return false;

  const profile = snapshot.profile_data as any;
  if (!profile) return false;

  const fieldData = profile[citation.source_field];
  if (fieldData === undefined) return false;

  if (Array.isArray(fieldData)) {
    return fieldData.some((item) => String(item).toLowerCase() === citation.fact.toLowerCase());
  }

  if (typeof fieldData === 'string') {
    return fieldData.toLowerCase().includes(citation.fact.toLowerCase()) ||
      citation.fact.toLowerCase().includes(fieldData.toLowerCase());
  }

  if (typeof fieldData === 'number') {
    return citation.fact.includes(String(fieldData));
  }

  return false;
}

/**
 * Computes deterministic 4D match dimensions and fit score.
 */
function computeDeterministicDimensions(
  job: { title: string; requirements: string[]; skills: string[] },
  evaluatedReqs: EvaluatedRequirement[],
  matchedSkills: string[],
  missingSkills: string[],
  snapshot: EvidenceSnapshot
): {
  fitScore: number;
  tier: 'exceptional' | 'strong' | 'moderate' | 'exploratory';
  dimensions: {
    role_alignment: number;
    technical_skills: number;
    leadership: number;
    seniority_remote: number;
  };
} {
  const profile = snapshot.profile_data as any;

  // 1. Role alignment (0 - 25)
  let role_alignment = 10;
  if (profile.headline && typeof profile.headline === 'string') {
    const cleanJobTitle = cleanTerm(job.title);
    const cleanHeadline = cleanTerm(profile.headline);
    if (cleanHeadline.includes(cleanJobTitle) || cleanJobTitle.includes(cleanHeadline)) {
      role_alignment = 25;
    } else {
      role_alignment = 18;
    }
  }

  // 2. Technical skills (0 - 35)
  const totalSkills = matchedSkills.length + missingSkills.length;
  let technical_skills = 20;
  if (totalSkills > 0) {
    const ratio = matchedSkills.length / totalSkills;
    technical_skills = Math.round(ratio * 35);
  }

  // 3. Leadership (0 - 20)
  let leadership = 10;
  const isLeadJob = /\b(lead|staff|principal|head|director|manager|architect)\b/i.test(job.title);
  const isLeadCandidate = /\b(lead|staff|principal|head|director|manager|architect|pe)\b/i.test(
    profile.headline || ''
  );
  if (isLeadJob && isLeadCandidate) {
    leadership = 20;
  } else if (!isLeadJob) {
    leadership = 15;
  }

  // 4. Seniority & remote (0 - 20)
  let seniority_remote = 15;
  if (profile.years_experience && Number(profile.years_experience) >= 8) {
    seniority_remote = 20;
  }

  const fitScore = Math.min(
    100,
    Math.max(0, role_alignment + technical_skills + leadership + seniority_remote)
  );

  let tier: 'exceptional' | 'strong' | 'moderate' | 'exploratory' = 'moderate';
  if (fitScore >= 85) tier = 'exceptional';
  else if (fitScore >= 70) tier = 'strong';
  else if (fitScore >= 50) tier = 'moderate';
  else tier = 'exploratory';

  return {
    fitScore,
    tier,
    dimensions: {
      role_alignment,
      technical_skills,
      leadership,
      seniority_remote,
    },
  };
}

/**
 * Evaluates candidate evidence snapshot against a discovered job proposal.
 * STRICT INVARIANT: "Generation is never evidence."
 * Gaps cannot be upgraded to satisfied without proof in the snapshot.
 */
export async function evaluateCandidateAgainstJob(
  job: DiscoveryProposal | { title: string; company: string; requirements: string[]; skills?: string[]; jobId?: string },
  snapshot: EvidenceSnapshot,
  options?: EvaluationOptions
): Promise<EvaluationProposal> {
  if (!snapshot || !snapshot.id || !snapshot.evidence_hash) {
    throw new Error('Evaluation Agent rejected: missing valid candidate evidence snapshot');
  }

  const evaluatedAt = options?.evaluatedAt || new Date().toISOString();
  const evaluationId = `eval-${crypto.randomBytes(6).toString('hex')}`;
  const rawRequirements = Array.isArray(job.requirements) ? job.requirements : [];

  const evaluatedRequirements: EvaluatedRequirement[] = [];
  let satisfiedCount = 0;
  let gapCount = 0;
  let preferredCount = 0;

  for (let i = 0; i < rawRequirements.length; i++) {
    const rawReq = rawRequirements[i].trim();
    if (!rawReq) continue;

    const classification = classifyRequirement(rawReq);
    if (classification === 'preferred') {
      preferredCount++;
    }

    const citations = findEvidenceInSnapshot(rawReq, snapshot);
    const hasEvidence = citations.length > 0;

    let status: RequirementMatchStatus;
    let gap_description: string | undefined;

    if (hasEvidence) {
      status = 'satisfied';
      satisfiedCount++;
    } else {
      status = 'gap';
      gapCount++;
      gap_description = `No verified evidence in snapshot for: "${rawReq.slice(0, 80)}"`;
    }

    evaluatedRequirements.push({
      id: `req-${i + 1}`,
      raw_requirement: rawReq,
      classification,
      status,
      citations,
      gap_description,
    });
  }

  // Evaluate skill coverage
  const jobSkills = Array.isArray(job.skills) ? job.skills : [];
  const profileSkills = Array.isArray((snapshot.profile_data as any)?.skills)
    ? (snapshot.profile_data as any).skills.map((s: string) => String(s).toLowerCase().trim())
    : [];

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const js of jobSkills) {
    const cleanJs = js.toLowerCase().trim();
    if (profileSkills.includes(cleanJs)) {
      matchedSkills.push(js);
    } else {
      missingSkills.push(js);
    }
  }

  // Deterministic 4D fit scoring
  const { fitScore, tier, dimensions } = computeDeterministicDimensions(
    { title: job.title, requirements: rawRequirements, skills: jobSkills },
    evaluatedRequirements,
    matchedSkills,
    missingSkills,
    snapshot
  );

  // Review request logic
  const reviewRequested =
    options?.reviewRequested ?? (gapCount > 0 && tier !== 'exceptional');
  const reviewReason =
    options?.reviewReason ||
    (reviewRequested
      ? `Evaluation detected ${gapCount} qualification gap(s) requiring candidate inspection`
      : undefined);

  return {
    evaluationId,
    jobId: (job as any).jobId || 'job-discovered',
    jobTitle: job.title.trim(),
    company: job.company.trim(),
    candidateId: snapshot.candidate_id,
    evidenceSnapshotId: snapshot.id,
    evidenceHash: snapshot.evidence_hash,
    fitScore,
    tier,
    dimensions,
    evaluatedRequirements,
    satisfiedCount,
    gapCount,
    preferredCount,
    matchedSkills,
    missingSkills,
    reviewRequested,
    reviewReason,
    proposed_by: 'evaluation_agent',
    evaluatedAt,
  };
}

/**
 * Universal Provenance Envelope constructor for Evaluation proposals.
 */
export function createEvaluationProposalEnvelope(
  output: EvaluationProposal,
  snapshot: EvidenceSnapshot,
  options?: { proposalId?: string; createdAt?: string }
): EvaluationAgentProposal {
  const proposalId =
    options?.proposalId || `prop-agt-evaluation-v1-${crypto.randomBytes(6).toString('hex')}`;
  const createdAt = options?.createdAt || output.evaluatedAt || new Date().toISOString();

  // Tamper-evident evaluation provenance digest over output + snapshot evidence
  const evalHash = crypto
    .createHash('sha256')
    .update(
      `${output.evaluationId}::${output.jobId}::${snapshot.id}::${snapshot.evidence_hash}::${output.fitScore}`
    )
    .digest('hex');

  const provenance: ProvenanceRecord = {
    source: 'evaluation_agent',
    source_url: `snapshot://${snapshot.id}`,
    retrieved_at: createdAt,
    raw_hash: snapshot.evidence_hash,
    adapter_version: 'v5.0-evaluation',
    provenance_hash: evalHash,
    is_verified: true,
  };

  return {
    proposalId,
    agentId: EVALUATION_AGENT_CONTRACT.agent_id,
    agentVersion: EVALUATION_AGENT_CONTRACT.version,
    createdAt,
    inputEvidenceRefs: [snapshot.id],
    output,
    authority: {
      canExecute: false,
      canApprove: false,
      canMutateEvidence: false,
    },
    provenance,
  };
}

/**
 * Emits an Evaluation Proposal wrapped in the Universal Provenance Envelope.
 */
export async function emitEvaluationProposal(
  jobInput: DiscoveryProposal | AgentProposal<DiscoveryProposal>,
  snapshot: EvidenceSnapshot,
  options?: EvaluationOptions
): Promise<EvaluationAgentProposal> {
  const rawJob: DiscoveryProposal =
    'output' in jobInput ? (jobInput as AgentProposal<DiscoveryProposal>).output : (jobInput as DiscoveryProposal);

  const evaluation = await evaluateCandidateAgainstJob(rawJob, snapshot, options);
  return createEvaluationProposalEnvelope(evaluation, snapshot, {
    createdAt: evaluation.evaluatedAt,
  });
}
