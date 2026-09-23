// tests/phase9_growth_acquisition_experimentation.mjs
// Phase 9: Live Customer Acquisition & Growth Experimentation Verification Suite

import assert from 'node:assert';
import {
  classifyChannel,
} from '../lib/attribution.ts';
import {
  calculateNorthStarMetric,
  calculateFunnelRates,
  calculateCareerOutcomes,
  GROWTH_BENCHMARKS,
} from '../lib/growth.ts';

console.log('🚀 Running RJA v4.3 Phase 9 Growth & Acquisition Verification Suite...\n');

let passedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// Test 1: Channel Attribution & Classification
// -------------------------------------------------------------
test('Attribution Engine classifies LinkedIn traffic correctly', () => {
  assert.strictEqual(classifyChannel('linkedin', undefined, undefined), 'linkedin');
  assert.strictEqual(classifyChannel(undefined, 'https://www.linkedin.com/feed/', undefined), 'linkedin');
  assert.strictEqual(classifyChannel('lnkd.in', undefined, undefined), 'linkedin');
});

test('Attribution Engine classifies Reddit traffic correctly', () => {
  assert.strictEqual(classifyChannel('reddit', undefined, undefined), 'reddit');
  assert.strictEqual(classifyChannel(undefined, 'https://reddit.com/r/remotework', undefined), 'reddit');
  assert.strictEqual(classifyChannel(undefined, 'https://redd.it/123xyz', undefined), 'reddit');
});

test('Attribution Engine classifies Developer Community traffic correctly', () => {
  assert.strictEqual(classifyChannel('hackernews', undefined, undefined), 'community');
  assert.strictEqual(classifyChannel(undefined, 'https://news.ycombinator.com/', undefined), 'community');
  assert.strictEqual(classifyChannel('producthunt', undefined, undefined), 'community');
  assert.strictEqual(classifyChannel('discord', undefined, undefined), 'community');
});

test('Attribution Engine classifies Gumroad commerce traffic correctly', () => {
  assert.strictEqual(classifyChannel('gumroad', undefined, undefined), 'gumroad');
  assert.strictEqual(classifyChannel(undefined, 'https://gumroad.com/l/remote-job-complete', undefined), 'gumroad');
});

test('Attribution Engine classifies Personal Network traffic correctly', () => {
  assert.strictEqual(classifyChannel('network', undefined, undefined), 'network');
  assert.strictEqual(classifyChannel(undefined, undefined, 'network_intro'), 'network');
  assert.strictEqual(classifyChannel('direct_intro', undefined, undefined), 'network');
});

test('Attribution Engine classifies Search, Referral, and Direct traffic correctly', () => {
  assert.strictEqual(classifyChannel('google', undefined, undefined), 'search');
  assert.strictEqual(classifyChannel(undefined, 'https://www.google.com/', undefined), 'search');
  assert.strictEqual(classifyChannel('friend_ref', undefined, undefined), 'referral');
  assert.strictEqual(classifyChannel(undefined, undefined, undefined), 'direct');
});

// -------------------------------------------------------------
// Test 2: North-Star Metric Calculation
// -------------------------------------------------------------
test('North-Star Metric calculates correctly: qualified apps / user / week', () => {
  // 14 qualified apps submitted by 2 active users over 1 week = 7.0 apps/user/week
  const score = calculateNorthStarMetric(14, 2, 1);
  assert.strictEqual(score, 7);

  // 26 apps by 4 users over 2 weeks = 26 / 8 = 3.25 => rounded to 3.3
  const score2 = calculateNorthStarMetric(26, 4, 2);
  assert.strictEqual(score2, 3.3);

  // Zero users or weeks returns 0 without crashing
  assert.strictEqual(calculateNorthStarMetric(10, 0, 1), 0);
  assert.strictEqual(calculateNorthStarMetric(10, 1, 0), 0);
});

// -------------------------------------------------------------
// Test 3: Full Funnel Conversion Rates
// -------------------------------------------------------------
test('Funnel calculation evaluates all 6 stages from Visitor to Paid', () => {
  const sampleCounts = {
    visitors: 1000,
    signups: 400,          // 40% signup
    activated: 200,        // 50% activation
    proInterest: 80,       // 40% pro interest
    checkoutStarted: 40,   // 50% checkout started
    paid: 20,              // 50% checkout to paid
  };

  const rates = calculateFunnelRates(sampleCounts);

  assert.strictEqual(rates.visitorToSignupRate, 40);
  assert.strictEqual(rates.signupToActivationRate, 50);
  assert.strictEqual(rates.activationToProInterestRate, 40);
  assert.strictEqual(rates.proInterestToCheckoutRate, 50);
  assert.strictEqual(rates.checkoutToPaidRate, 50);
  assert.strictEqual(rates.visitorToPaidOverallRate, 2.0); // 20 / 1000 = 2%
});

// -------------------------------------------------------------
// Test 4: Career Outcome Pipeline Conversion
// -------------------------------------------------------------
test('Career Outcome Pipeline calculates response, interview, offer, and hire rates', () => {
  // 100 apps -> 40 responses -> 18 interviews -> 4 offers -> 2 hired
  const pipeline = calculateCareerOutcomes(100, 40, 18, 4, 2);

  assert.strictEqual(pipeline.applications, 100);
  assert.strictEqual(pipeline.responses, 40);
  assert.strictEqual(pipeline.interviews, 18);
  assert.strictEqual(pipeline.offers, 4);
  assert.strictEqual(pipeline.hired, 2);

  assert.strictEqual(pipeline.responseRate, 40);
  assert.strictEqual(pipeline.interviewRate, 45); // 18 / 40 = 45%
  assert.strictEqual(pipeline.offerRate, 22);     // 4 / 18 = 22%
  assert.strictEqual(pipeline.hireRate, 50);      // 2 / 4 = 50%
});

// -------------------------------------------------------------
// Test 5: Standard Growth Benchmarks Validation
// -------------------------------------------------------------
test('Standard Growth Benchmarks align with RJA targets', () => {
  assert.strictEqual(GROWTH_BENCHMARKS.northStarTarget, 6.5);
  assert.strictEqual(GROWTH_BENCHMARKS.activationTargetRate, 45);
  assert.strictEqual(GROWTH_BENCHMARKS.rjaAutomatedPrepMins, 6);
  assert.strictEqual(GROWTH_BENCHMARKS.industryManualPrepMins, 45);
  assert.strictEqual(GROWTH_BENCHMARKS.retentionTargets.day1, 65);
  assert.strictEqual(GROWTH_BENCHMARKS.retentionTargets.day7, 42);
  assert.strictEqual(GROWTH_BENCHMARKS.retentionTargets.day14, 34);
  assert.strictEqual(GROWTH_BENCHMARKS.retentionTargets.day30, 28);
});

console.log(`\n🎉 All ${passedTests} Phase 9 Growth & Acquisition tests passed successfully!`);
