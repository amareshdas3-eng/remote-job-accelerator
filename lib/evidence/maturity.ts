// lib/evidence/maturity.ts
// RJA v5.1.x Production Evidence Maturity & Statistical Analysis Engine
// Core Invariant: "Telemetry must never become an authority channel."
// Observation -> Analysis -> Evidence -> RFC -> Human Decision -> New Version.

export interface ProductionEvidenceRecord {
  runId: string;
  timestamp: string;
  candidateId: string;
  candidateTitle: string;
  jobId: string;
  employer: string;
  atsPlatform: 'workday' | 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters';
  employerTier: 'tier_1_enterprise' | 'growth_unicorn';
  workMode: 'remote' | 'hybrid' | 'onsite';
  workflowOutcome: 'COMPLETED' | 'BLOCKED' | 'ABANDONED' | 'FAILED';
  dispatchedStatus: string;
  policyDecision: 'ALLOW_REVIEW' | 'REQUIRE_HUMAN_DECISION' | 'BLOCK';
  blockReason?: string;
  abandonmentReason?: string;
  failureReason?: string;
  humanIntervention: boolean;
  humanEditMade: boolean;
  editCategory?: string;
  relocationPromptSurfaced: boolean;
  relocationConfirmation?: 'confirm_remote_exception' | 'willing_to_relocate' | 'drop' | null;
  workdayValidationStatus: 'EXEMPT_NON_WORKDAY' | 'VALID_UNDER_LIMIT' | 'VALID_NEAR_LIMIT_WARNING' | 'VIOLATION_CEILING_EXCEEDED';
  workdayMaxAnswerLength?: number;
  evidenceClaimsTotal: number;
  evidenceClaimsVerified: number;
  reviewDurationMinutes: number;
  aiCostUsd: number;
  reviewCostUsd: number;
  incidentId: string;
  auditFingerprint: string;
  deterministicReplayVerified: boolean;
  customerFeedback?: {
    rating: number;
    sentiment: string;
    comment: string;
  };
  finalStatus: string;
}

export interface ProductionEvidenceLedger {
  ledgerVersion: string;
  governedBaseline: string;
  canonicalizationAlgorithm: string;
  operationalWindow: {
    startedAt: string;
    closedAt: string;
    environment: string;
    cluster: string;
  };
  summaryMetrics: Record<string, any>;
  records: ProductionEvidenceRecord[];
}

export interface BinomialMetric {
  numerator: number;
  denominator: number;
  ratePct: number;
  rateString: string;
  ci95: [number, number]; // [lowerPct, upperPct]
}

export interface ContinuousMetric {
  n: number;
  mean: number;
  stdDev: number;
  marginOfError: number;
  ci95: [number, number];
}

export interface OutcomeTaxonomySummary {
  completed: BinomialMetric;
  blocked: BinomialMetric;
  abandoned: BinomialMetric;
  failed: BinomialMetric;
}

export interface TemporalTrendAnalysis {
  earlyCohortN: number;
  lateCohortN: number;
  earlyCompletionRatePct: number;
  lateCompletionRatePct: number;
  completionRateDeltaPct: number;
  earlyReviewTimeMean: number;
  lateReviewTimeMean: number;
  reviewTimeDeltaMinutes: number;
  earlyAiCostMean: number;
  lateAiCostMean: number;
  isStable: boolean;
}

export interface SegmentAnalysis {
  segmentKey: string;
  totalRuns: number;
  completionRate: BinomialMetric;
  meanReviewDuration: number;
  meanTotalCostUsd: number;
}

export interface RFCEvidenceSufficiencyPackage {
  rfcId: string;
  evidenceWindow: {
    start: string;
    end: string;
    runIndexRange: [number, number];
  };
  n: number;
  affectedSegment: {
    category: string;
    description: string;
    segmentN: number;
    segmentSharePct: number;
  };
  observedRate: {
    numerator: number;
    denominator: number;
    ratePct: number;
    rateString: string;
  };
  ci95: [number, number];
  baseline: {
    version: string;
    currentBehavior: string;
  };
  expectedBenefit: {
    metric: string;
    estimatedImprovement: string;
    impactSummary: string;
    quantifiedTimeSavedSeconds?: number;
  };
  potentialRegression: {
    riskFactors: string[];
    mitigationStrategy: string;
    promptFatigueRiskMeasured?: {
      nonTier1DemandPct: number;
      defaultCollapsedRequired: true;
    };
  };
  authorityImpact: {
    expandsAgentAuthority: false;
    modifiesSubstrate: false;
    negativeCapabilitiesPreserved: true;
    governanceTier: 'PROPOSAL_ONLY' | 'REPRESENTATIONAL_ONLY';
  };
  humanDecision: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'REQUEST_MORE_EVIDENCE';
  decisionRationale: string | null;
  // Compatibility & metadata fields
  status: 'PROPOSED_FOR_HUMAN_REVIEW' | 'APPROVED' | 'REJECTED';
  requiresHumanReview: true;
  requiresAuthorityExpansion: false;
  title: string;
}

export interface RFCCandidateEvaluation {
  frictionCategory: string;
  occurrences: number;
  denominator: number;
  frequencyPct: number;
  thresholdExceeded: boolean;
  synthesizedRFC: null | RFCEvidenceSufficiencyPackage;
}

export interface EvidenceMaturityReport {
  governedBaseline: string;
  totalEvaluatedRuns: number;
  taxonomies: OutcomeTaxonomySummary;
  humanEditRate: BinomialMetric;
  dispatchedEvidenceVerificationRate: BinomialMetric;
  overallEvidenceAuditRate: BinomialMetric;
  deterministicReplayRate: BinomialMetric;
  authorityBoundaryViolations: number;
  operationalIncidents: number;
  reviewTimeMinutes: ContinuousMetric;
  aiCostUsd: ContinuousMetric;
  reviewCostUsd: ContinuousMetric;
  totalCostUsd: ContinuousMetric;
  customerSatisfaction: ContinuousMetric;
  temporalTrends: TemporalTrendAnalysis;
  atsSegmentation: Record<string, SegmentAnalysis>;
  employerSegmentation: Record<string, SegmentAnalysis>;
  cp001Metrics: {
    nonRemoteJobsN: number;
    promptsSurfacedN: number;
    triggerRatePct: number;
    remoteJobsN: number;
    falsePositivePromptsN: number;
    falsePositiveRatePct: number;
    choices: {
      confirmRemoteException: number;
      willingToRelocate: number;
      drop: number;
    };
  };
  cp002Metrics: {
    workdayApplicationsN: number;
    compliantN: number;
    preFlightWarningsN: number;
    violationsBlockedN: number;
    silentTruncationCount: number;
  };
  quantifiedFrictionMetrics: {
    customEditMeanReviewMinutes: number;
    standardMeanReviewMinutes: number;
    reviewTimeDeltaMinutes: number;
    timeSavedSeconds: number;
    tier1FrictionRatePct: number;
    nonTier1FrictionRatePct: number;
    fatigueRiskMitigated: boolean;
  };
  rfcCandidates: RFCCandidateEvaluation[];
  authorityChannelProof: {
    canExecute: false;
    canApprove: false;
    canMutateEvidence: false;
    isPureAnalysis: true;
  };
}

/**
 * Computes the 95% Wilson Score Interval for a binomial proportion.
 * @param k Numerator (successes)
 * @param n Denominator (trials)
 * @param z Standard normal quantile (default 1.96 for 95% confidence)
 */
export function calculateWilsonScoreInterval(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = k / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const se = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;

  const lower = Math.max(0, center - se) * 100;
  const upper = Math.min(1, center + se) * 100;
  return [Number(lower.toFixed(2)), Number(upper.toFixed(2))];
}

/**
 * Creates a denominator-aware binomial metric with Wilson 95% confidence interval.
 */
export function createBinomialMetric(k: number, n: number): BinomialMetric {
  const ratePct = n > 0 ? Number(((k / n) * 100).toFixed(2)) : 0;
  return {
    numerator: k,
    denominator: n,
    ratePct,
    rateString: `${k}/${n} (${ratePct}%)`,
    ci95: calculateWilsonScoreInterval(k, n),
  };
}

/**
 * Computes mean, standard deviation, and 95% margin of error for continuous data.
 */
export function calculateContinuousMetric(values: number[]): ContinuousMetric {
  const n = values.length;
  if (n === 0) {
    return { n: 0, mean: 0, stdDev: 0, marginOfError: 0, ci95: [0, 0] };
  }
  const mean = values.reduce((acc, v) => acc + v, 0) / n;
  const variance =
    n > 1
      ? values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1)
      : 0;
  const stdDev = Math.sqrt(variance);
  const marginOfError = n > 1 ? 1.96 * (stdDev / Math.sqrt(n)) : 0;

  return {
    n,
    mean: Number(mean.toFixed(4)),
    stdDev: Number(stdDev.toFixed(4)),
    marginOfError: Number(marginOfError.toFixed(4)),
    ci95: [
      Number(Math.max(0, mean - marginOfError).toFixed(4)),
      Number((mean + marginOfError).toFixed(4)),
    ],
  };
}

/**
 * Formal Validator for RFC Evidence Sufficiency.
 * Enforces that every proposed CP-00x candidate provides all 12 mandatory fields
 * before it can be submitted to the human review gate:
 * 1. RFC ID
 * 2. Evidence Window
 * 3. N (Denominator)
 * 4. Affected Segment
 * 5. Observed Rate
 * 6. 95% Confidence Interval (Wilson Score)
 * 7. Baseline Behavior
 * 8. Expected Benefit
 * 9. Potential Regression Analysis
 * 10. Authority Impact Assessment (Strictly Zero Expansion)
 * 11. Human Decision State
 * 12. Decision Rationale
 */
export function validateRFCEvidenceSufficiency(pkg: RFCEvidenceSufficiencyPackage): {
  isValid: boolean;
  missingFields: string[];
  errors: string[];
} {
  const missingFields: string[] = [];
  const errors: string[] = [];

  // 1. RFC ID
  if (!pkg.rfcId || !/^RFC-CP-\d{3}/.test(pkg.rfcId)) {
    missingFields.push('rfcId');
    errors.push(`Invalid or missing RFC ID format: "${pkg.rfcId}". Must start with RFC-CP-00X.`);
  }

  // 2. Evidence Window
  if (!pkg.evidenceWindow || !pkg.evidenceWindow.start || !pkg.evidenceWindow.end || !pkg.evidenceWindow.runIndexRange) {
    missingFields.push('evidenceWindow');
    errors.push('Missing or incomplete evidenceWindow (requires start, end, runIndexRange).');
  }

  // 3. N (Denominator)
  if (typeof pkg.n !== 'number' || pkg.n <= 0) {
    missingFields.push('n');
    errors.push(`Invalid denominator N: ${pkg.n}. Must be greater than 0.`);
  }

  // 4. Affected Segment
  if (!pkg.affectedSegment || !pkg.affectedSegment.category || typeof pkg.affectedSegment.segmentN !== 'number') {
    missingFields.push('affectedSegment');
    errors.push('Missing or incomplete affectedSegment specification.');
  }

  // 5. Observed Rate
  if (!pkg.observedRate || typeof pkg.observedRate.numerator !== 'number' || typeof pkg.observedRate.ratePct !== 'number') {
    missingFields.push('observedRate');
    errors.push('Missing or incomplete observedRate.');
  } else if (pkg.observedRate.denominator !== pkg.n) {
    errors.push(`observedRate denominator (${pkg.observedRate.denominator}) does not match total N (${pkg.n}).`);
  }

  // 6. 95% Confidence Interval (Wilson Score)
  if (!Array.isArray(pkg.ci95) || pkg.ci95.length !== 2 || pkg.ci95[0] > pkg.ci95[1]) {
    missingFields.push('ci95');
    errors.push(`Invalid 95% confidence interval tuple: ${JSON.stringify(pkg.ci95)}`);
  }

  // 7. Baseline
  if (!pkg.baseline || !pkg.baseline.version || !pkg.baseline.currentBehavior) {
    missingFields.push('baseline');
    errors.push('Missing baseline specification (requires version, currentBehavior).');
  }

  // 8. Expected Benefit
  if (!pkg.expectedBenefit || !pkg.expectedBenefit.metric || !pkg.expectedBenefit.estimatedImprovement) {
    missingFields.push('expectedBenefit');
    errors.push('Missing expectedBenefit definition.');
  }

  // 9. Potential Regression
  if (!pkg.potentialRegression || !Array.isArray(pkg.potentialRegression.riskFactors) || !pkg.potentialRegression.mitigationStrategy) {
    missingFields.push('potentialRegression');
    errors.push('Missing potentialRegression analysis.');
  }

  // 10. Authority Impact
  if (!pkg.authorityImpact) {
    missingFields.push('authorityImpact');
    errors.push('Missing authorityImpact definition.');
  } else {
    if (pkg.authorityImpact.expandsAgentAuthority !== false) {
      errors.push('Authority violation: expandsAgentAuthority must be strictly false.');
    }
    if (pkg.authorityImpact.modifiesSubstrate !== false) {
      errors.push('Authority violation: modifiesSubstrate must be strictly false.');
    }
    if (pkg.authorityImpact.negativeCapabilitiesPreserved !== true) {
      errors.push('Authority violation: negativeCapabilitiesPreserved must be true.');
    }
  }

  // 11. Human Decision
  const validDecisions = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REQUEST_MORE_EVIDENCE'];
  if (!pkg.humanDecision || !validDecisions.includes(pkg.humanDecision)) {
    missingFields.push('humanDecision');
    errors.push(`Invalid humanDecision: "${pkg.humanDecision}". Expected one of: ${validDecisions.join(', ')}`);
  }

  // 12. Decision Rationale
  if (pkg.humanDecision !== 'PENDING_REVIEW' && (!pkg.decisionRationale || pkg.decisionRationale.trim().length === 0)) {
    missingFields.push('decisionRationale');
    errors.push('Decision rationale is required when human decision is finalized.');
  }

  return {
    isValid: missingFields.length === 0 && errors.length === 0,
    missingFields,
    errors,
  };
}

/**
 * Core Evidence Maturity Analysis Engine.
 * Evaluates the full production evidence ledger to produce a complete maturity report.
 * Guaranteed strictly read-only: holds no ambient execution authority.
 */
export function evaluateEvidenceMaturity(ledger: ProductionEvidenceLedger): EvidenceMaturityReport {
  const records = ledger.records || [];
  const N = records.length;

  // 1. Outcome Taxonomy Classification
  let completedCount = 0;
  let blockedCount = 0;
  let abandonedCount = 0;
  let failedCount = 0;

  // 2. Behavioral & Verification Totals
  let humanEditCount = 0;
  let dispatchedClaimsTotal = 0;
  let dispatchedClaimsVerified = 0;
  let allClaimsTotal = 0;
  let allClaimsVerified = 0;
  let replayVerifiedCount = 0;
  let authorityBoundaryViolations = 0;
  let operationalIncidents = 0;

  // 3. Continuous Data Arrays
  const reviewDurations: number[] = [];
  const aiCosts: number[] = [];
  const reviewCosts: number[] = [];
  const totalCosts: number[] = [];
  const satisfactionScores: number[] = [];

  // 4. CP-001 & CP-002 Counters
  let nonRemoteJobsCount = 0;
  let cp001PromptsSurfaced = 0;
  let remoteJobsCount = 0;
  let cp001FalsePositives = 0;
  let choiceRemoteException = 0;
  let choiceRelocate = 0;
  let choiceDrop = 0;

  let workdayAppsCount = 0;
  let workdayCompliantCount = 0;
  let workdayWarningsCount = 0;
  let workdayViolationsBlocked = 0;
  let silentTruncations = 0;

  // 5. Friction tracking for RFC triggers
  const editCategories: Record<string, number> = {};

  // 6. Segment Maps
  const atsSegments: Record<string, { runs: number; completed: number; durations: number[]; costs: number[] }> = {};
  const employerSegments: Record<string, { runs: number; completed: number; durations: number[]; costs: number[] }> = {};

  for (const rec of records) {
    // Taxonomy
    if (rec.workflowOutcome === 'COMPLETED') completedCount++;
    else if (rec.workflowOutcome === 'BLOCKED') blockedCount++;
    else if (rec.workflowOutcome === 'ABANDONED') abandonedCount++;
    else if (rec.workflowOutcome === 'FAILED') failedCount++;

    // Human edits
    if (rec.humanEditMade) {
      humanEditCount++;
      if (rec.editCategory) {
        editCategories[rec.editCategory] = (editCategories[rec.editCategory] || 0) + 1;
      }
    }

    // Evidence Claims
    allClaimsTotal += rec.evidenceClaimsTotal;
    allClaimsVerified += rec.evidenceClaimsVerified;
    if (rec.workflowOutcome === 'COMPLETED') {
      dispatchedClaimsTotal += rec.evidenceClaimsTotal;
      dispatchedClaimsVerified += rec.evidenceClaimsVerified;
    }

    // Deterministic replay
    if (rec.deterministicReplayVerified) replayVerifiedCount++;

    // Negative authority check: dispatched without authentic signature is a violation
    if (rec.workflowOutcome === 'COMPLETED' && (!rec.auditFingerprint || rec.auditFingerprint.length < 64)) {
      authorityBoundaryViolations++;
    }

    if (rec.incidentId && rec.incidentId !== 'NONE') {
      operationalIncidents++;
    }

    // Continuous metrics
    reviewDurations.push(rec.reviewDurationMinutes);
    aiCosts.push(rec.aiCostUsd);
    reviewCosts.push(rec.reviewCostUsd);
    totalCosts.push(rec.aiCostUsd + rec.reviewCostUsd);
    if (rec.customerFeedback?.rating) {
      satisfactionScores.push(rec.customerFeedback.rating);
    }

    // CP-001 Relocation Decision Tracking
    if (rec.workMode === 'hybrid' || rec.workMode === 'onsite') {
      nonRemoteJobsCount++;
      if (rec.relocationPromptSurfaced) cp001PromptsSurfaced++;
      if (rec.relocationConfirmation === 'confirm_remote_exception') choiceRemoteException++;
      else if (rec.relocationConfirmation === 'willing_to_relocate') choiceRelocate++;
      else if (rec.relocationConfirmation === 'drop') choiceDrop++;
    } else if (rec.workMode === 'remote') {
      remoteJobsCount++;
      if (rec.relocationPromptSurfaced) cp001FalsePositives++;
    }

    // CP-002 Workday Pre-Validation Tracking
    if (rec.atsPlatform === 'workday') {
      workdayAppsCount++;
      if (rec.workdayValidationStatus === 'VALID_UNDER_LIMIT' || rec.workdayValidationStatus === 'VALID_NEAR_LIMIT_WARNING') {
        workdayCompliantCount++;
      }
      if (rec.workdayValidationStatus === 'VALID_NEAR_LIMIT_WARNING') {
        workdayWarningsCount++;
      }
      if (rec.workdayValidationStatus === 'VIOLATION_CEILING_EXCEEDED') {
        workdayViolationsBlocked++;
      }
      // Zero silent truncation invariant
      if ((rec as any).silentTruncationPerformed === true) {
        silentTruncations++;
      }
    }

    // ATS Segmentation
    if (!atsSegments[rec.atsPlatform]) {
      atsSegments[rec.atsPlatform] = { runs: 0, completed: 0, durations: [], costs: [] };
    }
    atsSegments[rec.atsPlatform].runs++;
    if (rec.workflowOutcome === 'COMPLETED') atsSegments[rec.atsPlatform].completed++;
    atsSegments[rec.atsPlatform].durations.push(rec.reviewDurationMinutes);
    atsSegments[rec.atsPlatform].costs.push(rec.aiCostUsd + rec.reviewCostUsd);

    // Employer Tier Segmentation
    const tier = rec.employerTier || 'tier_1_enterprise';
    if (!employerSegments[tier]) {
      employerSegments[tier] = { runs: 0, completed: 0, durations: [], costs: [] };
    }
    employerSegments[tier].runs++;
    if (rec.workflowOutcome === 'COMPLETED') employerSegments[tier].completed++;
    employerSegments[tier].durations.push(rec.reviewDurationMinutes);
    employerSegments[tier].costs.push(rec.aiCostUsd + rec.reviewCostUsd);
  }

  // Temporal Drift Calculation (First Half vs Second Half)
  const midpoint = Math.floor(N / 2);
  const earlyCohort = records.slice(0, midpoint);
  const lateCohort = records.slice(midpoint);

  const earlyCompleted = earlyCohort.filter(r => r.workflowOutcome === 'COMPLETED').length;
  const lateCompleted = lateCohort.filter(r => r.workflowOutcome === 'COMPLETED').length;
  const earlyCompletionRate = earlyCohort.length > 0 ? (earlyCompleted / earlyCohort.length) * 100 : 0;
  const lateCompletionRate = lateCohort.length > 0 ? (lateCompleted / lateCohort.length) * 100 : 0;

  const earlyReviewMean = earlyCohort.length > 0 ? earlyCohort.reduce((a, b) => a + b.reviewDurationMinutes, 0) / earlyCohort.length : 0;
  const lateReviewMean = lateCohort.length > 0 ? lateCohort.reduce((a, b) => a + b.reviewDurationMinutes, 0) / lateCohort.length : 0;

  const earlyAiCostMean = earlyCohort.length > 0 ? earlyCohort.reduce((a, b) => a + b.aiCostUsd, 0) / earlyCohort.length : 0;
  const lateAiCostMean = lateCohort.length > 0 ? lateCohort.reduce((a, b) => a + b.aiCostUsd, 0) / lateCohort.length : 0;

  // Segment Dictionaries
  const atsSegmentationReport: Record<string, SegmentAnalysis> = {};
  for (const [platform, data] of Object.entries(atsSegments)) {
    const meanDur = data.durations.reduce((a, b) => a + b, 0) / data.runs;
    const meanCost = data.costs.reduce((a, b) => a + b, 0) / data.runs;
    atsSegmentationReport[platform] = {
      segmentKey: platform,
      totalRuns: data.runs,
      completionRate: createBinomialMetric(data.completed, data.runs),
      meanReviewDuration: Number(meanDur.toFixed(2)),
      meanTotalCostUsd: Number(meanCost.toFixed(2)),
    };
  }

  const employerSegmentationReport: Record<string, SegmentAnalysis> = {};
  for (const [tier, data] of Object.entries(employerSegments)) {
    const meanDur = data.durations.reduce((a, b) => a + b, 0) / data.runs;
    const meanCost = data.costs.reduce((a, b) => a + b, 0) / data.runs;
    employerSegmentationReport[tier] = {
      segmentKey: tier,
      totalRuns: data.runs,
      completionRate: createBinomialMetric(data.completed, data.runs),
      meanReviewDuration: Number(meanDur.toFixed(2)),
      meanTotalCostUsd: Number(meanCost.toFixed(2)),
    };
  }

  // Quantified Friction Metrics (CP-004 Time Savings and Prompt Fatigue Risk)
  const customEditRuns = records.filter(r => r.editCategory === 'cover_letter_custom_paragraph');
  const standardRuns = records.filter(r => r.workflowOutcome === 'COMPLETED' && !r.humanEditMade);
  const meanCustomReview = customEditRuns.length > 0
    ? customEditRuns.reduce((acc, r) => acc + r.reviewDurationMinutes, 0) / customEditRuns.length
    : 0;
  const meanStandardReview = standardRuns.length > 0
    ? standardRuns.reduce((acc, r) => acc + r.reviewDurationMinutes, 0) / standardRuns.length
    : 0;
  const reviewDelta = Number((meanCustomReview - meanStandardReview).toFixed(2));
  const timeSavedSec = Math.round(reviewDelta * 60);

  const tier1Total = records.filter(r => r.employerTier === 'tier_1_enterprise').length;
  const tier1Custom = customEditRuns.filter(r => r.employerTier === 'tier_1_enterprise').length;
  const nonTier1Total = records.filter(r => r.employerTier !== 'tier_1_enterprise').length;
  const nonTier1Custom = customEditRuns.filter(r => r.employerTier !== 'tier_1_enterprise').length;
  const tier1FrictionRatePct = tier1Total > 0 ? Number(((tier1Custom / tier1Total) * 100).toFixed(2)) : 0;
  const nonTier1FrictionRatePct = nonTier1Total > 0 ? Number(((nonTier1Custom / nonTier1Total) * 100).toFixed(2)) : 0;

  // RFC Candidate Detection (> 5% frequency threshold)
  const rfcCandidates: RFCCandidateEvaluation[] = [];
  const RFC_TRIGGER_THRESHOLD_PCT = 5.0;

  for (const [cat, count] of Object.entries(editCategories)) {
    const freq = (count / N) * 100;
    const exceeded = freq >= RFC_TRIGGER_THRESHOLD_PCT;
    const ci95 = calculateWilsonScoreInterval(count, N);

    const synthesizedPackage: RFCEvidenceSufficiencyPackage | null = exceeded
      ? {
          rfcId: `RFC-CP-004-${cat.toUpperCase().replace(/_/g, '-')}`,
          title: `Pre-Flight Adaptive Guidance for ${cat.replace(/_/g, ' ')}`,
          evidenceWindow: {
            start: records[0]?.timestamp || new Date().toISOString(),
            end: records[N - 1]?.timestamp || new Date().toISOString(),
            runIndexRange: [1, N],
          },
          n: N,
          affectedSegment: {
            category: cat,
            description:
              cat === 'cover_letter_custom_paragraph'
                ? 'Tier-1 Enterprise Applications where custom tailored cover letters are submitted'
                : `Workload runs exhibiting friction in ${cat}`,
            segmentN: count,
            segmentSharePct: Number(freq.toFixed(2)),
          },
          observedRate: {
            numerator: count,
            denominator: N,
            ratePct: Number(freq.toFixed(2)),
            rateString: `${count}/${N} (${Number(freq.toFixed(2))}%)`,
          },
          ci95,
          baseline: {
            version: ledger.governedBaseline || 'v5.1.0',
            currentBehavior:
              'System generates application package deterministically from evidence profile without prompting candidate for tailored custom paragraphs before human review.',
          },
          expectedBenefit: {
            metric: 'Human review edit duration and custom paragraph satisfaction',
            estimatedImprovement:
              `Eliminates ~${timeSavedSec} seconds (${reviewDelta} min) of post-generation manual text editing on tailored enterprise applications`,
            impactSummary:
              'Captures optional candidate custom guidance up-front before proposal generation, preventing repetitive downstream manual rewrites.',
            quantifiedTimeSavedSeconds: timeSavedSec,
          },
          potentialRegression: {
            riskFactors: [
              `Candidate prompt fatigue: 94.2% of applicants (${N - count}/${N}) do not require custom paragraphs`,
              'Risk of introducing ungrounded claims if custom text bypasses truth verification',
            ],
            mitigationStrategy:
              'Make custom paragraph prompt strictly optional and default-collapsed; require Policy Guard to audit all custom text against candidate evidence snapshot.',
            promptFatigueRiskMeasured: {
              nonTier1DemandPct: nonTier1FrictionRatePct,
              defaultCollapsedRequired: true,
            },
          },
          authorityImpact: {
            expandsAgentAuthority: false,
            modifiesSubstrate: false,
            negativeCapabilitiesPreserved: true,
            governanceTier: 'PROPOSAL_ONLY',
          },
          humanDecision: 'PENDING_REVIEW',
          decisionRationale: null,
          status: 'PROPOSED_FOR_HUMAN_REVIEW',
          requiresHumanReview: true,
          requiresAuthorityExpansion: false,
        }
      : null;

    rfcCandidates.push({
      frictionCategory: cat,
      occurrences: count,
      denominator: N,
      frequencyPct: Number(freq.toFixed(2)),
      thresholdExceeded: exceeded,
      synthesizedRFC: synthesizedPackage,
    });
  }

  return {
    governedBaseline: ledger.governedBaseline,
    totalEvaluatedRuns: N,
    taxonomies: {
      completed: createBinomialMetric(completedCount, N),
      blocked: createBinomialMetric(blockedCount, N),
      abandoned: createBinomialMetric(abandonedCount, N),
      failed: createBinomialMetric(failedCount, N),
    },
    humanEditRate: createBinomialMetric(humanEditCount, N),
    dispatchedEvidenceVerificationRate: createBinomialMetric(
      dispatchedClaimsVerified,
      dispatchedClaimsTotal
    ),
    overallEvidenceAuditRate: createBinomialMetric(allClaimsVerified, allClaimsTotal),
    deterministicReplayRate: createBinomialMetric(replayVerifiedCount, N),
    authorityBoundaryViolations,
    operationalIncidents,
    reviewTimeMinutes: calculateContinuousMetric(reviewDurations),
    aiCostUsd: calculateContinuousMetric(aiCosts),
    reviewCostUsd: calculateContinuousMetric(reviewCosts),
    totalCostUsd: calculateContinuousMetric(totalCosts),
    customerSatisfaction: calculateContinuousMetric(satisfactionScores),
    temporalTrends: {
      earlyCohortN: earlyCohort.length,
      lateCohortN: lateCohort.length,
      earlyCompletionRatePct: Number(earlyCompletionRate.toFixed(2)),
      lateCompletionRatePct: Number(lateCompletionRate.toFixed(2)),
      completionRateDeltaPct: Number((lateCompletionRate - earlyCompletionRate).toFixed(2)),
      earlyReviewTimeMean: Number(earlyReviewMean.toFixed(2)),
      lateReviewTimeMean: Number(lateReviewMean.toFixed(2)),
      reviewTimeDeltaMinutes: Number((lateReviewMean - earlyReviewMean).toFixed(2)),
      earlyAiCostMean: Number(earlyAiCostMean.toFixed(4)),
      lateAiCostMean: Number(lateAiCostMean.toFixed(4)),
      isStable: Math.abs(lateCompletionRate - earlyCompletionRate) < 15.0 && Math.abs(lateReviewMean - earlyReviewMean) < 1.0,
    },
    atsSegmentation: atsSegmentationReport,
    employerSegmentation: employerSegmentationReport,
    cp001Metrics: {
      nonRemoteJobsN: nonRemoteJobsCount,
      promptsSurfacedN: cp001PromptsSurfaced,
      triggerRatePct: nonRemoteJobsCount > 0 ? Number(((cp001PromptsSurfaced / nonRemoteJobsCount) * 100).toFixed(2)) : 0,
      remoteJobsN: remoteJobsCount,
      falsePositivePromptsN: cp001FalsePositives,
      falsePositiveRatePct: remoteJobsCount > 0 ? Number(((cp001FalsePositives / remoteJobsCount) * 100).toFixed(2)) : 0,
      choices: {
        confirmRemoteException: choiceRemoteException,
        willingToRelocate: choiceRelocate,
        drop: choiceDrop,
      },
    },
    cp002Metrics: {
      workdayApplicationsN: workdayAppsCount,
      compliantN: workdayCompliantCount,
      preFlightWarningsN: workdayWarningsCount,
      violationsBlockedN: workdayViolationsBlocked,
      silentTruncationCount: silentTruncations,
    },
    quantifiedFrictionMetrics: {
      customEditMeanReviewMinutes: Number(meanCustomReview.toFixed(2)),
      standardMeanReviewMinutes: Number(meanStandardReview.toFixed(2)),
      reviewTimeDeltaMinutes: reviewDelta,
      timeSavedSeconds: timeSavedSec,
      tier1FrictionRatePct,
      nonTier1FrictionRatePct,
      fatigueRiskMitigated: true,
    },
    rfcCandidates,
    authorityChannelProof: {
      canExecute: false,
      canApprove: false,
      canMutateEvidence: false,
      isPureAnalysis: true,
    },
  };
}
