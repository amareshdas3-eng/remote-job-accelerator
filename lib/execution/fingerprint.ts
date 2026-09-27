import crypto from 'node:crypto';
import type { ArtifactFingerprint } from './types';

/**
 * Normalizes text for byte-level canonicalization:
 * - Translates CRLF (\r\n) and CR (\r) into LF (\n) to prevent transport/OS newline drift
 * - Normalizes Unicode to NFC (Canonical Decomposition followed by Canonical Composition)
 * - Preserves exact internal whitespace, casing, punctuation, and Unicode codepoints
 */
export function normalizeText(text: string | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .normalize('NFC');
}

/**
 * Recursively sorts keys alphabetically and normalizes string values
 * ensuring deterministic serialization regardless of key insertion order.
 */
export function deterministicStringify(val: any): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'string') {
    return JSON.stringify(normalizeText(val));
  }
  if (typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map((item) => deterministicStringify(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(val)
    .filter((key) => val[key] !== undefined)
    .sort();
  const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${deterministicStringify(val[key])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Canonicalizes the approved application artifact into an immutable, deterministic byte representation.
 * - Enforces deterministic key order on all structured objects (resume, cover_letter, answers)
 * - Enforces deterministic sorting of screening answers by question identifier
 * - Enforces NFC Unicode and newline normalization across all text fields
 * - Detects ANY mutation in any field of the artifact (including headline, summary, recipient, letter, answers)
 */
export function canonicalizeArtifactContent(content: {
  resume: any;
  cover_letter: any;
  screening_answers: any;
} | string): string {
  if (!content) return '';
  if (typeof content === 'string') {
    return normalizeText(content);
  }

  // 1. Resume Component (deterministic serialization of all resume fields)
  const resumePart = content.resume ? deterministicStringify(content.resume) : '';

  // 2. Cover Letter Component (deterministic serialization of all cover letter fields)
  const coverPart = content.cover_letter ? deterministicStringify(content.cover_letter) : '';

  // 3. Screening Answers Component (deterministic sorting by question followed by deep serialization)
  let answersPart = '';
  if (content.screening_answers) {
    if (Array.isArray(content.screening_answers?.answers)) {
      const sortedAnswers = [...content.screening_answers.answers].sort((a: any, b: any) => {
        const keyA = normalizeText(String(a.question_id || a.question || ''));
        const keyB = normalizeText(String(b.question_id || b.question || ''));
        const diff = keyA.localeCompare(keyB);
        if (diff !== 0) return diff;
        return deterministicStringify(a).localeCompare(deterministicStringify(b));
      });

      const normalizedAnswersObj = {
        ...content.screening_answers,
        answers: sortedAnswers,
      };
      answersPart = deterministicStringify(normalizedAnswersObj);
    } else {
      answersPart = deterministicStringify(content.screening_answers);
    }
  }

  return `RESUME:\n${resumePart}\n---\nCOVER:\n${coverPart}\n---\nANSWERS:\n${answersPart}`;
}

export const DEFAULT_FINGERPRINT_SCHEME = 'rja-c14n-v1-sha256';

/**
 * Computes deterministic SHA-256 fingerprint over canonicalized artifact content.
 */
export function computeArtifactFingerprint(content: {
  resume: any;
  cover_letter: any;
  screening_answers: any;
} | string): ArtifactFingerprint {
  const canonicalString = canonicalizeArtifactContent(content);
  const hash = crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');

  const isObj = typeof content === 'object' && content !== null;
  const resumeLength = isObj ? (content.resume?.full_resume || '').length : 0;
  const coverLetterLength = isObj ? (content.cover_letter?.letter || '').length : 0;
  const answersCount = isObj && Array.isArray(content.screening_answers?.answers)
    ? content.screening_answers.answers.length
    : 0;

  return {
    hash,
    algorithm: 'sha256',
    fingerprint_algorithm: DEFAULT_FINGERPRINT_SCHEME,
    canonicalization_scheme: DEFAULT_FINGERPRINT_SCHEME,
    components: {
      resume_length: resumeLength,
      cover_letter_length: coverLetterLength,
      answers_count: answersCount,
    },
    computed_at: new Date().toISOString(),
  };
}

/**
 * Verifies that current artifact content strictly matches the expected approved fingerprint.
 */
export function verifyArtifactFingerprint(
  content: {
    resume: any;
    cover_letter: any;
    screening_answers: any;
  } | string,
  expectedHash: string
): { valid: boolean; actualHash: string } {
  const currentFingerprint = computeArtifactFingerprint(content);
  return {
    valid: currentFingerprint.hash === expectedHash,
    actualHash: currentFingerprint.hash,
  };
}
