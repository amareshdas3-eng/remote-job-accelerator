// lib/agents/experimentation.ts
// RJA v5.0: 🧪 Controlled Optimization & Experimentation Engine
// Milestone v5.0-alpha10: Controlled Optimization & Experimentation
// Governing Invariant: "An experiment may compare possible futures; it cannot alter historical truth or activate itself."

import crypto from 'node:crypto';
import type {
  AgentExperimentProposal,
  AgentProposal,
  ExperimentDataset,
  ExperimentDatasetItem,
  ExperimentMetric,
  ExperimentResult,
  IntelligenceProfile,
  IntelligenceRuleTarget,
  LearningProposal,
  ProvenanceRecord,
} from './types';
import { EXPERIMENT_AGENT_CONTRACT } from './contracts';

/**
 * Deterministic JSON stringifier ensuring stable key serialization.
 */
export function canonicalizeExperiment(val: any): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map((item) => canonicalizeExperiment(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(val).sort();
  const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalizeExperiment(val[key])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes deterministic SHA-256 hash over an object or string.
 */
export function computeExperimentHash(data: any): string {
  const serialized = typeof data === 'string' ? data : canonicalizeExperiment(data);
  return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
}

/**
 * Creates the standard immutable benchmark dataset for side-by-side replay.
 */
export function createStandardBenchmarkDataset(options?: {
  datasetId?: string;
  customItems?: ExperimentDatasetItem[];
}): ExperimentDataset {
  const datasetId = options?.datasetId || 'benchmark-dataset-v1';

  const defaultItems: ExperimentDatasetItem[] = options?.customItems || [
    {
      id: 'bench-case-01',
      candidateSnapshotId: 'cand-snap-senior-backend',
      jobId: 'job-platform-eng-01',
      historicalOutcomeId: 'out-hist-01',
      inputPayload: {
        candidateSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Distributed Systems'],
        candidateYearsExperience: 7,
        jobRequiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL'],
        jobRequiredYears: 5,
      },
    },
    {
      id: 'bench-case-02',
      candidateSnapshotId: 'cand-snap-fullstack',
      jobId: 'job-fullstack-lead-02',
      historicalOutcomeId: 'out-hist-02',
      inputPayload: {
        candidateSkills: ['React', 'Next.js', 'TypeScript', 'Tailwind'],
        candidateYearsExperience: 4,
        jobRequiredSkills: ['React', 'TypeScript', 'GraphQL'],
        jobRequiredYears: 5,
      },
    },
    {
      id: 'bench-case-03',
      candidateSnapshotId: 'cand-snap-ml-eng',
      jobId: 'job-ai-engineer-03',
      historicalOutcomeId: 'out-hist-03',
      inputPayload: {
        candidateSkills: ['Python', 'PyTorch', 'FastAPI', 'MLOps'],
        candidateYearsExperience: 6,
        jobRequiredSkills: ['Python', 'PyTorch', 'Distributed Training'],
        jobRequiredYears: 4,
      },
    },
    {
      id: 'bench-case-04',
      candidateSnapshotId: 'cand-snap-security',
      jobId: 'job-infosec-arch-04',
      historicalOutcomeId: 'out-hist-04',
      inputPayload: {
        candidateSkills: ['Cryptographic Engineering', 'Audit Logging', 'IAM', 'Compliance'],
        candidateYearsExperience: 8,
        jobRequiredSkills: ['Cryptographic Engineering', 'IAM', 'Zero Trust Architecture'],
        jobRequiredYears: 7,
      },
    },
  ];

  const sortedItems = [...defaultItems].sort((a, b) => a.id.localeCompare(b.id));
  const datasetHash = computeExperimentHash(sortedItems);

  sortedItems.forEach((item) => {
    Object.freeze(item.inputPayload);
    Object.freeze(item);
  });

  const dataset: ExperimentDataset = {
    datasetId,
    description: 'Canonical golden benchmark dataset for deterministic profile replay evaluation.',
    sampleItems: sortedItems,
    datasetHash,
    immutable: true,
  };

  Object.freeze(dataset.sampleItems);
  return Object.freeze(dataset);
}

/**
 * Validates the schema and immutability of an ExperimentDataset.
 */
export function validateDatasetIntegrity(dataset: ExperimentDataset): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (!dataset || typeof dataset !== 'object') {
    return { valid: false, violations: ['DATASET_INVALID: Dataset must be a non-null object.'] };
  }

  if (dataset.immutable !== true) {
    violations.push('DATASET_MUTABLE: ExperimentDataset must be declared immutable: true.');
  }

  if (!dataset.datasetId || !dataset.datasetHash) {
    violations.push('DATASET_SCHEMA_VIOLATION: Dataset missing datasetId or datasetHash.');
  }

  if (!Array.isArray(dataset.sampleItems) || dataset.sampleItems.length === 0) {
    violations.push('DATASET_SCHEMA_VIOLATION: Dataset sampleItems must be a non-empty array.');
  } else {
    const computedHash = computeExperimentHash(dataset.sampleItems);
    if (computedHash !== dataset.datasetHash) {
      violations.push(
        `DATASET_HASH_MISMATCH: Computed hash '${computedHash}' does not match declared '${dataset.datasetHash}'.`
      );
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Internal replay simulation helper to evaluate a benchmark case under a specific profile.
 */
function evaluateItemUnderProfile(item: ExperimentDatasetItem, profile: IntelligenceProfile): {
  fitScore: number;
  experienceScore: number;
  skillsScore: number;
  pacingSafetyMargin: number;
} {
  const expWeightRule = profile.rules.find((r) => r.parameter === 'experience_weight');
  const skillsWeightRule = profile.rules.find((r) => r.parameter === 'skills_weight');
  const maxConcurrentRule = profile.rules.find((r) => r.parameter === 'max_concurrent_applications');
  const pacingRule = profile.rules.find((r) => r.parameter === 'pacing_delay_hours');

  const expWeight = typeof expWeightRule?.value === 'number' ? expWeightRule.value : 35;
  const skillsWeight = typeof skillsWeightRule?.value === 'number' ? skillsWeightRule.value : 35;
  const maxConcurrent = typeof maxConcurrentRule?.value === 'number' ? maxConcurrentRule.value : 2;
  const pacingHours = typeof pacingRule?.value === 'number' ? pacingRule.value : 24;

  const payload = item.inputPayload;
  const candYears = typeof payload.candidateYearsExperience === 'number' ? payload.candidateYearsExperience : 0;
  const reqYears = typeof payload.jobRequiredYears === 'number' ? payload.jobRequiredYears : 1;
  const expRatio = Math.min(1.0, candYears / reqYears);
  const experienceScore = Math.round(expRatio * expWeight);

  const candSkills = Array.isArray(payload.candidateSkills) ? payload.candidateSkills : [];
  const reqSkills = Array.isArray(payload.jobRequiredSkills) ? payload.jobRequiredSkills : [];
  const matchedSkills = reqSkills.filter((s) => candSkills.includes(s));
  const skillsRatio = reqSkills.length > 0 ? matchedSkills.length / reqSkills.length : 1.0;
  const skillsScore = Math.round(skillsRatio * skillsWeight);

  const fitScore = Math.min(100, experienceScore + skillsScore);
  const pacingSafetyMargin = Math.round((pacingHours / 24) * maxConcurrent * 10);

  return {
    fitScore,
    experienceScore,
    skillsScore,
    pacingSafetyMargin,
  };
}

/**
 * Executes a deterministic side-by-side replay experiment comparing baseline vs candidate profile.
 *
 * Invariant:
 * An experiment may compare possible futures; it cannot alter historical truth or activate itself.
 */
export function runReplayExperiment(params: {
  learningProposal: LearningProposal;
  baselineProfile: IntelligenceProfile;
  candidateProfile: IntelligenceProfile;
  dataset: ExperimentDataset;
}): ExperimentResult {
  const { learningProposal, baselineProfile, candidateProfile, dataset } = params;

  if (learningProposal.currentProfileVersion !== baselineProfile.version) {
    throw new Error(
      `BASELINE_VERSION_MISMATCH: Learning proposal currentProfileVersion '${learningProposal.currentProfileVersion}' does not match baseline '${baselineProfile.version}'.`
    );
  }

  if (learningProposal.proposedProfileVersion !== candidateProfile.version) {
    throw new Error(
      `CANDIDATE_VERSION_MISMATCH: Learning proposal proposedProfileVersion '${learningProposal.proposedProfileVersion}' does not match candidate '${candidateProfile.version}'.`
    );
  }

  const datasetValidation = validateDatasetIntegrity(dataset);
  if (!datasetValidation.valid) {
    throw new Error(`DATASET_INTEGRITY_FAILED: ${datasetValidation.violations.join('; ')}`);
  }

  // Execute replay deterministically across all benchmark items
  let totalBaselineFit = 0;
  let totalCandidateFit = 0;
  let totalBaselineExp = 0;
  let totalCandidateExp = 0;
  let totalBaselineSkills = 0;
  let totalCandidateSkills = 0;
  let totalBaselinePacing = 0;
  let totalCandidatePacing = 0;

  const replayTrace: any[] = [];

  for (const item of dataset.sampleItems) {
    const baseEval = evaluateItemUnderProfile(item, baselineProfile);
    const candEval = evaluateItemUnderProfile(item, candidateProfile);

    totalBaselineFit += baseEval.fitScore;
    totalCandidateFit += candEval.fitScore;
    totalBaselineExp += baseEval.experienceScore;
    totalCandidateExp += candEval.experienceScore;
    totalBaselineSkills += baseEval.skillsScore;
    totalCandidateSkills += candEval.skillsScore;
    totalBaselinePacing += baseEval.pacingSafetyMargin;
    totalCandidatePacing += candEval.pacingSafetyMargin;

    replayTrace.push({
      itemId: item.id,
      baseline: baseEval,
      candidate: candEval,
      fitDelta: candEval.fitScore - baseEval.fitScore,
    });
  }

  const sampleCount = dataset.sampleItems.length;
  const avgBaselineFit = Math.round((totalBaselineFit / sampleCount) * 10) / 10;
  const avgCandidateFit = Math.round((totalCandidateFit / sampleCount) * 10) / 10;
  const fitDelta = Math.round((avgCandidateFit - avgBaselineFit) * 10) / 10;

  const avgBaselineExp = Math.round((totalBaselineExp / sampleCount) * 10) / 10;
  const avgCandidateExp = Math.round((totalCandidateExp / sampleCount) * 10) / 10;
  const expDelta = Math.round((avgCandidateExp - avgBaselineExp) * 10) / 10;

  const avgBaselineSkills = Math.round((totalBaselineSkills / sampleCount) * 10) / 10;
  const avgCandidateSkills = Math.round((totalCandidateSkills / sampleCount) * 10) / 10;
  const skillsDelta = Math.round((avgCandidateSkills - avgBaselineSkills) * 10) / 10;

  const avgBaselinePacing = Math.round((totalBaselinePacing / sampleCount) * 10) / 10;
  const avgCandidatePacing = Math.round((totalCandidatePacing / sampleCount) * 10) / 10;
  const pacingDelta = Math.round((avgCandidatePacing - avgBaselinePacing) * 10) / 10;

  const metrics: ExperimentMetric[] = [
    {
      metricName: 'mean_fit_score',
      targetRule: 'EVALUATION_RULE',
      parameter: 'fit_score',
      baselineValue: avgBaselineFit,
      candidateValue: avgCandidateFit,
      delta: fitDelta,
      status: fitDelta > 0 ? 'IMPROVED' : fitDelta < 0 ? 'REGRESSED' : 'UNCHANGED',
    },
    {
      metricName: 'experience_alignment_score',
      targetRule: 'EVALUATION_RULE',
      parameter: 'experience_weight',
      baselineValue: avgBaselineExp,
      candidateValue: avgCandidateExp,
      delta: expDelta,
      status: expDelta > 0 ? 'IMPROVED' : expDelta < 0 ? 'REGRESSED' : 'UNCHANGED',
    },
    {
      metricName: 'skills_alignment_score',
      targetRule: 'EVALUATION_RULE',
      parameter: 'skills_weight',
      baselineValue: avgBaselineSkills,
      candidateValue: avgCandidateSkills,
      delta: skillsDelta,
      status: skillsDelta > 0 ? 'IMPROVED' : skillsDelta < 0 ? 'REGRESSED' : 'UNCHANGED',
    },
    {
      metricName: 'pacing_safety_margin',
      targetRule: 'PLANNING_RULE',
      parameter: 'pacing_delay_hours',
      baselineValue: avgBaselinePacing,
      candidateValue: avgCandidatePacing,
      delta: pacingDelta,
      status: pacingDelta > 0 ? 'IMPROVED' : pacingDelta < 0 ? 'REGRESSED' : 'UNCHANGED',
    },
  ];

  // Detect regressions across metrics
  const regressionsDetected = metrics.filter((m) => m.status === 'REGRESSED').length;
  const improvementsDetected = metrics.filter((m) => m.status === 'IMPROVED').length;

  const overallStatus: 'PASS' | 'FAIL' = regressionsDetected === 0 ? 'PASS' : 'FAIL';
  const recommendation: 'APPROVE_FOR_REVIEW' | 'REJECT_REGRESSION' =
    overallStatus === 'PASS' ? 'APPROVE_FOR_REVIEW' : 'REJECT_REGRESSION';

  const replayHash = computeExperimentHash({
    baselineVersion: baselineProfile.version,
    candidateVersion: candidateProfile.version,
    datasetHash: dataset.datasetHash,
    metrics,
    replayTrace,
  });

  const experimentId = `exp-${computeExperimentHash(
    `${learningProposal.learningId}:${baselineProfile.version}:${candidateProfile.version}:${dataset.datasetHash}`
  ).substring(0, 16)}`;

  const result: ExperimentResult = {
    experimentId,
    learningProposalId: learningProposal.learningId,
    baselineProfileVersion: baselineProfile.version,
    candidateProfileVersion: candidateProfile.version,
    datasetHash: dataset.datasetHash,
    datasetSize: sampleCount,
    metrics,
    regressionsDetected,
    improvementsDetected,
    overallStatus,
    replayHash,
    recommendation,
    createdAt: new Date().toISOString(),
    created_by: 'controlled_experimentation',
    immutable: true,
  };

  metrics.forEach((m) => Object.freeze(m));
  Object.freeze(result.metrics);
  return Object.freeze(result);
}

/**
 * Creates the Universal Provenance Envelope wrapping an ExperimentResult.
 */
export function createExperimentProposalEnvelope(
  experimentResult: ExperimentResult,
  learningProposal: LearningProposal
): AgentExperimentProposal {
  const proposalId = `prop-exp-${experimentResult.experimentId}`;
  const now = new Date().toISOString();

  const provenanceHash = computeExperimentHash({
    proposalId,
    experimentResult,
    learningProposalId: learningProposal.learningId,
    agentId: EXPERIMENT_AGENT_CONTRACT.agent_id,
    agentVersion: EXPERIMENT_AGENT_CONTRACT.version,
  });

  const provenance: ProvenanceRecord = {
    source: 'controlled_experimentation_engine',
    source_url: 'internal://experimentation',
    retrieved_at: now,
    raw_hash: computeExperimentHash(experimentResult),
    adapter_version: '1.0.0',
    provenance_hash: provenanceHash,
    is_verified: true,
  };

  return {
    proposalId,
    agentId: EXPERIMENT_AGENT_CONTRACT.agent_id,
    agentVersion: EXPERIMENT_AGENT_CONTRACT.version,
    createdAt: now,
    inputEvidenceRefs: [
      `learning://${learningProposal.learningId}`,
      `dataset://${experimentResult.datasetHash}`,
      `profile-baseline://${experimentResult.baselineProfileVersion}`,
      `profile-candidate://${experimentResult.candidateProfileVersion}`,
    ].sort(),
    output: experimentResult,
    authority: {
      canExecute: false,
      canApprove: false,
      canMutateEvidence: false,
    },
    provenance,
  };
}

/**
 * Verifies the integrity of an ExperimentResult against reference learning proposal and dataset.
 */
export function verifyExperimentIntegrity(params: {
  result: ExperimentResult;
  learningProposal: LearningProposal;
  dataset: ExperimentDataset;
}): { valid: boolean; violations: string[] } {
  const { result, learningProposal, dataset } = params;
  const violations: string[] = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, violations: ['EXPERIMENT_INVALID: Experiment result must be a non-null object.'] };
  }

  if (result.immutable !== true) {
    violations.push('EXPERIMENT_MUTABLE: Experiment result must be declared immutable: true.');
  }

  if (result.learningProposalId !== learningProposal.learningId) {
    violations.push(
      `LEARNING_PROPOSAL_MISMATCH: Experiment references learningProposalId '${result.learningProposalId}' but provided '${learningProposal.learningId}'.`
    );
  }

  if (result.datasetHash !== dataset.datasetHash) {
    violations.push(
      `DATASET_HASH_MISMATCH: Experiment datasetHash '${result.datasetHash}' does not match benchmark '${dataset.datasetHash}'.`
    );
  }

  if (result.baselineProfileVersion !== learningProposal.currentProfileVersion) {
    violations.push(
      `BASELINE_VERSION_MISMATCH: Experiment baseline '${result.baselineProfileVersion}' does not match learning proposal '${learningProposal.currentProfileVersion}'.`
    );
  }

  if (result.candidateProfileVersion !== learningProposal.proposedProfileVersion) {
    violations.push(
      `CANDIDATE_VERSION_MISMATCH: Experiment candidate '${result.candidateProfileVersion}' does not match learning proposal '${learningProposal.proposedProfileVersion}'.`
    );
  }

  // Recommendation consistency
  if (result.regressionsDetected > 0 && result.recommendation === 'APPROVE_FOR_REVIEW') {
    violations.push(
      `INVALID_RECOMMENDATION: Experiment has ${result.regressionsDetected} regressions but recommended APPROVE_FOR_REVIEW.`
    );
  }

  if (result.overallStatus === 'FAIL' && result.recommendation === 'APPROVE_FOR_REVIEW') {
    violations.push(`INVALID_RECOMMENDATION: Failed experiment cannot be recommended for approval.`);
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
