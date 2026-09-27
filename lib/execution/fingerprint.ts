import crypto from 'node:crypto';
import type { ArtifactFingerprint } from './types';

export function canonicalizeArtifactContent(content: {
  resume: any;
  cover_letter: any;
  screening_answers: any;
}): string {
  // Sort and stringify deterministically
  const resumePart = content.resume?.full_resume || JSON.stringify(content.resume || {});
  const coverPart = content.cover_letter?.letter || JSON.stringify(content.cover_letter || {});
  const answersPart = Array.isArray(content.screening_answers?.answers)
    ? content.screening_answers.answers.map((a: any) => `${a.question}:${a.answer}`).join('\n')
    : JSON.stringify(content.screening_answers || {});

  return `RESUME:\n${resumePart.trim()}\n---\nCOVER:\n${coverPart.trim()}\n---\nANSWERS:\n${answersPart.trim()}`;
}

export function computeArtifactFingerprint(content: {
  resume: any;
  cover_letter: any;
  screening_answers: any;
}): ArtifactFingerprint {
  const canonicalString = canonicalizeArtifactContent(content);
  const hash = crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');

  const resumeLength = (content.resume?.full_resume || '').length;
  const coverLetterLength = (content.cover_letter?.letter || '').length;
  const answersCount = Array.isArray(content.screening_answers?.answers)
    ? content.screening_answers.answers.length
    : 0;

  return {
    hash,
    algorithm: 'sha256',
    components: {
      resume_length: resumeLength,
      cover_letter_length: coverLetterLength,
      answers_count: answersCount,
    },
    computed_at: new Date().toISOString(),
  };
}

export function verifyArtifactFingerprint(
  content: {
    resume: any;
    cover_letter: any;
    screening_answers: any;
  },
  expectedHash: string
): { valid: boolean; actualHash: string } {
  const currentFingerprint = computeArtifactFingerprint(content);
  return {
    valid: currentFingerprint.hash === expectedHash,
    actualHash: currentFingerprint.hash,
  };
}
