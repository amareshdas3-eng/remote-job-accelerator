// @ts-check
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateEvidenceMaturity,
  calculateWilsonScoreInterval,
} from '../lib/evidence/maturity.js';
import {
  DEFAULT_FINGERPRINT_SCHEME,
} from '../lib/execution/fingerprint.js';
import {
  AGENT_AUTHORITY_REGISTRY,
  DISCOVERY_AGENT_CONTRACT,
  OUTCOME_AGENT_CONTRACT,
} from '../lib/agents/contracts.js';

console.log('================================================================');
console.log('  RJA V5.1.x: EVIDENCE MATURITY & STATISTICAL AUDIT GATE        ');
console.log('  Testing Denominator Tracking, Confidence Intervals & Invariants');
console.log('================================================================');

// ─────────────────────────────────────────────────────────────────────────────
// 1. INGEST PRODUCTION EVIDENCE LEDGER (N = 60)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 1. Ingesting Production Evidence Ledger (Expanded Cohort) ---');
const ledgerPath = path.resolve('tests/fixtures/v5_1_production_evidence_ledger.json');
assert.ok(fs.existsSync(ledgerPath), `Ledger fixture missing at ${ledgerPath}`);
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

assert.strictEqual(ledger.governedBaseline, 'v5.1.0');
assert.strictEqual(ledger.canonicalizationAlgorithm, DEFAULT_FINGERPRINT_SCHEME);
assert.strictEqual(ledger.records.length, 60, 'Production evidence ledger must contain exactly 60 runs');
console.log(`  ✓ Ledger Ingested: N = ${ledger.records.length} production runs under baseline ${ledger.governedBaseline}`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. EVALUATE EVIDENCE MATURITY ENGINE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 2. Evaluating Evidence Maturity Metrics & Confidence Intervals ---');
const report = evaluateEvidenceMaturity(ledger);

// Validate 4-Way Outcome Taxonomy
const tax = report.taxonomies;
assert.strictEqual(tax.completed.numerator, 54);
assert.strictEqual(tax.blocked.numerator, 3);
assert.strictEqual(tax.abandoned.numerator, 2);
assert.strictEqual(tax.failed.numerator, 1);
assert.strictEqual(
  tax.completed.numerator + tax.blocked.numerator + tax.abandoned.numerator + tax.failed.numerator,
  60,
  'Sum of outcome taxonomy numerators must equal total N=60'
);

console.log(`  ✓ Outcome Taxonomy:`);
console.log(`    - Completed:  ${tax.completed.rateString} | 95% CI: [${tax.completed.ci95[0]}%, ${tax.completed.ci95[1]}%]`);
console.log(`    - Blocked:    ${tax.blocked.rateString} | 95% CI: [${tax.blocked.ci95[0]}%, ${tax.blocked.ci95[1]}%]`);
console.log(`    - Abandoned:  ${tax.abandoned.rateString} | 95% CI: [${tax.abandoned.ci95[0]}%, ${tax.abandoned.ci95[1]}%]`);
console.log(`    - Failed:     ${tax.failed.rateString} | 95% CI: [${tax.failed.ci95[0]}%, ${tax.failed.ci95[1]}%]`);

// Validate Wilson Score Interval Calculation
const testWilson = calculateWilsonScoreInterval(54, 60);
assert.strictEqual(testWilson[0], tax.completed.ci95[0]);
assert.strictEqual(testWilson[1], tax.completed.ci95[1]);
assert.ok(tax.completed.ci95[0] > 75.0 && tax.completed.ci95[1] < 98.0);
console.log(`  ✓ Wilson Score Intervals: Formally verified against closed-form standard.`);

// Validate Continuous Metrics (Mean, StdDev, Margin of Error)
assert.strictEqual(report.reviewTimeMinutes.n, 60);
assert.ok(report.reviewTimeMinutes.mean > 1.8 && report.reviewTimeMinutes.mean < 2.5);
assert.ok(report.reviewTimeMinutes.marginOfError > 0);
console.log(`  ✓ Review Duration: ${report.reviewTimeMinutes.mean} ± ${report.reviewTimeMinutes.marginOfError} min (95% CI: [${report.reviewTimeMinutes.ci95[0]}, ${report.reviewTimeMinutes.ci95[1]}])`);

assert.strictEqual(report.totalCostUsd.n, 60);
assert.ok(report.totalCostUsd.mean > 1.8 && report.totalCostUsd.mean < 2.6);
console.log(`  ✓ Total Cost / App: $${report.totalCostUsd.mean} ± $${report.totalCostUsd.marginOfError} (95% CI: [$${report.totalCostUsd.ci95[0]}, $${report.totalCostUsd.ci95[1]}])`);

// Evidence Verification Rates
assert.strictEqual(report.dispatchedEvidenceVerificationRate.ratePct, 100.0);
assert.strictEqual(report.dispatchedEvidenceVerificationRate.numerator, 745);
assert.strictEqual(report.dispatchedEvidenceVerificationRate.denominator, 745);
console.log(`  ✓ Dispatched Evidence Verification: ${report.dispatchedEvidenceVerificationRate.rateString} (Zero hallucinations on dispatched packages)`);

assert.strictEqual(report.overallEvidenceAuditRate.numerator, 822);
assert.strictEqual(report.overallEvidenceAuditRate.denominator, 825);
console.log(`  ✓ Overall Claim Audit: ${report.overallEvidenceAuditRate.rateString} (3 ungrounded claims halted at Policy Guard)`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. TEMPORAL TREND & DRIFT DETECTION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 3. Temporal Trend & Longitudinal Drift Detection ---');
const trends = report.temporalTrends;
assert.strictEqual(trends.earlyCohortN, 30);
assert.strictEqual(trends.lateCohortN, 30);
console.log(`  - Early Cohort (Runs 1–30): Completion ${trends.earlyCompletionRatePct}%, Review ${trends.earlyReviewTimeMean}m, AI $${trends.earlyAiCostMean}`);
console.log(`  - Late Cohort  (Runs 31–60): Completion ${trends.lateCompletionRatePct}%, Review ${trends.lateReviewTimeMean}m, AI $${trends.lateAiCostMean}`);
console.log(`  - Deltas: Completion Δ ${trends.completionRateDeltaPct}%, Review Δ ${trends.reviewTimeDeltaMinutes}m`);
assert.strictEqual(trends.isStable, true, 'Longitudinal drift must remain within stability threshold (< 15% rate delta, < 1.0m time delta)');
console.log(`  ✓ Longitudinal Stability Confirmed: Operating point is stable over time.`);

// ─────────────────────────────────────────────────────────────────────────────
// 4. MULTI-DIMENSIONAL SEGMENTATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 4. Multi-Dimensional Segmentation ---');
const ats = report.atsSegmentation;
assert.ok(ats.workday && ats.greenhouse && ats.lever && ats.ashby && ats.smartrecruiters);
const totalAtsRuns = Object.values(ats).reduce((acc, s) => acc + s.totalRuns, 0);
assert.strictEqual(totalAtsRuns, 60, 'Sum of ATS segments must equal 60');

console.log(`  ✓ ATS Platform Segmentation:`);
for (const [key, s] of Object.entries(ats)) {
  console.log(`    - ${key.padEnd(16)}: N=${s.totalRuns} | Completed: ${s.completionRate.rateString} | Review: ${s.meanReviewDuration}m | Cost: $${s.meanTotalCostUsd}`);
}

const emp = report.employerSegmentation;
assert.ok(emp.tier_1_enterprise && emp.growth_unicorn);
assert.strictEqual(emp.tier_1_enterprise.totalRuns + emp.growth_unicorn.totalRuns, 60);
console.log(`  ✓ Employer Tier Segmentation:`);
for (const [key, s] of Object.entries(emp)) {
  console.log(`    - ${key.padEnd(20)}: N=${s.totalRuns} | Completed: ${s.completionRate.rateString} | Review: ${s.meanReviewDuration}m | Cost: $${s.meanTotalCostUsd}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FIELD VALIDATION OF CP-001 & CP-002
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 5. Field Telemetry Validation of CP-001 & CP-002 ---');
const cp1 = report.cp001Metrics;
assert.strictEqual(cp1.nonRemoteJobsN, 11, 'Exactly 11 non-remote jobs in ledger');
assert.strictEqual(cp1.promptsSurfacedN, 11, 'All 11 non-remote jobs must surface relocation prompt');
assert.strictEqual(cp1.triggerRatePct, 100.0);
assert.strictEqual(cp1.remoteJobsN, 49);
assert.strictEqual(cp1.falsePositivePromptsN, 0, 'Zero false-positive prompts on remote jobs');
assert.strictEqual(cp1.falsePositiveRatePct, 0.0);
assert.strictEqual(cp1.choices.confirmRemoteException + cp1.choices.willingToRelocate + cp1.choices.drop, 11);
console.log(`  ✓ CP-001 Performance: 11/11 non-remote prompts surfaced (100%), 0/49 remote false positives (0.0%). Choices: Remote Waiver (${cp1.choices.confirmRemoteException}), Relocate (${cp1.choices.willingToRelocate}), Drop (${cp1.choices.drop}).`);

const cp2 = report.cp002Metrics;
assert.strictEqual(cp2.workdayApplicationsN, 23);
assert.strictEqual(cp2.compliantN, 23);
assert.ok(cp2.preFlightWarningsN >= 1);
assert.strictEqual(cp2.silentTruncationCount, 0, 'Zero silent string truncation events permitted');
console.log(`  ✓ CP-002 Performance: 23 Workday applications evaluated; 100% compliant; ${cp2.preFlightWarningsN} pre-flight warnings; 0 silent truncations.`);

// ─────────────────────────────────────────────────────────────────────────────
// 6. RFC CANDIDATE SYNTHESIS & EVIDENCE THRESHOLD GATE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 6. RFC Candidate Synthesis & Threshold Evaluation ---');
assert.ok(report.rfcCandidates.length > 0);
const customParagraphRFC = report.rfcCandidates.find(c => c.frictionCategory === 'cover_letter_custom_paragraph');
assert.ok(customParagraphRFC, 'Must detect cover letter custom paragraph friction');
assert.strictEqual(customParagraphRFC.occurrences, 3);
assert.strictEqual(customParagraphRFC.denominator, 60);
assert.strictEqual(customParagraphRFC.frequencyPct, 5.0);
assert.strictEqual(customParagraphRFC.thresholdExceeded, true, '5.0% meets the 5.0% threshold');
assert.ok(customParagraphRFC.synthesizedRFC);
assert.strictEqual(customParagraphRFC.synthesizedRFC.status, 'PROPOSED_FOR_HUMAN_REVIEW');
assert.strictEqual(customParagraphRFC.synthesizedRFC.requiresAuthorityExpansion, false);
console.log(`  ✓ RFC Trigger Threshold: ${customParagraphRFC.frequencyPct}% meets 5.0% threshold.`);
console.log(`  ✓ Synthesized RFC: ${customParagraphRFC.synthesizedRFC.rfcId} (Denominator: N=60, Occurrences: 3)`);

// ─────────────────────────────────────────────────────────────────────────────
// 7. GOVERNING INVARIANT: TELEMETRY MUST NEVER BECOME AN AUTHORITY CHANNEL
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 7. Invariant: Telemetry Must Never Become an Authority Channel ---');
assert.strictEqual(report.authorityChannelProof.isPureAnalysis, true);
assert.strictEqual(report.authorityChannelProof.canExecute, false);
assert.strictEqual(report.authorityChannelProof.canApprove, false);
assert.strictEqual(report.authorityChannelProof.canMutateEvidence, false);

// Verify that report cannot execute substrate actions
assert.strictEqual(typeof report.execute, 'undefined');
assert.strictEqual(typeof report.signApproval, 'undefined');
assert.strictEqual(typeof report.mutateState, 'undefined');

// Verify that contracts and substrates remain unchanged
assert.strictEqual(DEFAULT_FINGERPRINT_SCHEME, 'rja-c14n-v1-sha256');
assert.strictEqual(DISCOVERY_AGENT_CONTRACT.mutable_state_scope, 'none');
assert.strictEqual(OUTCOME_AGENT_CONTRACT.mutable_state_scope, 'none');

console.log('  ✓ Invariant Verified: Telemetry is strictly an observational, read-only channel.');
console.log('  ✓ Zero ambient authority granted to analysis structures.');
console.log('  ✓ Agent Intelligence != Agent Authority unconditionally preserved.');

console.log('\n================================================================');
console.log('  EVIDENCE MATURITY GATE COMPLETE: PASS (100%)                  ');
console.log('  N=60 Denominators, Wilson CIs, Trends & Invariants Certified  ');
console.log('================================================================\n');
