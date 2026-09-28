// tests/v5_1_cp002_workday_length_validation.mjs
// Phase v5.1.0: RFC CP-002 Workday Screening Answer Pre-Validation Suite
// Validates client-side/pre-flight character count validation against the 250-character Workday ceiling
// INVARIANT: Pure deterministic validation — NEVER mutates or auto-truncates authoritative artifacts.

import assert from 'node:assert';
import crypto from 'node:crypto';

// Frozen Core & Governed Agent Imports
import { validateWorkdayScreeningAnswers } from '../lib/agents/governance.ts';
import { computeArtifactFingerprint } from '../lib/execution/fingerprint.ts';

console.log('================================================================');
console.log('  RJA V5.1.0: RFC CP-002 WORKDAY CHARACTER PRE-VALIDATION TEST  ');
console.log('  Testing Character Ceiling Enforcement & Artifact Immutability ');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: COMPLIANT WORKDAY SCREENING ANSWERS (< 240 CHARACTERS)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- Test 1: Compliant Workday Answers (< 240 characters) ---');
const compliantAnswers = {
  answers: [
    {
      question_id: 'q1_authorization',
      question: 'Are you authorized to work in the United States?',
      answer: 'Yes, I am a US citizen and do not require sponsorship now or in the future.',
    },
    {
      question_id: 'q2_kubernetes_exp',
      question: 'Describe your production Kubernetes experience.',
      answer: 'Managed 15 multi-tenant Kubernetes clusters in AWS EKS for 4 years with 99.99% availability.',
    },
  ],
};

const result1 = validateWorkdayScreeningAnswers(compliantAnswers, 'workday');
assert.strictEqual(result1.valid, true);
assert.strictEqual(result1.isWorkday, true);
assert.strictEqual(result1.errors.length, 0);
assert.strictEqual(result1.warnings.length, 0);
assert.strictEqual(result1.characterCounts.length, 2);
console.log(`  ✓ Q1 length: ${result1.characterCounts[0].length} chars (Valid)`);
console.log(`  ✓ Q2 length: ${result1.characterCounts[1].length} chars (Valid)`);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: WARNING THRESHOLD (240 - 250 CHARACTERS)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 2: Warning Threshold (240 - 250 characters) ---');
const nearCeilingText = 'A'.repeat(245); // 245 characters
const nearCeilingAnswers = {
  answers: [
    {
      question_id: 'q_near_limit',
      answer: nearCeilingText,
    },
  ],
};

const result2 = validateWorkdayScreeningAnswers(nearCeilingAnswers, 'Workday Portal');
assert.strictEqual(result2.valid, true, '245 chars is still valid (< 250)');
assert.strictEqual(result2.warnings.length, 1);
assert.strictEqual(result2.errors.length, 0);
assert.ok(result2.warnings[0].includes('approaches 250-character ceiling'));
console.log(`  ✓ Emitted expected pre-flight warning: "${result2.warnings[0]}"`);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: CONSTRAINT VIOLATION (> 250 CHARACTERS)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 3: Constraint Violation (> 250 characters on Workday) ---');
const overLimitText = 'B'.repeat(280); // 280 characters
const overLimitAnswers = {
  answers: [
    {
      question_id: 'q_over_limit',
      question: 'Provide a detailed summary of your career accomplishments.',
      answer: overLimitText,
    },
  ],
};

const result3 = validateWorkdayScreeningAnswers(overLimitAnswers, 'workday');
assert.strictEqual(result3.valid, false, 'Over 250 characters MUST fail validation for Workday');
assert.strictEqual(result3.errors.length, 1);
assert.ok(result3.errors[0].includes('exceeds maximum allowed 250 characters'));
assert.strictEqual(result3.characterCounts[0].exceedsLimit, true);
console.log(`  ✓ Caught Workday constraint violation: "${result3.errors[0]}"`);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: STRICT ARTIFACT IMMUTABILITY INVARIANT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 4: Strict Authoritative Artifact Immutability ---');
// Verify that pre-validation NEVER mutates or auto-truncates the input artifact
const originalAnswers = {
  answers: [
    {
      question_id: 'q_immutable_check',
      answer: 'C'.repeat(300), // 300 characters
    },
  ],
};

const hashBefore = crypto
  .createHash('sha256')
  .update(JSON.stringify(originalAnswers))
  .digest('hex');

const result4 = validateWorkdayScreeningAnswers(originalAnswers, 'workday');
assert.strictEqual(result4.valid, false);

const hashAfter = crypto
  .createHash('sha256')
  .update(JSON.stringify(originalAnswers))
  .digest('hex');

assert.strictEqual(
  hashBefore,
  hashAfter,
  'validateWorkdayScreeningAnswers MUST NOT mutate the input artifact under any circumstances'
);
assert.strictEqual(
  originalAnswers.answers[0].answer.length,
  300,
  'Authoritative string must remain untouched without automated truncation'
);
console.log('  ✓ Immutability Verified: Input payload hash preserved byte-for-byte (No silent truncation).');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: NON-WORKDAY DESTINATIONS ARE EXEMPT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 5: Non-Workday Destination Exemption ---');
const longAnswersForGreenhouse = {
  answers: [
    {
      question_id: 'q_gh',
      answer: 'D'.repeat(450), // 450 characters
    },
  ],
};

const resultGreenhouse = validateWorkdayScreeningAnswers(longAnswersForGreenhouse, 'greenhouse');
assert.strictEqual(resultGreenhouse.isWorkday, false);
assert.strictEqual(resultGreenhouse.valid, true);
assert.strictEqual(resultGreenhouse.errors.length, 0);

const resultLever = validateWorkdayScreeningAnswers(longAnswersForGreenhouse, 'lever');
assert.strictEqual(resultLever.isWorkday, false);
assert.strictEqual(resultLever.valid, true);
assert.strictEqual(resultLever.errors.length, 0);
console.log('  ✓ Verified: Non-Workday destinations (Greenhouse, Lever) exempt from Workday character limit.');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: CANONICAL FINGERPRINT INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 6: Canonical Fingerprint Integrity ---');
const artifactPackage = {
  resume: { headline: 'Senior Engineer', skills: ['TypeScript', 'Node.js'] },
  cover_letter: { text: 'Application cover letter...' },
  screening_answers: compliantAnswers,
};

const fpBefore = computeArtifactFingerprint(artifactPackage);
validateWorkdayScreeningAnswers(artifactPackage.screening_answers, 'workday');
const fpAfter = computeArtifactFingerprint(artifactPackage);

assert.strictEqual(
  fpBefore.hash,
  fpAfter.hash,
  'Artifact canonical fingerprint MUST be 100% deterministic and unaffected by validation'
);
console.log(`  ✓ Canonical Fingerprint Unaltered: ${fpBefore.hash.slice(0, 16)}...`);

console.log('\n================================================================');
console.log('  RFC CP-002 WORKDAY VALIDATION TEST PASSED (6/6)               ');
console.log('  Screening answers validated against 250-character ceiling     ');
console.log('  without mutating authoritative artifacts.                     ');
console.log('================================================================');
