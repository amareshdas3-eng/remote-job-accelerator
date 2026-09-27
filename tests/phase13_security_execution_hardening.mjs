// tests/phase13_security_execution_hardening.mjs
// Phase 13 / v4.6 Security Baseline: Byte-Level Cryptographic Canonicalization & Abuse Defense
//
// Covers:
// Part 1: Byte-Level Cryptographic Canonicalization
//   1.1 Newline transport normalization (\r\n vs \n)
//   1.2 Internal whitespace defense ("Project Manager" vs "Project  Manager")
//   1.3 Unicode normalization (NFC precomposed vs decomposed)
//   1.4 Unicode homoglyph attack defense (Cyrillic 'а' vs Latin 'a')
//   1.5 JSON serialization key-ordering invariance
//   1.6 Answer array re-ordering invariance & substantive mutation defense
//
// Part 2: 12 Abuse & Attack Scenarios
//   2.1 Tampered artifact content post-approval (MUTATION_BLOCKED)
//   2.2 Tampered / forged artifact fingerprint (MUTATION_BLOCKED)
//   2.3 Forged / invalid reviewer signature (APPROVAL_REQUIRED)
//   2.4 Missing approval date / invalid timestamp (APPROVAL_REQUIRED)
//   2.5 Stale evidence snapshot binding (SNAPSHOT_MISMATCH)
//   2.6 Duplicate execution & Idempotent receipt return
//   2.7 Replay of execution request to already-dispatched destination
//   2.8 Destination redirection attack after approval (DESTINATION_MISMATCH)
//   2.9 In-flight payload mutation detection
//   2.10 Concurrent execution race condition defense (CONCURRENT_EXECUTION_BLOCKED)
//   2.11 Transient dispatch failure & safe retry recovery
//   2.12 Out-of-sequence outcome state transition defense (TRANSITION_INVALID)

import assert from 'node:assert/strict';
import {
  normalizeText,
  deterministicStringify,
  canonicalizeArtifactContent,
  computeArtifactFingerprint,
  verifyArtifactFingerprint,
} from '../lib/execution/fingerprint.ts';
import {
  executeApplicationPackage,
  acquireExecutionLock,
  releaseExecutionLock,
} from '../lib/execution/engine.ts';
import {
  createOutcomeEvent,
  validateOutcomeTransition,
} from '../lib/execution/stateMachine.ts';
import { createEvidenceSnapshot } from '../lib/execution/snapshot.ts';

console.log('================================================================');
console.log('  RJA V4.6: EXECUTION SECURITY & BYTE-LEVEL CANONICALIZATION   ');
console.log('================================================================\n');

// -------------------------------------------------------------
// Test Fixtures
// -------------------------------------------------------------
const baseResume = {
  headline: 'Principal Infrastructure Engineer',
  summary: '14+ years directing high-voltage substation engineering.',
  full_resume: 'Jordan Vance, PE, PMP.\nDirecting high-voltage substation engineering.',
};

const baseCover = {
  recipient: 'Hiring Committee',
  letter: 'Dear Hiring Committee,\nI am writing to apply for the Principal Systems Architect role.',
};

const baseAnswers = {
  answers: [
    { question: 'What is your remote experience?', answer: '10+ years distributed leadership.' },
    { question: 'Notice period?', answer: '3 weeks.' },
  ],
};

const approvedPayload = {
  resume: baseResume,
  cover_letter: baseCover,
  screening_answers: baseAnswers,
};

// =============================================================
// PART 1: Byte-Level Cryptographic Canonicalization
// =============================================================
console.log('Part 1: Auditing Byte-Level Canonicalization & Hashing Invariants...');

// 1.1 Newline transport normalization: \r\n vs \n
const crlfPayload = {
  resume: {
    ...baseResume,
    full_resume: baseResume.full_resume.replace(/\n/g, '\r\n'),
  },
  cover_letter: {
    ...baseCover,
    letter: baseCover.letter.replace(/\n/g, '\r\n'),
  },
  screening_answers: baseAnswers,
};

const fpLF = computeArtifactFingerprint(approvedPayload);
const fpCRLF = computeArtifactFingerprint(crlfPayload);
assert.strictEqual(
  fpLF.hash,
  fpCRLF.hash,
  'Transport line endings (\\r\\n vs \\n) must canonicalize to identical SHA-256'
);
console.log('  ✓ Test 1.1: Transport newline normalization (CRLF vs LF) produces identical fingerprint.');

// 1.2 Internal whitespace defense: "Project Manager" vs "Project  Manager"
const doubleSpacePayload = {
  resume: {
    ...baseResume,
    full_resume: baseResume.full_resume.replace('high-voltage', 'high-voltage '), // added double space
  },
  cover_letter: baseCover,
  screening_answers: baseAnswers,
};
const fpDoubleSpace = computeArtifactFingerprint(doubleSpacePayload);
assert.notStrictEqual(
  fpLF.hash,
  fpDoubleSpace.hash,
  'Internal whitespace mutation must alter SHA-256'
);
console.log('  ✓ Test 1.2: Internal whitespace alteration strictly alters fingerprint.');

// 1.3 Unicode normalization (NFC)
// "café" can be written as precomposed \u00e9 or decomposed e + \u0301
const nfcText = 'Specialized in café automation.';
const nfdText = 'Specialized in cafe\u0301 automation.';
assert.notStrictEqual(nfcText, nfdText, 'Raw strings have different byte representations');
assert.strictEqual(
  normalizeText(nfcText),
  normalizeText(nfdText),
  'normalizeText must canonicalize NFC and NFD to identical characters'
);
const fpNFC = computeArtifactFingerprint({
  resume: { full_resume: nfcText },
  cover_letter: { letter: 'Cover' },
  screening_answers: { answers: [] },
});
const fpNFD = computeArtifactFingerprint({
  resume: { full_resume: nfdText },
  cover_letter: { letter: 'Cover' },
  screening_answers: { answers: [] },
});
assert.strictEqual(fpNFC.hash, fpNFD.hash, 'NFC and NFD Unicode variants must produce identical fingerprint');
console.log('  ✓ Test 1.3: Unicode NFC canonicalization equates decomposed and precomposed glyphs.');

// 1.4 Unicode homoglyph attack defense
// Latin 'a' (U+0061) vs Cyrillic 'а' (U+0430)
const latinTitle = 'Principal Architect';
const cyrillicTitle = 'Principаl Architect'; // second 'a' is Cyrillic U+0430
assert.notStrictEqual(latinTitle, cyrillicTitle);
const fpLatin = computeArtifactFingerprint({
  resume: { full_resume: latinTitle },
  cover_letter: { letter: 'Cover' },
  screening_answers: { answers: [] },
});
const fpCyrillic = computeArtifactFingerprint({
  resume: { full_resume: cyrillicTitle },
  cover_letter: { letter: 'Cover' },
  screening_answers: { answers: [] },
});
assert.notStrictEqual(fpLatin.hash, fpCyrillic.hash, 'Homoglyph substitution must alter SHA-256');
console.log('  ✓ Test 1.4: Unicode homoglyph substitution attack strictly caught by fingerprint.');

// 1.5 JSON serialization key-ordering invariance
const objA = { z_domain: 'Power', a_license: 'PE', m_years: 14 };
const objB = { a_license: 'PE', m_years: 14, z_domain: 'Power' };
assert.strictEqual(
  deterministicStringify(objA),
  deterministicStringify(objB),
  'deterministicStringify must produce identical string regardless of key insertion order'
);
console.log('  ✓ Test 1.5: Object key insertion ordering produces deterministic string serialization.');

// 1.6 Answer array order invariance vs substantive mutation
const reorderedAnswersPayload = {
  resume: baseResume,
  cover_letter: baseCover,
  screening_answers: {
    answers: [
      { question: 'Notice period?', answer: '3 weeks.' }, // reversed order
      { question: 'What is your remote experience?', answer: '10+ years distributed leadership.' },
    ],
  },
};
const fpReordered = computeArtifactFingerprint(reorderedAnswersPayload);
assert.strictEqual(
  fpLF.hash,
  fpReordered.hash,
  'Answer array re-ordering must produce identical canonical fingerprint'
);

const mutatedAnswerPayload = {
  resume: baseResume,
  cover_letter: baseCover,
  screening_answers: {
    answers: [
      { question: 'What is your remote experience?', answer: '10+ years distributed leadership.' },
      { question: 'Notice period?', answer: 'Immediate start.' }, // altered answer
    ],
  },
};
const fpMutatedAnswer = computeArtifactFingerprint(mutatedAnswerPayload);
assert.notStrictEqual(
  fpLF.hash,
  fpMutatedAnswer.hash,
  'Substantive answer modification must strictly alter fingerprint'
);
console.log('  ✓ Test 1.6: Answer array deterministic sorting verified & substantive modification caught.');

console.log('✓ Part 1 PASSED: Byte-level cryptographic canonicalization verified.\n');

// =============================================================
// PART 2: 12 Abuse & Attack Scenarios
// =============================================================
console.log('Part 2: Executing 12 Security & Abuse Attack Simulations...');

const approvedArtifact = {
  id: 'art-approved-900',
  application_id: 'app-9001',
  evidence_snapshot_id: 'ev-snap-authentic-44',
  destination: 'https://careers.company.com/apply',
  fingerprint: fpLF,
  approved_by: 'Jordan Vance (Candidate Signed)',
  approved_at: '2026-09-27T10:00:00.000Z',
  content: approvedPayload,
};

// 2.1 Tampered Artifact (MUTATION_BLOCKED)
const tamperedPayload = {
  resume: {
    ...baseResume,
    full_resume: 'Jordan Vance, PhD. Fabricated degree.',
  },
  cover_letter: baseCover,
  screening_answers: baseAnswers,
};
const resTampered = executeApplicationPackage({
  applicationId: 'app-9001',
  approvedArtifact,
  currentContent: tamperedPayload,
  destination: 'https://careers.company.com/apply',
  route: 'website',
});
assert.strictEqual(resTampered.success, false);
assert.strictEqual(resTampered.code, 'MUTATION_BLOCKED');
assert.strictEqual(resTampered.attempt?.status, 'blocked');
console.log('  ✓ Scenario 1: Tampered artifact content post-approval triggers HARD BLOCK.');

// 2.2 Tampered / Forged Fingerprint (MUTATION_BLOCKED)
const forgedArtifact = {
  ...approvedArtifact,
  fingerprint: {
    ...fpLF,
    hash: '0000000000000000000000000000000000000000000000000000000000000000',
  },
};
const resForgedFP = executeApplicationPackage({
  applicationId: 'app-9001',
  approvedArtifact: forgedArtifact,
  currentContent: approvedPayload,
  destination: 'https://careers.company.com/apply',
  route: 'website',
});
assert.strictEqual(resForgedFP.success, false);
assert.strictEqual(resForgedFP.code, 'MUTATION_BLOCKED');
console.log('  ✓ Scenario 2: Forged fingerprint in approved artifact record triggers HARD BLOCK.');

// 2.3 Forged / Invalid Reviewer Signature (APPROVAL_REQUIRED)
const invalidSignatures = ['', ' ', 'A', '   \t\n   '];
for (const badSig of invalidSignatures) {
  const badSigArtifact = {
    ...approvedArtifact,
    approved_by: badSig,
  };
  const resBadSig = executeApplicationPackage({
    applicationId: 'app-9001',
    approvedArtifact: badSigArtifact,
    currentContent: approvedPayload,
    destination: 'https://careers.company.com/apply',
    route: 'website',
  });
  assert.strictEqual(resBadSig.success, false);
  assert.strictEqual(resBadSig.code, 'APPROVAL_REQUIRED');
}
console.log('  ✓ Scenario 3: Missing, empty, or whitespace-only reviewer signatures strictly rejected.');

// 2.4 Missing Approval Date / Invalid Timestamp (APPROVAL_REQUIRED)
const badDateArtifact = {
  ...approvedArtifact,
  approved_at: 'not-a-valid-iso-date',
};
const resBadDate = executeApplicationPackage({
  applicationId: 'app-9001',
  approvedArtifact: badDateArtifact,
  currentContent: approvedPayload,
  destination: 'https://careers.company.com/apply',
  route: 'website',
});
assert.strictEqual(resBadDate.success, false);
assert.strictEqual(resBadDate.code, 'APPROVAL_REQUIRED');
console.log('  ✓ Scenario 4: Invalid approval timestamp strictly rejected.');

// 2.5 Stale Evidence Snapshot Binding (SNAPSHOT_MISMATCH)
const resSnapshotMismatch = executeApplicationPackage({
  applicationId: 'app-9001',
  approvedArtifact,
  currentContent: approvedPayload,
  destination: 'https://careers.company.com/apply',
  route: 'website',
  expectedSnapshotId: 'ev-snap-mutated-99', // drifted snapshot
});
assert.strictEqual(resSnapshotMismatch.success, false);
assert.strictEqual(resSnapshotMismatch.code, 'SNAPSHOT_MISMATCH');
console.log('  ✓ Scenario 5: Drifted / stale evidence snapshot mismatch halted prior to dispatch.');

// 2.6 Duplicate Execution & Idempotent Receipt Return
// First execution:
const resFirstExec = executeApplicationPackage({
  applicationId: 'app-9001',
  approvedArtifact,
  currentContent: approvedPayload,
  destination: 'https://careers.company.com/apply',
  route: 'website',
});
assert.strictEqual(resFirstExec.success, true);
assert.ok(resFirstExec.receipt);
const existingReceipt = resFirstExec.receipt;

// Duplicate call with strict rejection:
const resStrictDup = executeApplicationPackage({
  applicationId: 'app-9001',
  approvedArtifact,
  currentContent: approvedPayload,
  destination: 'https://careers.company.com/apply',
  route: 'website',
  existingReceipts: [existingReceipt],
});
assert.strictEqual(resStrictDup.success, false);
assert.strictEqual(resStrictDup.code, 'DUPLICATE_SUBMISSION');
assert.strictEqual(resStrictDup.existingReceipt?.id, existingReceipt.id);

// Duplicate call with transparent idempotent receipt recovery:
const resIdempotentRecovery = executeApplicationPackage({
  applicationId: 'app-9001',
  approvedArtifact,
  currentContent: approvedPayload,
  destination: 'https://careers.company.com/apply',
  route: 'website',
  existingReceipts: [existingReceipt],
  idempotentReturnExisting: true,
});
assert.strictEqual(resIdempotentRecovery.success, true);
assert.strictEqual(resIdempotentRecovery.is_idempotent, true);
assert.strictEqual(resIdempotentRecovery.receipt.id, existingReceipt.id);
console.log('  ✓ Scenario 6: Idempotent dispatch strictly prevents duplicate submission and returns existing receipt.');

// 2.7 Replay of Old Execution Request
// Attempting to replay with existing receipts to same destination
const resReplay = executeApplicationPackage({
  applicationId: 'app-9001',
  approvedArtifact,
  currentContent: approvedPayload,
  destination: 'https://careers.company.com/apply',
  route: 'website',
  existingReceipts: [existingReceipt],
});
assert.strictEqual(resReplay.success, false);
assert.strictEqual(resReplay.code, 'DUPLICATE_SUBMISSION');
console.log('  ✓ Scenario 7: Replay of past execution request strictly deflected by idempotency barrier.');

// 2.8 Destination Change After Approval (DESTINATION_MISMATCH)
const resDestMismatch = executeApplicationPackage({
  applicationId: 'app-9001',
  approvedArtifact,
  currentContent: approvedPayload,
  destination: 'https://unauthorized-destination.com/submit', // different target
  route: 'website',
});
assert.strictEqual(resDestMismatch.success, false);
assert.strictEqual(resDestMismatch.code, 'DESTINATION_MISMATCH');
console.log('  ✓ Scenario 8: Post-approval destination redirection strictly blocked.');

// 2.9 Payload Mutation During Dispatch
const inTransitMutatedContent = JSON.parse(JSON.stringify(approvedPayload));
inTransitMutatedContent.cover_letter.recipient = 'Executive Board (Injected)';
const resInTransit = executeApplicationPackage({
  applicationId: 'app-9001',
  approvedArtifact,
  currentContent: inTransitMutatedContent,
  destination: 'https://careers.company.com/apply',
  route: 'website',
});
assert.strictEqual(resInTransit.success, false);
assert.strictEqual(resInTransit.code, 'MUTATION_BLOCKED');
console.log('  ✓ Scenario 9: In-transit payload tampering blocked by pre-dispatch verification.');

// 2.10 Concurrent Execution Race Condition Defense
// Simulate an execution acquiring lock
const lockAcquired = acquireExecutionLock('app-concurrent-55');
assert.strictEqual(lockAcquired, true);
// Second execution attempt while lock is held
const resConcurrent = executeApplicationPackage({
  applicationId: 'app-concurrent-55',
  approvedArtifact: {
    ...approvedArtifact,
    application_id: 'app-concurrent-55',
  },
  currentContent: approvedPayload,
  destination: 'https://careers.company.com/apply',
  route: 'website',
});
assert.strictEqual(resConcurrent.success, false);
assert.strictEqual(resConcurrent.code, 'CONCURRENT_EXECUTION_BLOCKED');
releaseExecutionLock('app-concurrent-55');
console.log('  ✓ Scenario 10: Concurrent execution race condition strictly blocked by in-flight lock.');

// 2.11 Transient Dispatch Failure & Safe Retry Recovery
// Step A: First attempt encounters simulated remote gateway failure
const resFailedDispatch = executeApplicationPackage({
  applicationId: 'app-retry-99',
  approvedArtifact: {
    ...approvedArtifact,
    application_id: 'app-retry-99',
  },
  currentContent: approvedPayload,
  destination: 'https://careers.company.com/apply',
  route: 'website',
  simulateDispatchFailure: true,
});
assert.strictEqual(resFailedDispatch.success, false);
assert.strictEqual(resFailedDispatch.code, 'DISPATCH_FAILED');
assert.strictEqual(resFailedDispatch.attempt?.status, 'failed');

// Step B: Retry with the exact same approved artifact and no existing receipts succeeds!
const resRetrySuccess = executeApplicationPackage({
  applicationId: 'app-retry-99',
  approvedArtifact: {
    ...approvedArtifact,
    application_id: 'app-retry-99',
  },
  currentContent: approvedPayload,
  destination: 'https://careers.company.com/apply',
  route: 'website',
  simulateDispatchFailure: false,
});
assert.strictEqual(resRetrySuccess.success, true);
assert.strictEqual(resRetrySuccess.attempt.status, 'confirmed');
assert.ok(resRetrySuccess.receipt);
console.log('  ✓ Scenario 11: Transient dispatch failure logs failed attempt and allows clean retry recovery.');

// 2.12 Out-of-Sequence Outcome State Transition Defense
// Case A: Cannot jump to 'offer' without initial 'applied'
const checkNoApplied = validateOutcomeTransition([], 'offer');
assert.strictEqual(checkNoApplied.valid, false);
assert.ok(checkNoApplied.reason?.includes('must be \'applied\''));

// Case B: Transition after terminal state 'rejected' is blocked
const rejectedHistory = [
  createOutcomeEvent({ applicationId: 'app-100', userId: 'u1', type: 'applied' }),
  createOutcomeEvent({ applicationId: 'app-100', userId: 'u1', type: 'rejected' }),
];
const checkAfterTerminal = validateOutcomeTransition(rejectedHistory, 'interview');
assert.strictEqual(checkAfterTerminal.valid, false);
assert.ok(checkAfterTerminal.reason?.includes('terminal state'));

// Case C: Transition check with throw option in createOutcomeEvent
assert.throws(() => {
  createOutcomeEvent({
    applicationId: 'app-100',
    userId: 'u1',
    type: 'offer',
    existingEvents: rejectedHistory,
    strictTransitionCheck: true,
  });
}, /TRANSITION_INVALID/);

// Case D: Valid sequential transitions pass
const validHistory = [
  createOutcomeEvent({ applicationId: 'app-100', userId: 'u1', type: 'applied' }),
];
const checkValidSeq = validateOutcomeTransition(validHistory, 'recruiter_response');
assert.strictEqual(checkValidSeq.valid, true);

console.log('  ✓ Scenario 12: Out-of-sequence and terminal outcome state transitions strictly blocked.');

console.log('✓ Part 2 PASSED: All 12 security & abuse attack simulations verified.\n');

console.log('================================================================');
console.log('  ALL V4.6 EXECUTION SECURITY & ABUSE CHECKS PASSED (100%)       ');
console.log('================================================================');
