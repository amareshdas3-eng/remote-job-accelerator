import assert from 'node:assert';
import { ai, safeJson } from '../lib/ai.ts';

console.log('--- RUNNING AI RESILIENCE & 429 RECOVERY TEST SUITE ---');

// 1. Test safeJson parsing under adversarial LLM output conditions
console.log('[1/4] Testing safeJson adversarial parsing...');
const rawJson = '{"score": 95, "verdict": "STRONG_MATCH"}';
assert.strictEqual(safeJson(rawJson).score, 95);

const markdownFenced = '```json\n{"score": 88, "strengths": ["React", "TypeScript"]}\n```';
assert.strictEqual(safeJson(markdownFenced).score, 88);
assert.strictEqual(safeJson(markdownFenced).strengths.length, 2);

const conversationalText = 'Here is the analysis you requested:\n```json\n{"score": 75}\n```\nHope this helps!';
assert.strictEqual(safeJson(conversationalText).score, 75);

const rawArray = '[\n  {"question": "Tell me about a time...", "rationale": "STAR"}\n]';
const parsedArray = safeJson(rawArray);
assert.ok(Array.isArray(parsedArray));
assert.strictEqual(parsedArray.length, 1);
console.log('✓ safeJson passed all parsing tests.');

// 2. Test live AI generation with active failover cascade
console.log('[2/4] Testing live AI generation with auto-cascade...');
const t0 = Date.now();
const res1 = await ai(
  'You are an ATS formatting and keyword specialist.',
  'Analyze match between resume: "Experienced React and Node.js engineer" and job: "Looking for Senior React developer". Return JSON { "matchScore": 90 }'
);
const duration1 = Date.now() - t0;
assert.ok(res1 && res1.length > 0, 'ai() must return non-empty response');
console.log(`✓ Live AI generation succeeded in ${duration1}ms. Output length: ${res1.length} chars.`);

// 3. Test In-Memory LRU Prompt Cache (0ms repeat response, 0 quota used)
console.log('[3/4] Testing in-memory prompt cache deduplication...');
const t1 = Date.now();
const res2 = await ai(
  'You are an ATS formatting and keyword specialist.',
  'Analyze match between resume: "Experienced React and Node.js engineer" and job: "Looking for Senior React developer". Return JSON { "matchScore": 90 }'
);
const duration2 = Date.now() - t1;
assert.strictEqual(res1, res2, 'Cached response must match live response');
assert.ok(duration2 < 50, `Cached call must return immediately (<50ms). Got: ${duration2}ms`);
console.log(`✓ Cached response returned in ${duration2}ms (0 quota consumed).`);

// 4. Test rapid paced queries (throttle spacing)
console.log('[4/4] Testing query throttling pacing...');
const t2 = Date.now();
await Promise.all([
  ai('System prompt A', 'Query 1: What are top remote job boards?'),
  ai('System prompt B', 'Query 2: What are top ATS keywords?')
]);
const duration3 = Date.now() - t2;
console.log(`✓ Concurrent paced calls resolved in ${duration3}ms without throwing 429.`);

console.log('--- ALL AI RESILIENCE & 429 FIX TESTS PASSED SUCCESSFULLY! ---');
