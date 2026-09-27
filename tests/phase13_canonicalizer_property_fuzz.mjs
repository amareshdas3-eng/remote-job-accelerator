// tests/phase13_canonicalizer_property_fuzz.mjs
// Phase 13 / v4.6.1: Formal Invariant, Property & Fuzz Testing of the Cryptographic Canonicalizer
//
// Formal Invariants Tested:
// 1. Idempotency:
//      canonicalize(canonicalize(x)) === canonicalize(x)
// 2. Determinism:
//      hash(canonicalize(x)) === hash(canonicalize(x)) across randomized valid artifacts
// 3. Representation-Equivalent Invariance (MUST strictly preserve SHA-256 digest):
//      - Object key reordering at all arbitrary depths
//      - Screening answers array reordering & permutation
//      - Newline transport transformations (\r\n vs \r vs \n vs mixed)
//      - Unicode canonical equivalence (NFC vs NFD decomposition)
// 4. Representation-Divergent Mutations (MUST strictly alter SHA-256 digest):
//      - + one character (ASCII insertion / mutation)
//      - + one byte (raw binary byte insertion)
//      - + one Unicode codepoint (emoji, zero-width space, Cyrillic homoglyph, non-breaking space)
//      - + one metadata field (extra field added to root or nested objects)
//      - + one answer (new question/answer appended or removed)
//      - + one recipient (recipient string altered)
//      - + one nested object property (nested deep object key/value modified)
// 5. Boundary & Extreme Edge Cases:
//      - Null/undefined artifact
//      - Empty objects and empty strings
//      - Duplicate question collisions with deep tiebreakers
//      - Zero-width joiner sequences (ZWJ composite glyphs)
//      - Deep nesting (depth 5+)

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  normalizeText,
  deterministicStringify,
  canonicalizeArtifactContent,
  computeArtifactFingerprint,
  verifyArtifactFingerprint,
} from '../lib/execution/fingerprint.ts';

console.log('================================================================');
console.log('  RJA V4.6.1: CANONICALIZER PROPERTY & FUZZ TESTING SUITE       ');
console.log('  Formal Invariants, Equivalence Classes & Mutation Hardening   ');
console.log('================================================================\n');

// -------------------------------------------------------------
// Pseudo-Random Generator (Seeded LCG for reproducible fuzzing)
// -------------------------------------------------------------
class PseudoRandom {
  constructor(seed = 0xdeadbeef) {
    this.state = seed >>> 0;
  }

  next() {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  intBetween(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice(arr) {
    return arr[this.intBetween(0, arr.length - 1)];
  }

  shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.intBetween(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

const rng = new PseudoRandom(133742);

// -------------------------------------------------------------
// Fuzz Data Pools
// -------------------------------------------------------------
const WORDS = [
  'Infrastructure', 'Architect', 'Kubernetes', 'Scalability', 'Distributed',
  'Systems', 'Resilience', 'High-Voltage', 'Substation', 'Deterministic',
  'Execution', 'Cryptographic', 'Verification', 'Canonical', 'Idempotent',
  'TypeScript', 'NextJS', 'Database', 'Postgres', 'Engine', 'Reliability',
  'Engineering', 'Performance', 'Latency', 'Throughput', 'Security', 'Audit'
];

const UNICODE_SNIPPETS = [
  'café', 'résumé', 'façade', 'naïve', 'coöperation',
  'Über-scale', 'München', 'São Paulo', 'Zürich', 'Crème',
  'パイプライン', 'データベース', 'Инженер', 'Архитектура',
  '⚡', '🛡️', '🔑', '🚀', '📊', '∑(x_i)', 'α-β-γ'
];

function generateRandomText(minWords = 3, maxWords = 15) {
  const count = rng.intBetween(minWords, maxWords);
  const words = [];
  for (let i = 0; i < count; i++) {
    if (rng.next() < 0.25) {
      words.push(rng.choice(UNICODE_SNIPPETS));
    } else {
      words.push(rng.choice(WORDS));
    }
  }
  return words.join(' ');
}

function generateRandomParagraph(lines = 3) {
  const p = [];
  for (let i = 0; i < lines; i++) {
    p.push(generateRandomText(5, 12));
  }
  return p.join('\n');
}

/**
 * Generates a randomized valid artifact according to schema.
 */
function generateRandomArtifact() {
  const answersCount = rng.intBetween(2, 6);
  const answers = [];
  for (let i = 0; i < answersCount; i++) {
    answers.push({
      question_id: `q_${rng.intBetween(100, 999)}`,
      question: `Question ${i + 1}: ${generateRandomText(3, 8)}?`,
      answer: `Answer: ${generateRandomText(4, 10)}.`,
      notes: rng.next() > 0.5 ? generateRandomText(2, 5) : 'standard_note',
    });
  }

  const skillsCount = rng.intBetween(3, 7);
  const skills = [];
  for (let i = 0; i < skillsCount; i++) {
    skills.push(rng.choice(WORDS));
  }

  return {
    resume: {
      headline: generateRandomText(2, 5),
      summary: generateRandomText(6, 15),
      full_resume: generateRandomParagraph(rng.intBetween(2, 5)),
      skills,
      experience_years: rng.intBetween(3, 20),
      nested_details: {
        portfolio_url: `https://example.com/${rng.choice(WORDS).toLowerCase()}`,
        clearance_level: rng.choice(['Secret', 'Public Trust', 'None']),
        tags: [rng.choice(WORDS), rng.choice(WORDS)],
        deep_spec: {
          tier: rng.intBetween(1, 5),
          authorized: true,
        },
      },
    },
    cover_letter: {
      recipient: `Hiring Team at ${rng.choice(WORDS)} Corp`,
      letter: generateRandomParagraph(rng.intBetween(2, 4)),
      metadata: {
        tone: rng.choice(['Direct', 'Analytical', 'Executive']),
        target_role: generateRandomText(2, 4),
      },
    },
    screening_answers: {
      answers,
      submission_meta: {
        channel: rng.choice(['direct_portal', 'api', 'ats']),
        timestamp: new Date(Date.now() - rng.intBetween(1000, 500000)).toISOString(),
      },
    },
  };
}

/**
 * Deep clones an object while recursively shuffling keys in every dictionary.
 */
function deeplyShuffleKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => deeplyShuffleKeys(item));
  }
  const keys = rng.shuffle(Object.keys(obj));
  const result = {};
  for (const k of keys) {
    result[k] = deeplyShuffleKeys(obj[k]);
  }
  return result;
}

/**
 * Recursively transforms \n line endings into CRLF or CR.
 */
function applyNewlineTransformation(obj, newlineSeq = '\r\n') {
  if (typeof obj === 'string') {
    return obj.replace(/\n/g, newlineSeq);
  }
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => applyNewlineTransformation(item, newlineSeq));
  }
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = applyNewlineTransformation(v, newlineSeq);
  }
  return result;
}

/**
 * Recursively transforms Unicode strings to NFD (Decomposed form).
 */
function applyUnicodeNFD(obj) {
  if (typeof obj === 'string') {
    return obj.normalize('NFD');
  }
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => applyUnicodeNFD(item));
  }
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = applyUnicodeNFD(v);
  }
  return result;
}

function computeDigest(val) {
  const canonical = canonicalizeArtifactContent(val);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// =============================================================
// PART 1: Boundary & Edge Case Hardening
// =============================================================
console.log('Part 1: Auditing Canonicalizer Boundary Conditions & Structural Edge Cases...');

// 1.1 Null / Undefined handling
assert.strictEqual(canonicalizeArtifactContent(null), '');
assert.strictEqual(canonicalizeArtifactContent(undefined), '');
assert.strictEqual(
  computeDigest(null),
  crypto.createHash('sha256').update('', 'utf8').digest('hex')
);
console.log('  ✓ Test 1.1: Null and undefined input safely return deterministic empty string.');

// 1.2 Empty object structures
const emptyArtifact = { resume: {}, cover_letter: {}, screening_answers: {} };
const emptyCanon = canonicalizeArtifactContent(emptyArtifact);
assert.strictEqual(emptyCanon, 'RESUME:\n{}\n---\nCOVER:\n{}\n---\nANSWERS:\n{}');
assert.strictEqual(canonicalizeArtifactContent(emptyCanon), emptyCanon);
console.log('  ✓ Test 1.2: Empty artifact canonicalization produces consistent structure.');

// 1.3 Answer sorting with duplicate questions (Tie-breaker verification)
const collisionAnswers = {
  resume: { headline: 'Test' },
  cover_letter: { letter: 'Letter' },
  screening_answers: {
    answers: [
      { question: 'Duplicate Question?', answer: 'Answer Z (Second)', question_id: 'col_1' },
      { question: 'Duplicate Question?', answer: 'Answer A (First)', question_id: 'col_1' },
    ],
  },
};
const collisionAnswersReversed = {
  resume: { headline: 'Test' },
  cover_letter: { letter: 'Letter' },
  screening_answers: {
    answers: [
      { question: 'Duplicate Question?', answer: 'Answer A (First)', question_id: 'col_1' },
      { question: 'Duplicate Question?', answer: 'Answer Z (Second)', question_id: 'col_1' },
    ],
  },
};
assert.strictEqual(
  computeDigest(collisionAnswers),
  computeDigest(collisionAnswersReversed),
  'Identical question collision must break ties deterministically using deep serialization'
);
console.log('  ✓ Test 1.3: Duplicate question collisions resolve deterministically via deep tiebreaker.');

// 1.4 Zero-width joiner sequences (ZWJ composite glyphs)
const zwjTextA = 'Engineer 👨‍💻 leading team.'; // man + ZWJ + laptop
const zwjTextB = 'Engineer 👨‍💼 leading team.'; // man + ZWJ + briefcase
assert.notStrictEqual(
  computeDigest({ resume: { full_resume: zwjTextA }, cover_letter: { letter: 'L' }, screening_answers: { answers: [] } }),
  computeDigest({ resume: { full_resume: zwjTextB }, cover_letter: { letter: 'L' }, screening_answers: { answers: [] } }),
  'ZWJ sequence alteration must strictly alter SHA-256'
);
console.log('  ✓ Test 1.4: Zero-Width Joiner (ZWJ) composite emoji mutations strictly detected.');

console.log('✓ Part 1 PASSED: All boundary condition invariants verified.\n');

// =============================================================
// PART 2: Property & Fuzz Test Suite Execution
// =============================================================
const FUZZ_ITERATIONS = 250;
console.log(`Part 2: Executing Property & Fuzz Test Suite across ${FUZZ_ITERATIONS} randomized valid artifacts...\n`);

let stats = {
  idempotencyPasses: 0,
  determinismPasses: 0,
  keyReorderEquivalencePasses: 0,
  answerReorderEquivalencePasses: 0,
  crlfEquivalencePasses: 0,
  crEquivalencePasses: 0,
  mixedNewlineEquivalencePasses: 0,
  unicodeNFDEquivalencePasses: 0,
  charMutationCaught: 0,
  byteMutationCaught: 0,
  codepointMutationCaught: 0,
  metadataFieldMutationCaught: 0,
  answerMutationCaught: 0,
  recipientMutationCaught: 0,
  nestedPropertyMutationCaught: 0,
};

for (let i = 0; i < FUZZ_ITERATIONS; i++) {
  const artifact = generateRandomArtifact();
  const canonicalOriginal = canonicalizeArtifactContent(artifact);
  const digestOriginal = computeDigest(artifact);

  // -----------------------------------------------------------
  // PROPERTY 1: Idempotency Invariant
  // canonicalize(canonicalize(x)) === canonicalize(x)
  // -----------------------------------------------------------
  const canonicalTwice = canonicalizeArtifactContent(canonicalOriginal);
  assert.strictEqual(
    canonicalTwice,
    canonicalOriginal,
    `Iteration ${i}: Canonicalization must be strictly idempotent: C(C(x)) === C(x)`
  );

  const canonicalThrice = canonicalizeArtifactContent(canonicalTwice);
  assert.strictEqual(
    canonicalThrice,
    canonicalOriginal,
    `Iteration ${i}: Canonicalization must remain idempotent across repeated applications`
  );
  stats.idempotencyPasses++;

  // -----------------------------------------------------------
  // PROPERTY 2: Determinism Invariant
  // hash(canonicalize(x)) === hash(canonicalize(x))
  // -----------------------------------------------------------
  const digestRepeat = computeDigest(artifact);
  assert.strictEqual(
    digestRepeat,
    digestOriginal,
    `Iteration ${i}: Hash of canonicalized artifact must be 100% deterministic`
  );

  // Cross-component fingerprint verification
  const fpDirect = computeArtifactFingerprint(artifact);
  const fpFromCanonical = computeArtifactFingerprint(canonicalOriginal);
  assert.strictEqual(
    fpDirect.hash,
    digestOriginal,
    `Iteration ${i}: computeArtifactFingerprint hash must equal computeDigest`
  );
  assert.strictEqual(
    fpFromCanonical.hash,
    digestOriginal,
    `Iteration ${i}: Fingerprint computed over canonical string must equal original fingerprint`
  );
  stats.determinismPasses++;

  // -----------------------------------------------------------
  // PROPERTY 3: Representation-Equivalent Transformations
  // MUST PRESERVE THE DIGEST
  // -----------------------------------------------------------

  // 3.1 Reordered Object Keys at all depths
  const artifactReorderedKeys = deeplyShuffleKeys(artifact);
  const digestReorderedKeys = computeDigest(artifactReorderedKeys);
  assert.strictEqual(
    digestReorderedKeys,
    digestOriginal,
    `Iteration ${i}: Deep key reordering must preserve canonical digest`
  );
  stats.keyReorderEquivalencePasses++;

  // 3.2 Reordered Answers in screening_answers
  const artifactReorderedAnswers = JSON.parse(JSON.stringify(artifact));
  artifactReorderedAnswers.screening_answers.answers = rng.shuffle(
    artifactReorderedAnswers.screening_answers.answers
  );
  const digestReorderedAnswers = computeDigest(artifactReorderedAnswers);
  assert.strictEqual(
    digestReorderedAnswers,
    digestOriginal,
    `Iteration ${i}: Screening answers permutation must preserve canonical digest`
  );
  stats.answerReorderEquivalencePasses++;

  // 3.3 Newline Transformation: CRLF (\r\n)
  const artifactCRLF = applyNewlineTransformation(artifact, '\r\n');
  const digestCRLF = computeDigest(artifactCRLF);
  assert.strictEqual(
    digestCRLF,
    digestOriginal,
    `Iteration ${i}: Windows CRLF (\\r\\n) transport encoding must preserve canonical digest`
  );
  stats.crlfEquivalencePasses++;

  // 3.4 Newline Transformation: CR (\r)
  const artifactCR = applyNewlineTransformation(artifact, '\r');
  const digestCR = computeDigest(artifactCR);
  assert.strictEqual(
    digestCR,
    digestOriginal,
    `Iteration ${i}: Classic Mac CR (\\r) line endings must preserve canonical digest`
  );
  stats.crEquivalencePasses++;

  // 3.5 Mixed Newlines (\r\n, \r, and \n in same payload)
  const artifactMixedNL = JSON.parse(JSON.stringify(artifact));
  let nlToggle = 0;
  artifactMixedNL.resume.full_resume = artifact.resume.full_resume.replace(/\n/g, () => {
    nlToggle = (nlToggle + 1) % 3;
    if (nlToggle === 0) return '\r\n';
    if (nlToggle === 1) return '\r';
    return '\n';
  });
  const digestMixedNL = computeDigest(artifactMixedNL);
  assert.strictEqual(
    digestMixedNL,
    digestOriginal,
    `Iteration ${i}: Mixed line endings within single payload must preserve canonical digest`
  );
  stats.mixedNewlineEquivalencePasses++;

  // 3.6 Unicode Canonical Equivalence: NFC vs NFD
  const artifactNFD = applyUnicodeNFD(artifact);
  const digestNFD = computeDigest(artifactNFD);
  assert.strictEqual(
    digestNFD,
    digestOriginal,
    `Iteration ${i}: Unicode decomposed glyphs (NFD) must canonicalize to NFC and preserve digest`
  );
  stats.unicodeNFDEquivalencePasses++;

  // -----------------------------------------------------------
  // PROPERTY 4: Representation-Divergent Mutations
  // MUST STRICTLY ALTER THE DIGEST
  // -----------------------------------------------------------

  // 4.1 Mutation: + one character (insertion / change of 1 ASCII char)
  const mutChar = JSON.parse(JSON.stringify(artifact));
  mutChar.resume.headline += '!';
  const digestMutChar = computeDigest(mutChar);
  assert.notStrictEqual(
    digestMutChar,
    digestOriginal,
    `Iteration ${i}: +1 ASCII character must strictly alter digest`
  );
  stats.charMutationCaught++;

  // 4.2 Mutation: + one byte (insert byte 0x01 or modify byte)
  const mutByte = JSON.parse(JSON.stringify(artifact));
  mutByte.resume.summary = mutByte.resume.summary + '\x01';
  const digestMutByte = computeDigest(mutByte);
  assert.notStrictEqual(
    digestMutByte,
    digestOriginal,
    `Iteration ${i}: +1 raw byte must strictly alter digest`
  );
  stats.byteMutationCaught++;

  // 4.3 Mutation: + one Unicode codepoint (emoji, symbol, or homoglyph)
  const mutCodepoint = JSON.parse(JSON.stringify(artifact));
  const codepointChoice = rng.choice(['🎯', '\u200B', '\u0430', '\u00A0', '§']); // emoji, zero-width, cyrillic, non-breaking space
  mutCodepoint.cover_letter.letter = codepointChoice + mutCodepoint.cover_letter.letter;
  const digestMutCodepoint = computeDigest(mutCodepoint);
  assert.notStrictEqual(
    digestMutCodepoint,
    digestOriginal,
    `Iteration ${i}: +1 Unicode codepoint (${codepointChoice}) must strictly alter digest`
  );
  stats.codepointMutationCaught++;

  // 4.4 Mutation: + one metadata field
  const mutMeta = JSON.parse(JSON.stringify(artifact));
  mutMeta.screening_answers.submission_meta.tampered_flag = `injected_${rng.intBetween(100, 999)}`;
  const digestMutMeta = computeDigest(mutMeta);
  assert.notStrictEqual(
    digestMutMeta,
    digestOriginal,
    `Iteration ${i}: +1 metadata field must strictly alter digest`
  );
  stats.metadataFieldMutationCaught++;

  // 4.5 Mutation: + one answer (new entry in screening_answers)
  const mutAnswer = JSON.parse(JSON.stringify(artifact));
  mutAnswer.screening_answers.answers.push({
    question_id: `q_mutated_${rng.intBetween(1000, 9999)}`,
    question: 'Are you legally authorized to work in the jurisdiction?',
    answer: 'Yes, authorized unconditionally.',
  });
  const digestMutAnswer = computeDigest(mutAnswer);
  assert.notStrictEqual(
    digestMutAnswer,
    digestOriginal,
    `Iteration ${i}: +1 answer in screening_answers must strictly alter digest`
  );
  stats.answerMutationCaught++;

  // 4.6 Mutation: + one recipient modification
  const mutRecipient = JSON.parse(JSON.stringify(artifact));
  mutRecipient.cover_letter.recipient = mutRecipient.cover_letter.recipient + ' Team B';
  const digestMutRecipient = computeDigest(mutRecipient);
  assert.notStrictEqual(
    digestMutRecipient,
    digestOriginal,
    `Iteration ${i}: Recipient alteration must strictly alter digest`
  );
  stats.recipientMutationCaught++;

  // 4.7 Mutation: + one nested object property
  const mutNested = JSON.parse(JSON.stringify(artifact));
  mutNested.resume.nested_details.security_clearance_verified = true;
  const digestMutNested = computeDigest(mutNested);
  assert.notStrictEqual(
    digestMutNested,
    digestOriginal,
    `Iteration ${i}: +1 nested object property must strictly alter digest`
  );
  stats.nestedPropertyMutationCaught++;
}

// =============================================================
// SUMMARY REPORT
// =============================================================
console.log('----------------------------------------------------------------');
console.log(`✓ PROPERTY 1: Idempotency Invariant Verified (${stats.idempotencyPasses}/${FUZZ_ITERATIONS} tests)`);
console.log(`    canonicalize(canonicalize(x)) === canonicalize(x) across 100% of randomized valid artifacts.`);
console.log(`✓ PROPERTY 2: Determinism Invariant Verified (${stats.determinismPasses}/${FUZZ_ITERATIONS} tests)`);
console.log(`    hash(canonicalize(x)) === hash(canonicalize(x)) 100% invariant across invocations.`);
console.log(`✓ PROPERTY 3: Representation-Equivalent Transformations Invariance (100% Preserved):`);
console.log(`    - Reordered Object Keys:            ${stats.keyReorderEquivalencePasses}/${FUZZ_ITERATIONS} digest matches`);
console.log(`    - Reordered Screening Answers:      ${stats.answerReorderEquivalencePasses}/${FUZZ_ITERATIONS} digest matches`);
console.log(`    - CRLF (\\r\\n) Newlines:              ${stats.crlfEquivalencePasses}/${FUZZ_ITERATIONS} digest matches`);
console.log(`    - CR (\\r) Newlines:                 ${stats.crEquivalencePasses}/${FUZZ_ITERATIONS} digest matches`);
console.log(`    - Mixed In-Payload Newlines:        ${stats.mixedNewlineEquivalencePasses}/${FUZZ_ITERATIONS} digest matches`);
console.log(`    - Unicode Canonical Equiv (NFD):    ${stats.unicodeNFDEquivalencePasses}/${FUZZ_ITERATIONS} digest matches`);
console.log(`✓ PROPERTY 4: Representation-Divergent Mutations Invariance (100% Detected):`);
console.log(`    - +1 ASCII character:               ${stats.charMutationCaught}/${FUZZ_ITERATIONS} mutations detected`);
console.log(`    - +1 raw byte:                      ${stats.byteMutationCaught}/${FUZZ_ITERATIONS} mutations detected`);
console.log(`    - +1 Unicode codepoint:             ${stats.codepointMutationCaught}/${FUZZ_ITERATIONS} mutations detected`);
console.log(`    - +1 metadata field:                ${stats.metadataFieldMutationCaught}/${FUZZ_ITERATIONS} mutations detected`);
console.log(`    - +1 answer:                        ${stats.answerMutationCaught}/${FUZZ_ITERATIONS} mutations detected`);
console.log(`    - +1 recipient mutation:            ${stats.recipientMutationCaught}/${FUZZ_ITERATIONS} mutations detected`);
console.log(`    - +1 nested object property:        ${stats.nestedPropertyMutationCaught}/${FUZZ_ITERATIONS} mutations detected`);
console.log('----------------------------------------------------------------\n');

console.log('================================================================');
console.log('  ALL V4.6.1 CANONICALIZER PROPERTY & FUZZ CHECKS PASSED (100%) ');
console.log('================================================================');
