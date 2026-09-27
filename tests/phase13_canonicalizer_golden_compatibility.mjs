// tests/phase13_canonicalizer_golden_compatibility.mjs
// Phase 13 / v4.6.1: Permanent Golden Fixture Compatibility Suite for Cryptographic Canonicalizer
//
// Freezes the canonicalization contract (rja-c14n-v1-sha256) across 5 golden artifacts:
//   1. artifact-basic.json
//   2. artifact-unicode.json
//   3. artifact-newlines.json
//   4. artifact-nested.json
//   5. artifact-duplicate-question-ids.json
//
// Enforces that future modifications to fingerprint.ts MUST strictly prove:
//   existing_digest === new_digest
// unless the canonicalization specification itself is deliberately bumped to v2.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  canonicalizeArtifactContent,
  computeArtifactFingerprint,
  verifyArtifactFingerprint,
  DEFAULT_FINGERPRINT_SCHEME,
} from '../lib/execution/fingerprint.ts';

console.log('================================================================');
console.log('  RJA V4.6.1: CANONICALIZER GOLDEN COMPATIBILITY SUITE          ');
console.log('  Specification Freeze: rja-c14n-v1-sha256                      ');
console.log('================================================================\n');

const FIXTURES_DIR = path.resolve('tests/fixtures/canonicalization');
assert.ok(fs.existsSync(FIXTURES_DIR), `Fixtures directory must exist at ${FIXTURES_DIR}`);

const REQUIRED_FIXTURES = [
  'artifact-basic.json',
  'artifact-unicode.json',
  'artifact-newlines.json',
  'artifact-nested.json',
  'artifact-duplicate-question-ids.json',
];

console.log('Part 1: Verifying Golden Fixture Existence & Schema...');
for (const file of REQUIRED_FIXTURES) {
  const filePath = path.join(FIXTURES_DIR, file);
  assert.ok(fs.existsSync(filePath), `Required golden fixture missing: ${file}`);
}
console.log(`  ✓ All ${REQUIRED_FIXTURES.length} golden fixtures present on disk.\n`);

console.log('Part 2: Asserting Invariant Canonical Representation & SHA-256 Digest against Golden Masters...');

for (const file of REQUIRED_FIXTURES) {
  const filePath = path.join(FIXTURES_DIR, file);
  const fixture = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  assert.strictEqual(
    fixture.schema_version,
    DEFAULT_FINGERPRINT_SCHEME,
    `Fixture ${file} must target schema version ${DEFAULT_FINGERPRINT_SCHEME}`
  );

  // 1. Recompute canonical string representation
  const actualCanonical = canonicalizeArtifactContent(fixture.content);
  assert.strictEqual(
    actualCanonical,
    fixture.expected_canonical,
    `Canonical string representation diverged from golden master for ${file}`
  );

  // 2. Recompute SHA-256 digest directly over canonical string
  const actualDigest = crypto.createHash('sha256').update(actualCanonical, 'utf8').digest('hex');
  assert.strictEqual(
    actualDigest,
    fixture.expected_digest,
    `SHA-256 digest diverged from golden master for ${file}`
  );

  // 3. Verify high-level fingerprint generation
  const fp = computeArtifactFingerprint(fixture.content);
  assert.strictEqual(fp.hash, fixture.expected_digest);
  assert.strictEqual(fp.algorithm, 'sha256');
  assert.strictEqual(fp.fingerprint_algorithm, DEFAULT_FINGERPRINT_SCHEME);
  assert.strictEqual(fp.canonicalization_scheme, DEFAULT_FINGERPRINT_SCHEME);

  // 4. Verify round-trip verification helper
  const verification = verifyArtifactFingerprint(fixture.content, fixture.expected_digest);
  assert.strictEqual(verification.valid, true, `verifyArtifactFingerprint failed for ${file}`);

  console.log(`  ✓ Golden Fixture [${fixture.name}]:`);
  console.log(`      Digest: ${actualDigest}`);
  console.log(`      Scheme: ${fp.fingerprint_algorithm} (Verified matching master)`);
}

console.log('\nPart 3: Formal Distinction: Representation Equivalence vs Semantic Equivalence...');

// Normalizing CRLF -> LF is a representation-level transformation (MUST preserve digest)
const crlfHeadline = 'Principal Systems Architect\r\nSpecialized in Distributed Systems.';
const lfHeadline = 'Principal Systems Architect\nSpecialized in Distributed Systems.';
const fpCRLF = computeArtifactFingerprint({
  resume: { full_resume: crlfHeadline },
  cover_letter: { letter: 'L' },
  screening_answers: { answers: [] },
});
const fpLF = computeArtifactFingerprint({
  resume: { full_resume: lfHeadline },
  cover_letter: { letter: 'L' },
  screening_answers: { answers: [] },
});
assert.strictEqual(
  fpCRLF.hash,
  fpLF.hash,
  'Transport line endings (\\r\\n vs \\n) establish representation equivalence and preserve digest'
);
console.log('  ✓ Test 3.1: Representation-level normalization (\\r\\n vs \\n) preserves digest.');

// Changing "Senior Project Manager" -> "Project Manager" is a semantic mutation (MUST alter digest)
const seniorHeadline = 'Senior Project Manager';
const droppedHeadline = 'Project Manager';
const fpSenior = computeArtifactFingerprint({
  resume: { headline: seniorHeadline },
  cover_letter: { letter: 'L' },
  screening_answers: { answers: [] },
});
const fpDropped = computeArtifactFingerprint({
  resume: { headline: droppedHeadline },
  cover_letter: { letter: 'L' },
  screening_answers: { answers: [] },
});
assert.notStrictEqual(
  fpSenior.hash,
  fpDropped.hash,
  'Semantic alteration ("Senior Project Manager" -> "Project Manager") must strictly alter digest'
);
console.log('  ✓ Test 3.2: Content/semantic mutation ("Senior Project Manager" -> "Project Manager") strictly detected.');

console.log('\n================================================================');
console.log('  ALL V4.6.1 GOLDEN COMPATIBILITY CHECKS PASSED (5/5 FIXTURES)  ');
console.log('  Specification rja-c14n-v1-sha256 contract FROZEN & PROTECTED  ');
console.log('================================================================');
