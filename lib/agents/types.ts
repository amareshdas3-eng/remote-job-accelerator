// lib/agents/types.ts
// RJA v5.0 Agentic Architecture: Core Types & Contracts

export type AgentType = 'discovery' | 'evaluation' | 'planning' | 'orchestrator' | 'outcome' | 'feedback' | 'learning' | 'experiment';

export type EvidenceAccessLevel = 'none' | 'read_only' | 'snapshot_only';

export type MutableStateScope = 'none' | 'ephemeral_proposal' | 'workspace_draft';

export type ApprovalBoundary = 'mandatory_human_review' | 'none';

export type FailureBehavior = 'fail_closed' | 'escalate_to_human';

/**
 * Universal Agent Authority Contract defining explicit observation,
 * proposal, and prohibition boundaries for autonomous agents.
 */
export interface AgentAuthorityContract {
  agent_id: string;
  agent_type: AgentType;
  version: string;
  input_sources: string[];
  evidence_access: EvidenceAccessLevel;
  allowed_operations: string[];
  prohibited_operations: string[];
  mutable_state_scope: MutableStateScope;
  external_actions: string[];
  approval_boundary: ApprovalBoundary;
  audit_events: string[];
  failure_behavior: FailureBehavior;
  escalation_path: string;
}

/**
 * Universal Negative Authority Declaration.
 * Every autonomous agent proposal must explicitly declare zero execution,
 * approval, or candidate evidence mutation privileges.
 */
export interface AgentAuthorityDeclaration {
  canExecute: false;
  canApprove: false;
  canMutateEvidence: false;
}

/**
 * Universal Provenance Envelope wrapping every agent output.
 * Unambiguously establishes:
 * - Who produced this proposal (agentId, agentVersion)
 * - From which evidence (inputEvidenceRefs)
 * - Under what authority (authority)
 * - With what cryptographic integrity (provenance)
 */
export interface AgentProposal<T = any> {
  proposalId: string;
  agentId: string;
  agentVersion: string;
  createdAt: string;
  inputEvidenceRefs: string[];
  output: T;
  authority: AgentAuthorityDeclaration;
  provenance: ProvenanceRecord;
}

/**
 * Cryptographic provenance record attached to discovered job opportunities
 * verifying source authenticity, retrieval timestamp, and content hash.
 */
export interface ProvenanceRecord {
  source: string;
  source_url: string;
  retrieved_at: string;
  raw_hash: string;
  adapter_version: string;
  provenance_hash: string;
  is_verified: boolean;
}

/**
 * Structured, read-only job opportunity proposed by the Discovery Agent.
 * Does NOT contain candidate qualifications, application approvals, or execution authority.
 */
export interface DiscoveryProposal {
  jobId: string;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  title: string;
  company: string;
  location: string;
  category: string;
  description: string;
  requirements: string[];
  skills: string[];
  provenance: ProvenanceRecord;
  proposed_by: 'discovery_agent';
  confidence_score: number;
  evaluation_requested?: boolean;
  evaluation_priority?: 'low' | 'normal' | 'high';
  evaluation_reason?: string;
}

/**
 * Typed alias for a Discovery Agent proposal wrapped in a Provenance Envelope.
 */
export type DiscoveryAgentProposal = AgentProposal<DiscoveryProposal>;

export type RequirementClassification = 'required' | 'preferred';

export type RequirementMatchStatus = 'satisfied' | 'gap' | 'partial';

/**
 * Strict citation to verified candidate evidence.
 * Preserves the invariant: "Generation is never evidence."
 */
export interface EvidenceCitation {
  fact: string;
  source_field: string;
  evidence_snapshot_id: string;
  evidence_hash: string;
}

/**
 * An individual job requirement evaluated against candidate evidence.
 */
export interface EvaluatedRequirement {
  id: string;
  raw_requirement: string;
  classification: RequirementClassification;
  status: RequirementMatchStatus;
  citations: EvidenceCitation[];
  gap_description?: string;
}

/**
 * Autonomous Evaluation Proposal produced by the Evaluation Agent.
 * Reconciles discovered job criteria with verified candidate evidence snapshot.
 */
export interface EvaluationProposal {
  evaluationId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  candidateId: string;
  evidenceSnapshotId: string;
  evidenceHash: string;

  fitScore: number;
  tier: 'exceptional' | 'strong' | 'moderate' | 'exploratory';
  dimensions: {
    role_alignment: number;
    technical_skills: number;
    leadership: number;
    seniority_remote: number;
  };

  evaluatedRequirements: EvaluatedRequirement[];
  satisfiedCount: number;
  gapCount: number;
  preferredCount: number;

  matchedSkills: string[];
  missingSkills: string[];

  reviewRequested: boolean;
  reviewReason?: string;

  proposed_by: 'evaluation_agent';
  evaluatedAt: string;
}

/**
 * Typed alias for an Evaluation Agent proposal wrapped in a Universal Provenance Envelope.
 */
export type EvaluationAgentProposal = AgentProposal<EvaluationProposal>;

export type PlannedActionType =
  | 'prepare_for_review'
  | 'request_missing_evidence'
  | 'hold'
  | 'defer';

/**
 * An individual planned action recommended for an evaluated job opportunity.
 * DOES NOT possess an execute action. Planning proposes; human candidate authorizes.
 */
export interface PlannedAction {
  actionId: string;
  evaluationProposalId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  action: PlannedActionType;
  priority: number; // 1 = highest priority
  prerequisites: string[];
  rationale: string;
  customNarrativeParagraph?: string;
}

/**
 * Planning prerequisite or dependency identified during plan sequencing.
 */
export interface PlanningDependency {
  dependencyId: string;
  actionId: string;
  type: 'missing_evidence' | 'prerequisite_credential' | 'tier_threshold' | 'timeline_conflict';
  description: string;
  resolved: boolean;
}

/**
 * Deterministic Planning Proposal produced by the Planning Agent.
 * Recommends application preparation ordering, prerequisite resolution, and pacing.
 */
export interface PlanningProposal {
  planId: string;
  candidateSnapshotId: string;
  evidenceHash: string;
  inputs: {
    evaluationProposalIds: string[];
    discoveryProposalIds: string[];
  };
  actions: PlannedAction[];
  dependencies: PlanningDependency[];
  reviewRequired: boolean;
  rationale: string[];
  createdAt: string;
  proposed_by: 'planning_agent';
  tailoredCoverLetterParagraph?: string;
}

/**
 * Typed alias for a Planning Agent proposal wrapped in a Universal Provenance Envelope.
 */
export type PlanningAgentProposal = AgentProposal<PlanningProposal>;

export type OrchestrationConflictType =
  | 'EVIDENCE_MISMATCH'
  | 'SNAPSHOT_DRIFT'
  | 'EVALUATION_DISAGREEMENT'
  | 'PLAN_CONTRADICTION'
  | 'DEPENDENCY_CONFLICT'
  | 'STALE_PROPOSAL'
  | 'PROVENANCE_BREAK'
  | 'INCOMPATIBLE_PROPOSAL'
  | 'gap_vs_ready_conflict'
  | 'divergent_snapshot'
  | 'pacing_deadline_conflict';

/**
 * An identified contradiction, discrepancy, or inconsistency between upstream agent proposals.
 * First-class conflict taxonomy: recording a conflict sets reviewRequired = true for human decision.
 */
export interface OrchestrationConflict {
  conflictId: string;
  type: OrchestrationConflictType;
  proposalIds: string[];
  description: string;
  blocking: boolean;
  severity?: 'critical' | 'warning';
  involvedProposalIds?: string[]; // Backwards-compatible alias
}

export type HumanDecisionType =
  | 'authorize_draft'
  | 'provide_missing_evidence'
  | 'resolve_conflict'
  | 'override_deferral'
  | string;

/**
 * An explicit candidate decision extracted by the Orchestrator that must be resolved
 * before application generation or human approval can proceed.
 * The Orchestrator determines that a human decision is required, but never chooses the decision.
 */
export interface HumanDecision {
  decisionId: string;
  type: HumanDecisionType;
  description: string;
  relatedProposalIds: string[];
  reason: string;
  required: boolean;
  title?: string;
  options?: string[];
  targetJobId?: string;
}

/**
 * Deterministic Orchestration Proposal produced by the Agent Orchestrator.
 * Synthesizes Discovery, Evaluation, and Planning proposals without acquiring positive authority.
 * "Orchestration coordinates intelligence; it does not manufacture authority."
 */
export interface OrchestrationProposal {
  orchestrationId: string;
  candidateSnapshotId: string;
  evidenceHash: string;
  discoveryProposalIds: string[];
  evaluationProposalIds: string[];
  planningProposalIds: string[];
  selectedPlanIds: string[];
  conflicts: OrchestrationConflict[];
  requiredHumanDecisions: HumanDecision[];
  reviewRequired: boolean;
  rationale: string[];
  createdAt: string;
  proposed_by: 'agent_orchestrator';
}

/**
 * Typed alias for an Orchestration Agent proposal wrapped in a Universal Provenance Envelope.
 */
export type AgentOrchestrationProposal = AgentProposal<OrchestrationProposal>;

/**
 * Result of Policy Guard boundary validation.
 */
export interface PolicyGuardResult {
  allowed: boolean;
  violations: string[];
  agent_id: string;
  evaluated_at: string;
  sanitized_output?: any;
}

export type PolicyDecisionType = 'ALLOW_REVIEW' | 'BLOCK' | 'REQUIRE_HUMAN_DECISION';

/**
 * An individual policy finding evaluated against the five governance questions.
 */
export interface PolicyFinding {
  findingId: string;
  category: 'AUTHENTICITY' | 'FRESHNESS' | 'CONSISTENCY' | 'COMPLIANCE' | 'SECURITY';
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  rule: string;
  description: string;
  relatedProposalIds: string[];
}

/**
 * Deterministic Policy Decision Proposal produced by the Server Policy Guard.
 * Bridges agent proposals with sovereign human approval without giving agents execution authority.
 * "Policy may govern proposals, but agents cannot manufacture authority."
 */
export interface PolicyDecisionProposal {
  policyDecisionId: string;
  orchestrationId: string;
  candidateSnapshotId: string;
  evidenceHash: string;
  decision: PolicyDecisionType;
  policyFindings: PolicyFinding[];
  requiredHumanDecisions: HumanDecision[];
  reviewRequired: boolean;
  rationale: string[];
  createdAt: string;
  proposed_by: 'server_policy_guard';
}

export type GovernanceState =
  | 'ORCHESTRATED'
  | 'POLICY_EVALUATING'
  | 'POLICY_BLOCKED'
  | 'REQUIRE_HUMAN_DECISION'
  | 'AWAITING_HUMAN_REVIEW'
  | 'HUMAN_REJECTED'
  | 'HUMAN_APPROVED'
  | 'ARTIFACT_FROZEN'
  | 'EXECUTED';

/**
 * Immutable frozen artifact compiled from human approval, sealed with rja-c14n-v1-sha256.
 * Invariant: Once frozen, zero agent or retroactive human modifications can alter payload.
 */
export interface FrozenArtifactPackage {
  frozenArtifactId: string;
  policyDecisionId: string;
  orchestrationId: string;
  candidateSnapshotId: string;
  destination: string;
  approvedBy: string;
  approvedAt: string;
  canonicalFingerprint: string;
  fingerprintAlgorithm: 'rja-c14n-v1-sha256';
  artifactPayload: {
    resume: any;
    cover_letter: any;
    screening_answers: any;
  };
  immutable: true;
}

export type OutcomeStatus = 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';

export interface OutcomeObservation {
  observationId: string;
  category: 'STATUS' | 'METRICS' | 'RESPONSE' | 'TIMING';
  name: string;
  value: any;
  observedAt: string;
}

export type DeviationCategory =
  | 'TIMING'
  | 'SCOPE'
  | 'DEPENDENCY'
  | 'RESULT'
  | 'EXECUTION_FAILURE';

export interface OutcomeDeviation {
  deviationId: string;
  category: DeviationCategory;
  plannedReference: string;
  observedReference: string;
  magnitude?: string;
  description: string;
}

/**
 * Immutable Outcome Record produced by Outcome Intelligence.
 * Represents read-only observation of execution truth.
 * "Outcome Intelligence observes history; it does not rewrite history."
 */
export interface OutcomeRecord {
  outcomeId: string;
  executionId: string;
  frozenArtifactId: string;
  candidateSnapshotId: string;
  executionReceiptHash: string;
  status: OutcomeStatus;
  observedAt: string;
  actualResults: OutcomeObservation[];
  deviations: OutcomeDeviation[];
  evidenceReferences: string[];
  created_by: 'outcome_intelligence';
  immutable: true;
}

export type AgentOutcomeRecord = AgentProposal<OutcomeRecord>;

export type FeedbackSignalType =
  | 'TIMING_OBSERVATION'
  | 'RESULT_OBSERVATION'
  | 'DEPENDENCY_OBSERVATION'
  | 'SCOPE_OBSERVATION'
  | 'EXECUTION_FAILURE_OBSERVATION'
  | 'SUCCESS_OBSERVATION'
  | 'DATA_QUALITY_OBSERVATION';

export interface FeedbackObservation {
  observationId: string;
  type: FeedbackSignalType;
  sourceOutcomeId: string;
  description: string;
  evidenceReference: string;
}

export interface FeedbackSignal {
  signalId: string;
  type: FeedbackSignalType;
  confidence: number;
  description: string;
  actionableFor: 'discovery' | 'evaluation' | 'planning';
}

/**
 * Immutable Evidence Feedback Record produced by Evidence Feedback Intelligence.
 * "Feedback creates evidence; it does not create authority."
 */
export interface EvidenceFeedbackRecord {
  feedbackId: string;
  sourceOutcomeId: string;
  sourceExecutionId: string;
  candidateSnapshotId: string;
  evidenceReferences: string[];
  observations: FeedbackObservation[];
  derivedSignals: FeedbackSignal[];
  createdAt: string;
  created_by: 'evidence_feedback';
  immutable: true;
}

export type AgentEvidenceFeedbackRecord = AgentProposal<EvidenceFeedbackRecord>;

export type IntelligenceRuleTarget =
  | 'DISCOVERY_RULE'
  | 'EVALUATION_RULE'
  | 'PLANNING_RULE'
  | 'ORCHESTRATION_RULE'
  | 'EVIDENCE_RULE';

export interface IntelligenceRule {
  ruleId: string;
  target: IntelligenceRuleTarget;
  parameter: string;
  value: unknown;
  description: string;
}

export interface IntelligenceProfile {
  profileId: string;
  version: string;
  parentVersion?: string;
  rules: IntelligenceRule[];
  createdAt: string;
  createdBy: 'system' | 'human' | 'controlled_learning';
  sourceLearningId?: string;
  evidenceReferences: string[];
  immutable: true;
}

export interface AdaptationChange {
  changeId: string;
  target: IntelligenceRuleTarget;
  parameter: string;
  previousValue: unknown;
  proposedValue: unknown;
  reason: string;
  supportingFeedbackIds: string[];
}

export interface LearningPattern {
  patternId: string;
  category: string;
  frequency: number;
  description: string;
  evidenceIds: string[];
}

export interface RegressionCheck {
  checkId: string;
  datasetHash: string;
  baselineProfileVersion: string;
  proposedProfileVersion: string;
  changedResults: number;
  regressionsDetected: number;
  status: 'PASS' | 'FAIL';
  details: string[];
}

/**
 * Learning Proposal emitted by Controlled Learning Intelligence.
 * "Learning creates a new version; it does not rewrite the version that created history."
 */
export interface LearningProposal {
  learningId: string;
  sourceFeedbackIds: string[];
  sourceOutcomeIds: string[];
  sourceEvidenceIds: string[];
  currentProfileVersion: string;
  proposedProfileVersion: string;
  adaptations: AdaptationChange[];
  detectedPatterns: LearningPattern[];
  evidenceReferences: string[];
  confidence?: number;
  rationale: string[];
  regressionChecks: RegressionCheck[];
  createdAt: string;
  created_by: 'controlled_learning';
  immutable: true;
}

export type AgentLearningProposal = AgentProposal<LearningProposal>;
 
 /**
  * Standardized sample benchmark item for deterministic replay.
  */
 export interface ExperimentDatasetItem {
   id: string;
   candidateSnapshotId: string;
   jobId: string;
   historicalOutcomeId?: string;
   inputPayload: Record<string, unknown>;
 }
 
 /**
  * Canonical benchmark dataset for Controlled Optimization & Experimentation.
  */
 export interface ExperimentDataset {
   datasetId: string;
   description: string;
   sampleItems: ExperimentDatasetItem[];
   datasetHash: string;
   immutable: true;
 }
 
 /**
  * Comparative metric capturing baseline vs candidate profile behavior.
  */
 export interface ExperimentMetric {
   metricName: string;
   targetRule: IntelligenceRuleTarget;
   parameter: string;
   baselineValue: number | string;
   candidateValue: number | string;
   delta: number | string;
   status: 'IMPROVED' | 'REGRESSED' | 'UNCHANGED';
 }
 
 /**
  * Deeply frozen experiment result emitted by Controlled Experimentation Agent.
  * "An experiment may compare possible futures; it cannot alter historical truth or activate itself."
  */
 export interface ExperimentResult {
   experimentId: string;
   learningProposalId: string;
   baselineProfileVersion: string;
   candidateProfileVersion: string;
   datasetHash: string;
   datasetSize: number;
   metrics: ExperimentMetric[];
   regressionsDetected: number;
   improvementsDetected: number;
   overallStatus: 'PASS' | 'FAIL';
   replayHash: string;
   recommendation: 'APPROVE_FOR_REVIEW' | 'REJECT_REGRESSION';
   createdAt: string;
   created_by: 'controlled_experimentation';
   immutable: true;
 }
 
 export type AgentExperimentProposal = AgentProposal<ExperimentResult>;







