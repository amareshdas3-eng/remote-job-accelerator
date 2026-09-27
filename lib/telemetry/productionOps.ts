// lib/telemetry/productionOps.ts
// Production Operations & Telemetry Layer for RJA v5.0
// Wraps around the frozen v5.0.0 core WITHOUT modifying agent authority or execution substrate.

export interface StageLatency {
  stage: string;
  durationMs: number;
  timestamp: string;
}

export interface ProposalOutcome {
  proposalId: string;
  agentType: string;
  status: 'ACCEPTED' | 'MODIFIED' | 'REJECTED';
  candidateEditsCount?: number;
}

export interface FactualClaimAudit {
  claimId: string;
  statement: string;
  evidenceSourceId?: string;
  verified: boolean;
  citationFound: boolean;
}

export interface SecurityEventRecord {
  timestamp: string;
  eventType:
    | 'INVALID_PROVENANCE'
    | 'UNAUTHORIZED_TRANSITION'
    | 'MALFORMED_ARTIFACT'
    | 'DUPLICATE_OPERATION'
    | 'REPLAY_ATTEMPT'
    | 'STALE_PROPOSAL'
    | 'INVALID_SIGNATURE'
    | 'CROSS_CANDIDATE_ATTEMPT'
    | 'POLICY_BLOCK';
  actorId?: string;
  details: string;
}

export interface LifecycleTelemetryRecord {
  lifecycleId: string;
  candidateId: string;
  jobId: string;
  startedAt: string;
  completedAt?: string;

  // 1. Reliability
  status: 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'INTERRUPTED';
  failureStage?: string;
  retryCount: number;
  recovered: boolean;

  // 2. Stage-by-Stage Latencies
  stageLatencies: Record<string, number>;
  totalLatencyMs: number;

  // 3. Agent Proposal Quality
  proposalOutcomes: ProposalOutcome[];

  // 4. Evidence Quality
  claimAudits: FactualClaimAudit[];
  unsupportedClaimsCount: number;
  evidenceVerificationRatio: number;

  // 5. Human Intervention
  humanInterventions: {
    approvals: number;
    rejections: number;
    modifications: number;
    conflictsSurfaced: number;
    overrides: number;
    policyBlocks: number;
  };

  // 6. Determinism Verification
  determinismRecord?: {
    inputHash: string;
    evidenceHash: string;
    profileVersion: string;
    canonicalOutputHash: string;
    matchedKnownDigest: boolean;
  };

  // 7. Security Telemetry
  securityEvents: SecurityEventRecord[];

  // 8. Resource Consumption
  resources: {
    payloadSizeBytes: number;
    dbOperations: number;
    aiModelCalls: number;
    lockContentionCount: number;
  };

  // 9. Cost Accounting
  cost: {
    estimatedAiCostUsd: number;
    estimatedHumanTimeSavedMinutes: number;
    estimatedCostPerWorkflowUsd: number;
  };

  // 10. Audit Completeness
  audit: {
    reconstructable: boolean;
    chainNodeCount: number;
    missingProofNodes: string[];
  };
}

export class ProductionTelemetryCollector {
  private activeRecords = new Map<string, LifecycleTelemetryRecord>();
  private completedRecords: LifecycleTelemetryRecord[] = [];
  private securityLog: SecurityEventRecord[] = [];

  public startLifecycle(lifecycleId: string, candidateId: string, jobId: string): LifecycleTelemetryRecord {
    const record: LifecycleTelemetryRecord = {
      lifecycleId,
      candidateId,
      jobId,
      startedAt: new Date().toISOString(),
      status: 'INTERRUPTED', // default until successfully closed or failed
      retryCount: 0,
      recovered: false,
      stageLatencies: {},
      totalLatencyMs: 0,
      proposalOutcomes: [],
      claimAudits: [],
      unsupportedClaimsCount: 0,
      evidenceVerificationRatio: 1.0,
      humanInterventions: {
        approvals: 0,
        rejections: 0,
        modifications: 0,
        conflictsSurfaced: 0,
        overrides: 0,
        policyBlocks: 0,
      },
      securityEvents: [],
      resources: {
        payloadSizeBytes: 0,
        dbOperations: 0,
        aiModelCalls: 0,
        lockContentionCount: 0,
      },
      cost: {
        estimatedAiCostUsd: 0,
        estimatedHumanTimeSavedMinutes: 0,
        estimatedCostPerWorkflowUsd: 0,
      },
      audit: {
        reconstructable: false,
        chainNodeCount: 0,
        missingProofNodes: [],
      },
    };

    this.activeRecords.set(lifecycleId, record);
    return record;
  }

  public recordStageLatency(lifecycleId: string, stage: string, durationMs: number): void {
    const record = this.activeRecords.get(lifecycleId);
    if (!record) return;
    record.stageLatencies[stage] = durationMs;
  }

  public recordProposalOutcome(
    lifecycleId: string,
    proposalId: string,
    agentType: string,
    status: 'ACCEPTED' | 'MODIFIED' | 'REJECTED',
    candidateEditsCount = 0
  ): void {
    const record = this.activeRecords.get(lifecycleId);
    if (!record) return;
    record.proposalOutcomes.push({ proposalId, agentType, status, candidateEditsCount });
    if (status === 'ACCEPTED') record.humanInterventions.approvals++;
    if (status === 'MODIFIED') record.humanInterventions.modifications++;
    if (status === 'REJECTED') record.humanInterventions.rejections++;
  }

  public recordClaimAudit(
    lifecycleId: string,
    claimId: string,
    statement: string,
    verified: boolean,
    citationFound: boolean,
    evidenceSourceId?: string
  ): void {
    const record = this.activeRecords.get(lifecycleId);
    if (!record) return;
    record.claimAudits.push({ claimId, statement, verified, citationFound, evidenceSourceId });
    const total = record.claimAudits.length;
    const verifiedCount = record.claimAudits.filter((c) => c.verified).length;
    record.unsupportedClaimsCount = total - verifiedCount;
    record.evidenceVerificationRatio = total > 0 ? verifiedCount / total : 1.0;
  }

  public recordSecurityEvent(
    lifecycleId: string | null,
    eventType: SecurityEventRecord['eventType'],
    details: string,
    actorId?: string
  ): void {
    const evt: SecurityEventRecord = {
      timestamp: new Date().toISOString(),
      eventType,
      details,
      actorId,
    };
    this.securityLog.push(evt);

    if (lifecycleId) {
      const record = this.activeRecords.get(lifecycleId);
      if (record) {
        record.securityEvents.push(evt);
        if (eventType === 'POLICY_BLOCK') {
          record.humanInterventions.policyBlocks++;
        }
      }
    }
  }

  public recordResourceMetrics(
    lifecycleId: string,
    metrics: Partial<LifecycleTelemetryRecord['resources']>
  ): void {
    const record = this.activeRecords.get(lifecycleId);
    if (!record) return;
    record.resources = { ...record.resources, ...metrics };
  }

  public recordCostMetrics(
    lifecycleId: string,
    aiCostUsd: number,
    savedHumanMinutes: number
  ): void {
    const record = this.activeRecords.get(lifecycleId);
    if (!record) return;
    record.cost.estimatedAiCostUsd = aiCostUsd;
    record.cost.estimatedHumanTimeSavedMinutes = savedHumanMinutes;
    record.cost.estimatedCostPerWorkflowUsd = aiCostUsd;
  }

  public recordDeterminismCheck(
    lifecycleId: string,
    check: NonNullable<LifecycleTelemetryRecord['determinismRecord']>
  ): void {
    const record = this.activeRecords.get(lifecycleId);
    if (!record) return;
    record.determinismRecord = check;
  }

  public recordAuditProof(
    lifecycleId: string,
    chainNodeCount: number,
    missingNodes: string[] = []
  ): void {
    const record = this.activeRecords.get(lifecycleId);
    if (!record) return;
    record.audit.chainNodeCount = chainNodeCount;
    record.audit.missingProofNodes = missingNodes;
    record.audit.reconstructable = missingNodes.length === 0 && chainNodeCount >= 8;
  }

  public finishLifecycle(
    lifecycleId: string,
    status: LifecycleTelemetryRecord['status'],
    failureStage?: string
  ): LifecycleTelemetryRecord | undefined {
    const record = this.activeRecords.get(lifecycleId);
    if (!record) return undefined;

    record.completedAt = new Date().toISOString();
    record.status = status;
    record.failureStage = failureStage;
    record.totalLatencyMs = Object.values(record.stageLatencies).reduce((a, b) => a + b, 0);

    this.activeRecords.delete(lifecycleId);
    this.completedRecords.push(record);
    return record;
  }

  public getSummaryStatistics(): {
    totalLifecycles: number;
    completionRate: number;
    stageLatencyP50P95P99: Record<string, { p50: number; p95: number; p99: number }>;
    totalLatencyP50P95P99: { p50: number; p95: number; p99: number };
    overallEvidenceVerificationRatio: number;
    totalUnsupportedClaims: number;
    proposalAcceptanceRate: number;
    securityEventsCount: number;
    averageCostPerWorkflowUsd: number;
    averageHumanTimeSavedMinutes: number;
    auditReconstructabilityRate: number;
  } {
    const total = this.completedRecords.length;
    if (total === 0) {
      return {
        totalLifecycles: 0,
        completionRate: 0,
        stageLatencyP50P95P99: {},
        totalLatencyP50P95P99: { p50: 0, p95: 0, p99: 0 },
        overallEvidenceVerificationRatio: 1.0,
        totalUnsupportedClaims: 0,
        proposalAcceptanceRate: 1.0,
        securityEventsCount: this.securityLog.length,
        averageCostPerWorkflowUsd: 0,
        averageHumanTimeSavedMinutes: 0,
        auditReconstructabilityRate: 1.0,
      };
    }

    const completed = this.completedRecords.filter((r) => r.status === 'COMPLETED').length;
    const completionRate = completed / total;

    // Collect all stage names
    const allStages = new Set<string>();
    this.completedRecords.forEach((r) => {
      Object.keys(r.stageLatencies).forEach((s) => allStages.add(s));
    });

    const calculatePercentiles = (values: number[]) => {
      if (values.length === 0) return { p50: 0, p95: 0, p99: 0 };
      const sorted = [...values].sort((a, b) => a - b);
      const getPercentile = (p: number) => {
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
      };
      return {
        p50: getPercentile(50),
        p95: getPercentile(95),
        p99: getPercentile(99),
      };
    };

    const stageLatencyP50P95P99: Record<string, { p50: number; p95: number; p99: number }> = {};
    for (const stage of allStages) {
      const durations = this.completedRecords
        .map((r) => r.stageLatencies[stage])
        .filter((d) => typeof d === 'number');
      stageLatencyP50P95P99[stage] = calculatePercentiles(durations);
    }

    const totalDurations = this.completedRecords.map((r) => r.totalLatencyMs);
    const totalLatencyP50P95P99 = calculatePercentiles(totalDurations);

    // Evidence Quality
    let allClaims = 0;
    let verifiedClaims = 0;
    this.completedRecords.forEach((r) => {
      allClaims += r.claimAudits.length;
      verifiedClaims += r.claimAudits.filter((c) => c.verified).length;
    });
    const overallEvidenceVerificationRatio = allClaims > 0 ? verifiedClaims / allClaims : 1.0;
    const totalUnsupportedClaims = allClaims - verifiedClaims;

    // Proposal Outcomes
    let totalProposals = 0;
    let acceptedProposals = 0;
    this.completedRecords.forEach((r) => {
      totalProposals += r.proposalOutcomes.length;
      acceptedProposals += r.proposalOutcomes.filter((p) => p.status === 'ACCEPTED').length;
    });
    const proposalAcceptanceRate = totalProposals > 0 ? acceptedProposals / totalProposals : 1.0;

    // Cost & Human Time Saved
    const avgCost =
      this.completedRecords.reduce((acc, r) => acc + r.cost.estimatedCostPerWorkflowUsd, 0) / total;
    const avgTimeSaved =
      this.completedRecords.reduce((acc, r) => acc + r.cost.estimatedHumanTimeSavedMinutes, 0) / total;

    // Audit Reconstructability
    const reconstructable = this.completedRecords.filter((r) => r.audit.reconstructable).length;
    const auditReconstructabilityRate = reconstructable / total;

    return {
      totalLifecycles: total,
      completionRate,
      stageLatencyP50P95P99,
      totalLatencyP50P95P99,
      overallEvidenceVerificationRatio,
      totalUnsupportedClaims,
      proposalAcceptanceRate,
      securityEventsCount: this.securityLog.length,
      averageCostPerWorkflowUsd: Number(avgCost.toFixed(4)),
      averageHumanTimeSavedMinutes: Number(avgTimeSaved.toFixed(1)),
      auditReconstructabilityRate,
    };
  }

  public getSecurityAuditLog(): SecurityEventRecord[] {
    return [...this.securityLog];
  }
}

// Global production singleton
export const productionTelemetry = new ProductionTelemetryCollector();
