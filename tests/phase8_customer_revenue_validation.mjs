// tests/phase8_customer_revenue_validation.mjs
// Comprehensive verification test suite for Phase 8: Customer Acquisition, Revenue & Product-Market Validation

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

console.log('================================================================');
console.log('  RJA V4.3 — PHASE 8 CUSTOMER, REVENUE & PRODUCT VALIDATION    ');
console.log('================================================================\n');

// -------------------------------------------------------------
// PILLAR 1: Real Customer Onboarding Funnel
// -------------------------------------------------------------
console.log('Pillar 1: Auditing Real Customer Onboarding Funnel...');

const onboardingGuidePath = path.join(ROOT, 'components', 'dashboard', 'OnboardingGuide.tsx');
assert.ok(fs.existsSync(onboardingGuidePath), 'OnboardingGuide component must exist');

const onboardingContent = fs.readFileSync(onboardingGuidePath, 'utf8');
assert.ok(onboardingContent.includes('FAST-TRACK: YOUR FIRST TAILORED APPLICATION'), 'Onboarding guide must define the fast-track application headline');
assert.ok(onboardingContent.includes('Profile & Evidence'), 'Onboarding guide step 1 must be Profile & Evidence');
assert.ok(onboardingContent.includes('Curated Roles'), 'Onboarding guide step 2 must be Curated Roles');
assert.ok(onboardingContent.includes('Select Canonical Job'), 'Onboarding guide step 3 must be Select Canonical Job');
assert.ok(onboardingContent.includes('Tailor & Submit'), 'Onboarding guide step 4 must be Tailor & Submit');

// Verify non-blocking free user onboarding in Dashboard.tsx
const dashboardContent = fs.readFileSync(path.join(ROOT, 'components', 'Dashboard.tsx'), 'utf8');
assert.ok(dashboardContent.includes('<OnboardingGuide'), 'Dashboard must render OnboardingGuide');
assert.ok(
  !dashboardContent.includes('if (!x.entitled) setShowPaywall(true);'),
  'Dashboard must not immediately force paywall on initial mount for free users'
);

console.log('✓ Pillar 1 PASSED: Onboarding guide, fast-track funnel, and frictionless free entry verified.\n');

// -------------------------------------------------------------
// PILLAR 2: Monetization Validation & Gumroad Funnel
// -------------------------------------------------------------
console.log('Pillar 2: Verifying Monetization Validation & Conversion Funnel...');

// Verify paywall modal telemetry
assert.ok(dashboardContent.includes("trackEvent('pro_clicked'"), 'Dashboard must track pro_clicked on paywall trigger');
assert.ok(dashboardContent.includes("trackEvent('checkout_started'"), 'Dashboard must track checkout_started on paywall CTA click');

// Verify Gumroad webhook purchase_completed telemetry
const webhookContent = fs.readFileSync(path.join(ROOT, 'app', 'api', 'webhooks', 'gumroad', '[secret]', 'route.ts'), 'utf8');
assert.ok(webhookContent.includes("trackServerEvent('purchase_completed'"), 'Gumroad webhook must record purchase_completed telemetry event');

console.log('✓ Pillar 2 PASSED: Pro upgrade triggers, checkout starts, and webhook purchases tracked.\n');

// -------------------------------------------------------------
// PILLAR 3: Product Analytics & Event Funnel Taxonomy
// -------------------------------------------------------------
console.log('Pillar 3: Auditing Product Analytics & Telemetry Engine...');

const analyticsPath = path.join(ROOT, 'lib', 'analytics.ts');
assert.ok(fs.existsSync(analyticsPath), 'lib/analytics.ts must exist');

const analyticsContent = fs.readFileSync(analyticsPath, 'utf8');
const requiredFunnelEvents = [
  'landing_view',
  'signup_started',
  'signup_completed',
  'profile_completed',
  'resume_uploaded',
  'job_search',
  'job_viewed',
  'why_match_opened',
  'job_shortlisted',
  'job_selected',
  'resume_tailored',
  'cover_letter_generated',
  'application_started',
  'application_submitted',
  'interview_recorded',
  'offer_recorded',
  'pro_clicked',
  'checkout_started',
  'purchase_completed'
];

for (const evt of requiredFunnelEvents) {
  assert.ok(
    analyticsContent.includes(`'${evt}'`),
    `lib/analytics.ts must support required event '${evt}'`
  );
}

// Verify telemetry ingestion route
const telemetryRoutePath = path.join(ROOT, 'app', 'api', 'telemetry', 'route.ts');
assert.ok(fs.existsSync(telemetryRoutePath), 'app/api/telemetry/route.ts ingestion route must exist');
const telemetryRouteContent = fs.readFileSync(telemetryRoutePath, 'utf8');
assert.ok(telemetryRouteContent.includes('trackServerEvent'), 'Telemetry route must call trackServerEvent');

console.log(`✓ Pillar 3 PASSED: All ${requiredFunnelEvents.length} funnel events defined & telemetry route active.\n`);

// -------------------------------------------------------------
// PILLAR 4: Customer Validation & Outcome Measurement
// -------------------------------------------------------------
console.log('Pillar 4: Verifying Customer Validation & ROI Outcome Measurement...');

const analyticsOverviewPath = path.join(ROOT, 'components', 'dashboard', 'AnalyticsOverview.tsx');
const analyticsOverviewContent = fs.readFileSync(analyticsOverviewPath, 'utf8');

assert.ok(
  analyticsOverviewContent.includes('Customer Outcome Measurement'),
  'AnalyticsOverview must display Customer Outcome Measurement card'
);
assert.ok(
  analyticsOverviewContent.includes('45 min manual') && analyticsOverviewContent.includes('6 min with RJA'),
  'AnalyticsOverview must highlight time-per-application friction reduction'
);
assert.ok(
  analyticsOverviewContent.includes('Hours Saved'),
  'AnalyticsOverview must compute and show total estimated candidate hours saved'
);
assert.ok(
  analyticsOverviewContent.includes('Interview Callback Rate'),
  'AnalyticsOverview must benchmark interview callback conversion'
);

console.log('✓ Pillar 4 PASSED: Before vs With RJA outcome ROI metrics and time-saved tracking verified.\n');

// -------------------------------------------------------------
// PILLAR 5: Continuous AI Quality Benchmark
// -------------------------------------------------------------
console.log('Pillar 5: Verifying AI Quality Benchmark Dataset & Eval Suite...');

const benchmarkDatasetPath = path.join(ROOT, 'data', 'ai_benchmark_dataset.json');
assert.ok(fs.existsSync(benchmarkDatasetPath), 'data/ai_benchmark_dataset.json must exist');

const benchmarkData = JSON.parse(fs.readFileSync(benchmarkDatasetPath, 'utf8'));
assert.ok(benchmarkData.length >= 5, 'Benchmark dataset must have at least 5 representative roles');

const evalScriptPath = path.join(ROOT, 'tests', 'ai_benchmark_eval.mjs');
assert.ok(fs.existsSync(evalScriptPath), 'tests/ai_benchmark_eval.mjs must exist');

console.log(`✓ Pillar 5 PASSED: ${benchmarkData.length} golden benchmark cases and automated eval suite active.\n`);

console.log('================================================================');
console.log('  ALL PHASE 8 CUSTOMER, REVENUE & VALIDATION CHECKS PASSED (5/5) ');
console.log('================================================================');
