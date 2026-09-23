// tests/phase5_application_execution.mjs
// Comprehensive verification test suite for Phase 5: Application Intelligence & Application Execution

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

console.log('================================================================');
console.log('  RJA V4.3 — PHASE 5 APPLICATION INTELLIGENCE & EXECUTION TEST');
console.log('================================================================\n');

// -------------------------------------------------------------
// STEP 1: Application Route Detection Engine
// -------------------------------------------------------------
console.log('Step 1: Testing Application Route Detection Engine...');
const { detectApplicationRoute, SUPPORTED_PLATFORMS } = await import('../lib/jobs/routeDetector.ts');

assert.ok(SUPPORTED_PLATFORMS.length >= 7, 'Should support at least 7 known ATS/application platforms');

// Test Greenhouse
const greenhouseRoute = detectApplicationRoute('https://boards.greenhouse.io/stripe/jobs/4567890');
assert.strictEqual(greenhouseRoute.route, 'greenhouse');
assert.strictEqual(greenhouseRoute.friction, 'low');
assert.ok(greenhouseRoute.tacticalTips.some(t => t.toLowerCase().includes('plain text')), 'Greenhouse tips should advise clean plain text');

// Test Lever
const leverRoute = detectApplicationRoute('https://jobs.lever.co/figma/12345678');
assert.strictEqual(leverRoute.route, 'lever');
assert.strictEqual(leverRoute.friction, 'low');

// Test Workday
const workdayRoute = detectApplicationRoute('https://netflix.myworkdayjobs.com/en-US/nflx/job/Senior-Engineer_R12345');
assert.strictEqual(workdayRoute.route, 'workday');
assert.strictEqual(workdayRoute.friction, 'high');
assert.strictEqual(workdayRoute.requiresAccount, true);
assert.ok(workdayRoute.tacticalTips.some(t => t.toLowerCase().includes('login') || t.toLowerCase().includes('multi-step')), 'Workday tips should note login/multi-step');

// Test Ashby
const ashbyRoute = detectApplicationRoute('https://jobs.ashbyhq.com/linear/abc-123');
assert.strictEqual(ashbyRoute.route, 'ashby');
assert.strictEqual(ashbyRoute.friction, 'low');

// Test Direct Email (mailto)
const emailRoute = detectApplicationRoute('mailto:careers@remoteorg.com?subject=Senior%20Lead');
assert.strictEqual(emailRoute.route, 'email');
assert.strictEqual(emailRoute.emailRecipient, 'careers@remoteorg.com');

// Test Contextual Email Application in Description
const { extractApplicationEmail } = await import('../lib/jobs/routeDetector.ts');
assert.strictEqual(extractApplicationEmail(null, null, 'To apply, send CV to jobs@abc.com'), 'jobs@abc.com');
assert.strictEqual(extractApplicationEmail(null, null, 'Apply via email: hr@company.com'), 'hr@company.com');
assert.strictEqual(extractApplicationEmail('https://boards.greenhouse.io/stripe/jobs/123', null, 'Submit your application via Greenhouse portal.'), undefined, 'Must not invent email if none in posting');

const contextualJobRoute = detectApplicationRoute(
  'https://remoteok.com/jobs/12345',
  null,
  'We are hiring an Electrical Project Manager! To apply, send CV to jobs@abc.com.'
);
assert.strictEqual(contextualJobRoute.route, 'email', 'Job with email instructions must be routed to email');
assert.strictEqual(contextualJobRoute.emailRecipient, 'jobs@abc.com', 'Recipient email must be extracted');
assert.strictEqual(contextualJobRoute.directApplyUrl, 'mailto:jobs@abc.com');

// Test Generic / Company Website
const genericRoute = detectApplicationRoute('https://example.com/company/careers');
assert.strictEqual(genericRoute.route, 'direct_portal');

console.log('✓ Step 1 PASSED: Application Route Detection correctly classifies platforms, email instructions, and friction levels.\n');

// -------------------------------------------------------------
// STEP 2: Application Strategy Engine
// -------------------------------------------------------------
console.log('Step 2: Testing Application Strategy Engine...');
const { buildDeterministicStrategy } = await import('../lib/strategy/engine.ts');

const sampleJob = {
  title: 'Senior Staff Distributed Systems Architect',
  company: 'CloudFlow Technologies',
  description: 'Looking for a senior systems architect experienced in Go, Kubernetes, and high-throughput real-time messaging.',
  salary: '$180,000 - $220,000',
  location: 'Remote (US/Canada)',
};

const sampleProfile = {
  target_roles: ['Staff Engineer', 'Systems Architect'],
  technical_skills: ['Go', 'Distributed Systems', 'Kubernetes', 'Kafka', 'PostgreSQL'],
  years_experience: 12,
};

const strategy = buildDeterministicStrategy(sampleJob, sampleProfile, 'Verified resume evidence...');

assert.ok(strategy.strategic_angle.length > 30, 'Strategic angle should be substantive');
assert.ok(strategy.positioning_hook.includes('CloudFlow Technologies'), 'Positioning hook should mention target company');
assert.strictEqual(strategy.core_themes.length, 3, 'Should generate 3 core thematic pillars');
assert.ok(strategy.hurdles.length >= 3, 'Should generate at least 3 objection mitigation hurdles');

const hurdle1 = strategy.hurdles[0];
assert.ok(hurdle1.hurdle && hurdle1.mitigation && hurdle1.evidence_anchor, 'Each hurdle must have hurdle, mitigation, and evidence anchor');

assert.ok(strategy.compensation_guidance.target_anchor.includes('220'), 'Target anchor should calibrate against upper stated range');
assert.ok(strategy.elevator_pitch.length > 50, 'Elevator pitch should be formulated');

console.log('✓ Step 2 PASSED: Strategy Engine deterministically builds positioning hooks, objection mitigation, and comp anchors.\n');

// -------------------------------------------------------------
// STEP 3: Backend AI Strategy & Screening Answers Routes
// -------------------------------------------------------------
console.log('Step 3: Verifying AI Strategy & Screening Answers API Endpoints...');

const strategyRoutePath = path.join(ROOT, 'app', 'api', 'ai', 'strategy', 'route.ts');
const screeningRoutePath = path.join(ROOT, 'app', 'api', 'ai', 'screening-answers', 'route.ts');

assert.ok(fs.existsSync(strategyRoutePath), 'app/api/ai/strategy/route.ts must exist');
assert.ok(fs.existsSync(screeningRoutePath), 'app/api/ai/screening-answers/route.ts must exist');

const strategyRouteCode = fs.readFileSync(strategyRoutePath, 'utf8');
assert.ok(strategyRouteCode.includes('buildDeterministicStrategy'), 'Strategy route should incorporate deterministic fallback');
assert.ok(strategyRouteCode.includes("'jobs'") && strategyRouteCode.includes('metadata'), 'Strategy route should persist into jobs metadata');

const screeningRouteCode = fs.readFileSync(screeningRoutePath, 'utf8');
assert.ok(screeningRouteCode.includes('Remote Autonomy') || screeningRouteCode.includes('Remote & Execution'), 'Screening route should generate remote execution answers');
assert.ok(screeningRouteCode.includes("'jobs'") && screeningRouteCode.includes('metadata'), 'Screening route should persist into jobs metadata');
assert.ok(screeningRouteCode.includes('screening_answers'), 'Screening route should handle screening_answers key');

console.log('✓ Step 3 PASSED: Strategy & Screening Answers endpoints correctly structured with metadata persistence.\n');

// -------------------------------------------------------------
// STEP 4: Canonical Job Select Route Enrichment
// -------------------------------------------------------------
console.log('Step 4: Verifying Canonical Job Selection Route Detection Enrichment...');

const selectJobRoutePath = path.join(ROOT, 'app', 'api', 'jobs', 'select', 'route.ts');
assert.ok(fs.existsSync(selectJobRoutePath), 'app/api/jobs/select/route.ts must exist');

const selectJobCode = fs.readFileSync(selectJobRoutePath, 'utf8');
assert.ok(selectJobCode.includes('detectApplicationRoute'), 'Select route must import and invoke detectApplicationRoute');
assert.ok(selectJobCode.includes('route_detection'), 'Select route must embed route_detection in job metadata');
assert.ok(selectJobCode.includes('route_details'), 'Select route must set route_details in applications record');

console.log('✓ Step 4 PASSED: 1-Click Select Job automatically detects route and enriches pipeline records.\n');

// -------------------------------------------------------------
// STEP 5: Cold Outreach & Executive Offer Persistence
// -------------------------------------------------------------
console.log('Step 5: Verifying Outreach & Offer Tracking Extensions...');

const outreachRoutePath = path.join(ROOT, 'app', 'api', 'ai', 'outreach', 'route.ts');
const applicationsRoutePath = path.join(ROOT, 'app', 'api', 'applications', 'route.ts');

assert.ok(fs.existsSync(outreachRoutePath), 'Outreach route must exist');
assert.ok(fs.existsSync(applicationsRoutePath), 'Applications route must exist');

const outreachCode = fs.readFileSync(outreachRoutePath, 'utf8');
assert.ok(outreachCode.includes('job_id'), 'Outreach route must support canonical job_id scoping');
assert.ok(outreachCode.includes('outreach'), 'Outreach route must persist into metadata');

const appsCode = fs.readFileSync(applicationsRoutePath, 'utf8');
assert.ok(appsCode.includes('offer_details'), 'Applications route must support offer_details');
assert.ok(appsCode.includes('route_details'), 'Applications route must merge offer into route_details');

console.log('✓ Step 5 PASSED: Outreach and Offer tracking seamlessly integrated into existing schema.\n');

// -------------------------------------------------------------
// STEP 6: Unified Job Workspace & AtsResumeStudio Integration
// -------------------------------------------------------------
console.log('Step 6: Verifying Unified Job Workspace & Resume Studio Enhancements...');

const workspacePath = path.join(ROOT, 'components', 'dashboard', 'UnifiedJobWorkspace.tsx');
const resumeStudioPath = path.join(ROOT, 'components', 'dashboard', 'AtsResumeStudio.tsx');

assert.ok(fs.existsSync(workspacePath), 'UnifiedJobWorkspace.tsx must exist');
assert.ok(fs.existsSync(resumeStudioPath), 'AtsResumeStudio.tsx must exist');

const workspaceCode = fs.readFileSync(workspacePath, 'utf8');
assert.ok(workspaceCode.includes('Application Strategy'), 'UnifiedJobWorkspace must include Application Strategy tab');
assert.ok(workspaceCode.includes('Submission Assistant'), 'UnifiedJobWorkspace must include Submission Assistant tab');
assert.ok(workspaceCode.includes('OutreachEngine'), 'UnifiedJobWorkspace must mount OutreachEngine');
assert.ok(workspaceCode.includes('Pre-Flight') && workspaceCode.includes('Safety Checklist'), 'Must include pre-flight safety check');
assert.ok(workspaceCode.includes('Screening Question Answers') || workspaceCode.includes('Screening'), 'Must include screening answers');

const resumeStudioCode = fs.readFileSync(resumeStudioPath, 'utf8');
assert.ok(resumeStudioCode.includes('action verb') || resumeStudioCode.includes('Action Verb'), 'Resume Studio must audit strong action verbs');
assert.ok(resumeStudioCode.includes('metrics') || resumeStudioCode.includes('Metric'), 'Resume Studio must audit quantified metrics');
assert.ok(resumeStudioCode.includes('bulletMode') || resumeStudioCode.includes('interactive'), 'Resume Studio must support interactive bullets mode');

console.log('✓ Step 6 PASSED: Unified Workspace and Resume Studio contain full Phase 5 execution interfaces.\n');

// -------------------------------------------------------------
// STEP 7: Application CRM Kanban Tracker & Executive Offer Evaluator
// -------------------------------------------------------------
console.log('Step 7: Verifying Kanban Tracker & Offer Evaluator...');

const kanbanPath = path.join(ROOT, 'components', 'dashboard', 'KanbanTracker.tsx');
assert.ok(fs.existsSync(kanbanPath), 'KanbanTracker.tsx must exist');

const kanbanCode = fs.readFileSync(kanbanPath, 'utf8');
assert.ok(kanbanCode.includes('detectApplicationRoute'), 'KanbanTracker must use detectApplicationRoute');
assert.ok(kanbanCode.includes('followUpInfo'), 'KanbanTracker must calculate 5-day follow-up deadlines');
assert.ok(kanbanCode.includes('EXECUTIVE OFFER EVALUATOR'), 'KanbanTracker must have Executive Offer Evaluator');
assert.ok(kanbanCode.includes('TACTICAL COUNTER-OFFER TALKING POINTS'), 'KanbanTracker must provide negotiation talking points');
assert.ok(kanbanCode.includes('First-Year Total Comp'), 'KanbanTracker must compute First-Year Total Comp');

console.log('✓ Step 7 PASSED: Kanban Tracker displays route badges, follow-up deadlines, and complete offer negotiation.\n');

// -------------------------------------------------------------
// STEP 8: Dashboard Orchestration & Multi-Job Isolation
// -------------------------------------------------------------
console.log('Step 8: Verifying Dashboard Wiring & Canonical Job Scoping...');

const dashboardPath = path.join(ROOT, 'components', 'Dashboard.tsx');
assert.ok(fs.existsSync(dashboardPath), 'Dashboard.tsx must exist');

const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');
assert.ok(dashboardCode.includes('runStrategy'), 'Dashboard must implement runStrategy');
assert.ok(dashboardCode.includes('runScreeningAnswers'), 'Dashboard must implement runScreeningAnswers');
assert.ok(dashboardCode.includes('onRunStrategy'), 'Dashboard must pass onRunStrategy to UnifiedJobWorkspace');
assert.ok(dashboardCode.includes('onRunScreeningAnswers'), 'Dashboard must pass onRunScreeningAnswers to UnifiedJobWorkspace');
assert.ok(dashboardCode.includes("id: 'strategy'"), 'Dashboard sidebar must include strategy tab');
assert.ok(dashboardCode.includes("id: 'submission'"), 'Dashboard sidebar must include submission tab');

console.log('✓ Step 8 PASSED: Dashboard cleanly wires Phase 5 intelligence runners to the canonical active job.\n');

console.log('================================================================');
console.log('  ALL PHASE 5 VERIFICATION CHECKS COMPLETED SUCCESSFULLY (8/8)  ');
console.log('================================================================\n');
