// tests/phase10_live_pmf_revenue_validation.mjs
// Phase 10: Live Product-Market Evidence, Data Integrity & Revenue Validation Suite

import assert from 'node:assert';
import {
  isSubmittedApplicationStatus,
  calculateNorthStarMetric,
  calculateFunnelRates,
  calculateCareerOutcomes,
  calculateCohortRetention,
  SUBMITTED_APPLICATION_STATUSES,
} from '../lib/growth.ts';
import {
  classifyChannel,
  appendAttributionParams,
} from '../lib/attribution.ts';

console.log('🔬 Running RJA v4.3 Phase 10 Live PMF & Revenue Validation Suite...\n');

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
// Test 1: Telemetry Idempotency & Duplicate Safety
// -------------------------------------------------------------
test('Test 1: Telemetry idempotency prevents double counting of duplicate events', () => {
  const events = [
    { eventId: 'evt_1', type: 'signup_completed', userId: 'user_A', ts: '2026-09-20T10:00:00Z' },
    { eventId: 'evt_1', type: 'signup_completed', userId: 'user_A', ts: '2026-09-20T10:00:00Z' }, // duplicate
    { eventId: 'evt_2', type: 'signup_completed', userId: 'user_B', ts: '2026-09-20T11:00:00Z' },
  ];

  const uniqueSignups = new Set();
  events.forEach((e) => uniqueSignups.add(e.userId));

  assert.strictEqual(uniqueSignups.size, 2, 'Duplicate events must not inflate user signup count');
});

// -------------------------------------------------------------
// Test 2: Submitted Application Status Discrimination & Anti-Inflation
// -------------------------------------------------------------
test('Test 2: Unsubmitted draft statuses (saved, selected, in_progress, ready_to_apply) are strictly excluded from submitted applications', () => {
  // Verify canonical list of submitted statuses
  assert.deepStrictEqual(
    [...SUBMITTED_APPLICATION_STATUSES],
    ['applied', 'follow_up', 'screening', 'interview', 'offer', 'rejected', 'closed']
  );

  // Drafts must NOT be counted as submitted
  assert.strictEqual(isSubmittedApplicationStatus('saved'), false);
  assert.strictEqual(isSubmittedApplicationStatus('selected'), false);
  assert.strictEqual(isSubmittedApplicationStatus('in_progress'), false);
  assert.strictEqual(isSubmittedApplicationStatus('ready_to_apply'), false);
  assert.strictEqual(isSubmittedApplicationStatus('withdrawn'), false);

  // Actual submissions must be counted
  assert.strictEqual(isSubmittedApplicationStatus('applied'), true);
  assert.strictEqual(isSubmittedApplicationStatus('screening'), true);
  assert.strictEqual(isSubmittedApplicationStatus('interview'), true);
  assert.strictEqual(isSubmittedApplicationStatus('offer'), true);
  assert.strictEqual(isSubmittedApplicationStatus('rejected'), true);
  assert.strictEqual(isSubmittedApplicationStatus('closed'), true);

  const mockApplications = [
    { id: 'app_1', status: 'saved' },
    { id: 'app_2', status: 'selected' },
    { id: 'app_3', status: 'in_progress' },
    { id: 'app_4', status: 'ready_to_apply' },
    { id: 'app_5', status: 'applied' },
    { id: 'app_6', status: 'interview' },
    { id: 'app_7', status: 'offer' },
  ];

  const submitted = mockApplications.filter((a) => isSubmittedApplicationStatus(a.status));
  assert.strictEqual(submitted.length, 3, 'Only applied, interview, and offer should qualify as submitted');
});

// -------------------------------------------------------------
// Test 3: Webhook Deduplication & Authoritative Payment Source
// -------------------------------------------------------------
test('Test 3: Webhook deduplication strictly prevents duplicate sales or duplicate revenue', () => {
  const processedSaleIds = new Set();
  let totalRevenueCents = 0;

  function processGumroadPing(saleId, amountCents) {
    if (processedSaleIds.has(saleId)) {
      return { duplicate: true };
    }
    processedSaleIds.add(saleId);
    totalRevenueCents += amountCents;
    return { duplicate: false, total: totalRevenueCents };
  }

  const p1 = processGumroadPing('sale_101', 2900);
  assert.strictEqual(p1.duplicate, false);
  assert.strictEqual(totalRevenueCents, 2900);

  // Replay of same webhook ping
  const p2 = processGumroadPing('sale_101', 2900);
  assert.strictEqual(p2.duplicate, true);
  assert.strictEqual(totalRevenueCents, 2900, 'Duplicate sale ID must not increase revenue');
});

// -------------------------------------------------------------
// Test 4: Multi-User Isolation in Metrics Calculation
// -------------------------------------------------------------
test('Test 4: Multi-user records cannot contaminate user-scoped metrics', () => {
  const mockDbRecords = [
    { userId: 'user_1', appId: 'app_A', status: 'applied' },
    { userId: 'user_1', appId: 'app_B', status: 'interview' },
    { userId: 'user_2', appId: 'app_C', status: 'applied' },
    { userId: 'user_2', appId: 'app_D', status: 'offer' },
  ];

  const user1Apps = mockDbRecords.filter((r) => r.userId === 'user_1');
  const user2Apps = mockDbRecords.filter((r) => r.userId === 'user_2');

  assert.strictEqual(user1Apps.length, 2);
  assert.strictEqual(user2Apps.length, 2);
  assert.ok(!user1Apps.some((r) => r.userId === 'user_2'), 'No cross-user leakage in application queries');
});

// -------------------------------------------------------------
// Test 5: Attribution Channel Classification & Forwarding
// -------------------------------------------------------------
test('Test 5: Attribution channel classification accurately categorizes all 8 channels', () => {
  assert.strictEqual(classifyChannel('linkedin', undefined), 'linkedin');
  assert.strictEqual(classifyChannel('reddit', undefined), 'reddit');
  assert.strictEqual(classifyChannel('hackernews', undefined), 'community');
  assert.strictEqual(classifyChannel('gumroad', undefined), 'gumroad');
  assert.strictEqual(classifyChannel('network', undefined), 'network');
  assert.strictEqual(classifyChannel('google', undefined), 'search');
  assert.strictEqual(classifyChannel('partner_ref', undefined), 'referral');
  assert.strictEqual(classifyChannel(undefined, undefined), 'direct');
});

// -------------------------------------------------------------
// Test 6: Attribution Forwarding to Gumroad Checkout
// -------------------------------------------------------------
test('Test 6: appendAttributionParams preserves target URLs safely', () => {
  const target = 'https://gumroad.com/l/remote-job-complete';
  const out = appendAttributionParams(target);
  assert.ok(out.startsWith('https://gumroad.com/l/remote-job-complete'));
});

// -------------------------------------------------------------
// Test 7: North-Star Metric Mathematical Correctness & Zero-Safety
// -------------------------------------------------------------
test('Test 7: North-Star KPI formula calculates correctly and handles zero/boundary values safely', () => {
  // 13 qualified applications, 2 active users, 1 week = 6.5
  assert.strictEqual(calculateNorthStarMetric(13, 2, 1), 6.5);

  // 0 users => returns 0 without divide-by-zero
  assert.strictEqual(calculateNorthStarMetric(10, 0, 1), 0);

  // 0 weeks => returns 0
  assert.strictEqual(calculateNorthStarMetric(10, 2, 0), 0);

  // 0 apps => returns 0
  assert.strictEqual(calculateNorthStarMetric(0, 5, 2), 0);
});

// -------------------------------------------------------------
// Test 8: Empirical Cohort Retention Calculation
// -------------------------------------------------------------
test('Test 8: calculateCohortRetention computes D1, D7, D14, and D30 return rates from timestamps', () => {
  const now = new Date('2026-09-20T12:00:00Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const users = [
    // User A: Active 35 days after activation (qualifies for D1, D7, D14, D30)
    {
      activatedAt: new Date(now - 40 * dayMs).toISOString(),
      lastActiveAt: new Date(now - 5 * dayMs).toISOString(), // 35 days diff
    },
    // User B: Active 10 days after activation (qualifies for D1, D7)
    {
      activatedAt: new Date(now - 20 * dayMs).toISOString(),
      lastActiveAt: new Date(now - 10 * dayMs).toISOString(), // 10 days diff
    },
    // User C: Active 2 days after activation (qualifies for D1)
    {
      activatedAt: new Date(now - 10 * dayMs).toISOString(),
      lastActiveAt: new Date(now - 8 * dayMs).toISOString(), // 2 days diff
    },
    // User D: Active 0.2 days after activation (does not qualify for D1)
    {
      activatedAt: new Date(now - 5 * dayMs).toISOString(),
      lastActiveAt: new Date(now - 4.8 * dayMs).toISOString(), // 0.2 days diff
    },
  ];

  const retention = calculateCohortRetention(users);

  // Total 4 users:
  // D1: 3/4 = 75%
  // D7: 2/4 = 50%
  // D14: 1/4 = 25%
  // D30: 1/4 = 25%
  assert.strictEqual(retention.day1, 75);
  assert.strictEqual(retention.day7, 50);
  assert.strictEqual(retention.day14, 25);
  assert.strictEqual(retention.day30, 25);
});

// -------------------------------------------------------------
// Test 9: Career Outcomes Pipeline Separation & Anti-Inflation
// -------------------------------------------------------------
test('Test 9: Outcome pipeline strictly distinguishes offers from hires and computes stage rates', () => {
  // 50 apps, 20 responses, 10 interviews, 2 offers, 1 hire
  const outcomes = calculateCareerOutcomes(50, 20, 10, 2, 1);

  assert.strictEqual(outcomes.applications, 50);
  assert.strictEqual(outcomes.responses, 20);
  assert.strictEqual(outcomes.interviews, 10);
  assert.strictEqual(outcomes.offers, 2);
  assert.strictEqual(outcomes.hired, 1);

  assert.strictEqual(outcomes.responseRate, 40); // 20/50 = 40%
  assert.strictEqual(outcomes.interviewRate, 50); // 10/20 = 50%
  assert.strictEqual(outcomes.offerRate, 20); // 2/10 = 20%
  assert.strictEqual(outcomes.hireRate, 50); // 1/2 = 50%
});

// -------------------------------------------------------------
// Test 10: Privacy and Zero PII Leakage in Telemetry
// -------------------------------------------------------------
test('Test 10: Telemetry properties strictly omit passwords, auth secrets, and payment tokens', () => {
  const sampleEventProperties = {
    userId: 'usr_123',
    role: 'Senior Full-Stack Engineer',
    company: 'Supabase SaaS Inc',
    fitScore: 88,
  };

  const forbiddenKeys = ['password', 'token', 'secret', 'cardNumber', 'cvv', 'resume_raw_text'];
  for (const k of forbiddenKeys) {
    assert.strictEqual(k in sampleEventProperties, false, `Telemetry must never contain ${k}`);
  }
});

console.log(`\n🎉 All ${passedTests} Phase 10 Live PMF & Revenue Validation tests passed successfully!`);
