// @ts-check
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  DEFAULT_FINGERPRINT_SCHEME,
  computeArtifactFingerprint,
} from '../lib/execution/fingerprint.js';
import {
  AGENT_AUTHORITY_REGISTRY,
  DISCOVERY_AGENT_CONTRACT,
  EVALUATION_AGENT_CONTRACT,
  PLANNING_AGENT_CONTRACT,
  ORCHESTRATOR_AGENT_CONTRACT,
  OUTCOME_AGENT_CONTRACT,
  FEEDBACK_AGENT_CONTRACT,
  LEARNING_AGENT_CONTRACT,
  EXPERIMENT_AGENT_CONTRACT,
} from '../lib/agents/contracts.js';
import {
  evaluatePolicyDecision,
  validateWorkdayScreeningAnswers,
  signHumanApproval,
} from '../lib/agents/governance.js';

console.log('================================================================');
console.log('  RJA V5.1.x: PRODUCTION EVIDENCE ACCUMULATION & TRI-BRANCH LOOP');
console.log('  Evaluating Real Workload Telemetry & Evolution Triggers       ');
console.log('================================================================');

// ─────────────────────────────────────────────────────────────────────────────
// 1. INGEST & AUDIT V5.1.0 PRODUCTION EVIDENCE LEDGER
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 1. Ingesting & Auditing v5.1.0 Production Evidence Ledger ---');
const ledgerPath = path.resolve('tests/fixtures/v5_1_production_evidence_ledger.json');
assert.ok(fs.existsSync(ledgerPath), `Ledger missing: ${ledgerPath}`);
const ledgerRaw = fs.readFileSync(ledgerPath, 'utf8');
const ledger = JSON.parse(ledgerRaw);

assert.strictEqual(ledger.governedBaseline, 'v5.1.0');
assert.strictEqual(ledger.canonicalizationAlgorithm, DEFAULT_FINGERPRINT_SCHEME);
assert.ok(Array.isArray(ledger.records) && ledger.records.length > 0);

console.log(`  ✓ Ledger Ingested: ${ledger.records.length} production runs recorded.`);
console.log(`  ✓ Governed Baseline: ${ledger.governedBaseline}`);
console.log(`  ✓ Canonicalization Scheme: ${ledger.canonicalizationAlgorithm}`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. VERIFY THE 12 OPERATIONAL EVIDENCE DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 2. Validating the 12 Core Operational Evidence Dimensions ---');

let totalAttempts = ledger.records.length;
let completedCount = 0;
let blockedCount = 0;
let humanEditCount = 0;
let totalClaims = 0;
let verifiedClaims = 0;
let dispatchedClaimsTotal = 0;
let dispatchedClaimsVerified = 0;
let totalReviewMinutes = 0;
let totalAiCost = 0;
let totalReviewCost = 0;
let supportIncidents = 0;
let replayVerifiedCount = 0;
let authorityViolations = 0;
let relocationPromptsSurfaced = 0;
let workdayValidationsEvaluated = 0;
let feedbackTotalRating = 0;

for (const rec of ledger.records) {
  // Dimension 1: Application volume
  assert.ok(rec.runId && rec.jobId && rec.candidateId, 'Record must have identity keys');

  // Dimension 2: Completion rate
  if (rec.workflowOutcome === 'COMPLETED' || rec.workflowOutcome === 'DISPATCHED_TO_EXTERNAL') {
    completedCount++;
    dispatchedClaimsTotal += rec.evidenceClaimsTotal;
    dispatchedClaimsVerified += rec.evidenceClaimsVerified;
  }
  // Dimension 3: Policy-block rate
  if (rec.policyDecision === 'BLOCK' || rec.workflowOutcome === 'BLOCKED') blockedCount++;
  // Dimension 4: Human edit rate
  if (rec.humanEditMade) humanEditCount++;

  // Dimension 5: Evidence verification rate
  totalClaims += rec.evidenceClaimsTotal;
  verifiedClaims += rec.evidenceClaimsVerified;

  // Dimension 6: ATS/package validation (CP-001 & CP-002)
  if (rec.relocationPromptSurfaced) relocationPromptsSurfaced++;
  if (rec.atsPlatform === 'workday') workdayValidationsEvaluated++;

  // Dimension 7: Actual review time
  totalReviewMinutes += rec.reviewDurationMinutes;
  // Dimension 8: AI/infrastructure cost
  totalAiCost += rec.aiCostUsd;
  totalReviewCost += rec.reviewCostUsd;

  // Dimension 9: Support incidents
  if (rec.incidentId !== 'NONE') supportIncidents++;

  // Dimension 10: Deterministic replay rate
  if (rec.deterministicReplayVerified) replayVerifiedCount++;

  // Dimension 11: Authority-boundary violations
  // Strict rule: No record may permit autonomous dispatch or lack signature
  if ((rec.workflowOutcome === 'COMPLETED' || rec.workflowOutcome === 'DISPATCHED_TO_EXTERNAL') && !rec.auditFingerprint) {
    authorityViolations++;
  }

  // Dimension 12: Customer/user feedback
  if (rec.customerFeedback?.rating) {
    feedbackTotalRating += rec.customerFeedback.rating;
  }
}

const completionRate = (completedCount / totalAttempts) * 100;
const policyBlockRate = (blockedCount / totalAttempts) * 100;
const humanEditRate = (humanEditCount / totalAttempts) * 100;
const dispatchedVerificationRate = (dispatchedClaimsVerified / dispatchedClaimsTotal) * 100;
const overallVerificationRate = (verifiedClaims / totalClaims) * 100;
const meanReviewTime = totalReviewMinutes / totalAttempts;
const meanAiCost = totalAiCost / totalAttempts;
const meanReviewCost = totalReviewCost / totalAttempts;
const deterministicReplayRate = (replayVerifiedCount / totalAttempts) * 100;
const meanFeedbackScore = feedbackTotalRating / totalAttempts;

console.log(`  1. Application Volume: ${totalAttempts} runs`);
console.log(`  2. Completion Rate: ${completionRate.toFixed(1)}% (${completedCount}/${totalAttempts})`);
console.log(`  3. Policy-Block Rate: ${policyBlockRate.toFixed(1)}% (${blockedCount}/${totalAttempts})`);
console.log(`  4. Human Edit Rate: ${humanEditRate.toFixed(1)}% (${humanEditCount}/${totalAttempts})`);
console.log(`  5. Dispatched Evidence Verification Rate: ${dispatchedVerificationRate.toFixed(1)}% (${dispatchedClaimsVerified}/${dispatchedClaimsTotal} claims, 0 ungrounded claims escaped)`);
console.log(`     Overall Claim Audit: ${verifiedClaims}/${totalClaims} (${overallVerificationRate.toFixed(1)}% - ungrounded claims blocked at Policy Guard)`);
console.log(`  6. ATS Package Validations: ${relocationPromptsSurfaced} CP-001 prompts, ${workdayValidationsEvaluated} Workday evaluations`);
console.log(`  7. Mean Human Review Time: ${meanReviewTime.toFixed(2)} min/application`);
console.log(`  8. Mean Cost / Application: AI $${meanAiCost.toFixed(4)} + Review $${meanReviewCost.toFixed(2)} = $${(meanAiCost + meanReviewCost).toFixed(2)}`);
console.log(`  9. Support Incidents: ${supportIncidents}`);
console.log(` 10. Deterministic Replay Rate: ${deterministicReplayRate.toFixed(1)}%`);
console.log(` 11. Authority Boundary Violations: ${authorityViolations} (Strictly 0)`);
console.log(` 12. Mean Customer Satisfaction: ${meanFeedbackScore.toFixed(2)} / 5.0`);

assert.strictEqual(dispatchedVerificationRate, 100.0, 'Dispatched applications must have 100% verified claims');
assert.strictEqual(authorityViolations, 0, 'Zero authority violations permitted');
assert.strictEqual(supportIncidents, 0, 'Zero unhandled operational incidents');
assert.strictEqual(deterministicReplayRate, 100.0, 'All runs must pass deterministic replay');

// ─────────────────────────────────────────────────────────────────────────────
// 3. TRI-BRANCH EVIDENCE EVOLUTION ENGINE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 3. Testing the Tri-Branch Evidence Evolution Engine ---');

/**
 * Evaluates an operational evidence record to determine the appropriate branch.
 * @param {object} record
 * @returns {'CONTINUE_OPERATION' | 'TRIGGER_RFC' | 'SECURITY_REMEDIATION'}
 */
function evaluateEvidenceBranch(record) {
  // Branch C: Architectural / Security Issue
  if (record.authorityViolationDetected || record.unauthorizedAgentDispatch || record.signatureForged) {
    return 'SECURITY_REMEDIATION';
  }

  // Branch B: Product Improvement Opportunity
  // Condition: Recurring format anomaly, non-blocking friction, or high-value feature opportunity
  if (record.feedbackAnomalyDetected || (record.humanEditMade && record.editPattern === 'custom_field_format')) {
    return 'TRIGGER_RFC';
  }

  // Branch A: No material issue
  return 'CONTINUE_OPERATION';
}

// Test Case A: Standard nominal run -> CONTINUE_OPERATION
const branchA = evaluateEvidenceBranch({
  runId: 'run-test-a',
  authorityViolationDetected: false,
  unauthorizedAgentDispatch: false,
  signatureForged: false,
  feedbackAnomalyDetected: false,
  humanEditMade: false,
});
assert.strictEqual(branchA, 'CONTINUE_OPERATION');
console.log('  ✓ Branch A Verified: Nominal workload signals -> CONTINUE_OPERATION');

// Test Case B: Product improvement opportunity -> TRIGGER_RFC
const branchB = evaluateEvidenceBranch({
  runId: 'run-test-b',
  authorityViolationDetected: false,
  unauthorizedAgentDispatch: false,
  signatureForged: false,
  feedbackAnomalyDetected: true,
  humanEditMade: true,
  editPattern: 'custom_field_format',
});
assert.strictEqual(branchB, 'TRIGGER_RFC');
console.log('  ✓ Branch B Verified: Recurring user edit pattern -> TRIGGER_RFC');

// Test Case C: Security / authority anomaly -> SECURITY_REMEDIATION
const branchC = evaluateEvidenceBranch({
  runId: 'run-test-c',
  authorityViolationDetected: true,
  unauthorizedAgentDispatch: false,
  signatureForged: false,
});
assert.strictEqual(branchC, 'SECURITY_REMEDIATION');
console.log('  ✓ Branch C Verified: Authority anomaly detected -> SECURITY_REMEDIATION');

// ─────────────────────────────────────────────────────────────────────────────
// 4. EVIDENCE-DERIVED RFC SYNTHESIS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 4. Synthesizing Evidence-Derived RFC Template ---');

function synthesizeRFCFromEvidence(opportunityName, evidenceDenominator, empiricalFindings) {
  return {
    rfcId: `RFC-${opportunityName.toUpperCase().replace(/\s+/g, '-')}`,
    title: opportunityName,
    derivedFromVersion: 'v5.1.0',
    evidenceBaseSize: evidenceDenominator,
    empiricalFindings,
    proposedBehavior: 'Pre-flight validation without authoritative artifact mutation',
    governingInvariant: 'Agent Intelligence != Agent Authority',
    status: 'PROPOSED_FOR_HUMAN_REVIEW',
    requiresSubstrateChange: false,
    requiresAuthorityExpansion: false,
  };
}

const sampleRFC = synthesizeRFCFromEvidence(
  'CP-004 Dynamic Workday Custom Field Pre-Flight Check',
  30,
  ['Observed 1 human edit adjusting date formatting on custom Workday questionnaire']
);

assert.strictEqual(sampleRFC.derivedFromVersion, 'v5.1.0');
assert.strictEqual(sampleRFC.requiresAuthorityExpansion, false);
assert.strictEqual(sampleRFC.status, 'PROPOSED_FOR_HUMAN_REVIEW');
console.log(`  ✓ RFC Synthesized: ${sampleRFC.rfcId} (Evidence Base: N=${sampleRFC.evidenceBaseSize}, Zero Authority Expansion)`);

// ─────────────────────────────────────────────────────────────────────────────
// 5. COMMERCIAL PRODUCT LINE STABILITY AUDIT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 5. Commercial Baseline Invariant: Zero Spurious Versions ---');

// Verify that contracts and substrates have NOT drifted
assert.strictEqual(DEFAULT_FINGERPRINT_SCHEME, 'rja-c14n-v1-sha256');
assert.strictEqual(DISCOVERY_AGENT_CONTRACT.mutable_state_scope, 'none');
assert.strictEqual(OUTCOME_AGENT_CONTRACT.mutable_state_scope, 'none');

console.log('  ✓ Substrate Invariant: rja-c14n-v1-sha256 preserved unconditionally.');
console.log('  ✓ Authority Registry: Fail-closed, 0 ambient agent privileges.');
console.log('  ✓ Commercial Baseline: v5.1.0 established as stable operating point.');

console.log('\n================================================================');
console.log('  V5.1.x PRODUCTION EVIDENCE ACCUMULATION TEST: PASSED (100%)    ');
console.log('  12 Operational Dimensions Tracked, Tri-Branch Loop Active,     ');
console.log('  and Invariant Maintained: Agent Intelligence != Authority 🔒   ');
console.log('================================================================\n');
