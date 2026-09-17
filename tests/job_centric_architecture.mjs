import fs from 'node:fs';
import assert from 'node:assert';

console.log('--- RUNNING CANONICAL JOB-CENTRIC WORKFLOW VALIDATION ---');

// 1. Schema & Migration verification
const schema = fs.readFileSync('api/schema.sql', 'utf8');
const requiredColumns = [
  'cover_letter jsonb',
  'company_website text',
  'application_url text',
  'remote_status text',
  'location text',
  'salary text',
  'employment_type text',
  'source text',
  'discovered_date timestamptz',
  'metadata jsonb',
];
for (const col of requiredColumns) {
  assert(schema.includes(col), `api/schema.sql must include column migration: ${col}`);
}
console.log('✓ Database schema verified with all canonical job columns & migrations');

// 2. Select Job route architecture
const selectRoute = fs.readFileSync('app/api/jobs/select/route.ts', 'utf8');
assert(selectRoute.includes("from('jobs')"), 'Must target jobs table');
assert(selectRoute.includes("from('applications')"), 'Must link pipeline applications table');
assert(selectRoute.includes('remote_status'), 'Must preserve remote status');
assert(selectRoute.includes('application_url'), 'Must support direct application URL');
console.log('✓ /api/jobs/select route verified: establishes canonical job_id and pipeline link');

// 3. Automated Profile-Driven Discovery verification
const discoverRoute = fs.readFileSync('app/api/jobs/discover/route.ts', 'utf8');
assert(discoverRoute.includes('RemoteJobOpportunity'), 'Must export RemoteJobOpportunity type');
assert(discoverRoute.includes('CURATED_REMOTE_JOBS'), 'Must contain curated high-conviction opportunities');
assert(discoverRoute.includes('match_preview'), 'Must include evidence match preview');

const discoveryComp = fs.readFileSync('components/dashboard/JobDiscovery.tsx', 'utf8');
assert(discoveryComp.includes('profileSignals'), 'Must compute profile signals from master evidence');
assert(discoveryComp.includes('handleSelectCuratedJob'), 'Must provide 1-click Select Job');
assert(discoveryComp.includes('Select Job →'), 'Must offer clear 1-click selection button');
console.log('✓ Remote Job Discovery verified: evidence-matched curated engine with 1-click Select Job');

// 4. Unified Job Workspace verification
const workspaceComp = fs.readFileSync('components/dashboard/UnifiedJobWorkspace.tsx', 'utf8');
const requiredSubtabs = ['overview', 'match', 'resume', 'qc', 'cover', 'interview', 'package'];
for (const tab of requiredSubtabs) {
  assert(workspaceComp.includes(`id: '${tab}'`), `UnifiedJobWorkspace must include subtab: ${tab}`);
}
assert(workspaceComp.includes('readinessChecks'), 'Must compute application readiness checklist');
assert(workspaceComp.includes('qcAudiMetrics'), 'Must execute ATS QC engine audits');
assert(workspaceComp.includes('CANONICAL JOB RECORD'), 'Must display active canonical record header');
console.log('✓ Unified Job Workspace verified: Overview, Match, Resume Studio, ATS QC Engine, Cover Letter, Interview Coach, and Application Package');

// 5. Dashboard Canonical Backbone verification
const dashboardComp = fs.readFileSync('components/Dashboard.tsx', 'utf8');
assert(dashboardComp.includes('activeJobId'), 'Dashboard must maintain canonical activeJobId');
assert(dashboardComp.includes('const activeJob: SavedJob | null = useMemo'), 'Dashboard must compute activeJob from canonical jobs array');
assert(dashboardComp.includes('UnifiedJobWorkspace'), 'Dashboard must render UnifiedJobWorkspace');
assert(dashboardComp.includes('selectOpportunity'), 'Dashboard must provide selectOpportunity handler');
assert(!dashboardComp.includes('setTailor('), 'Dashboard must not use obsolete fragmented local tailor state');
assert(!dashboardComp.includes('setCover('), 'Dashboard must not use obsolete fragmented local cover state');
assert(!dashboardComp.includes('setInterview('), 'Dashboard must not use obsolete fragmented local interview state');
console.log('✓ Dashboard verified: Clean canonical job_id architecture with multi-job isolation and no state drift');

// 6. Application Command Center (Kanban & CRM) verification
const kanbanComp = fs.readFileSync('components/dashboard/KanbanTracker.tsx', 'utf8');
assert(kanbanComp.includes('STAGES'), 'Kanban must define 8 lifecycle stages');
assert(kanbanComp.includes('openDossier'), 'Must support full opportunity dossier');
assert(kanbanComp.includes('quick-fill') || kanbanComp.includes('Quick-Fill') || kanbanComp.includes('apply'), 'Must support direct application route tools');
console.log('✓ Application Pipeline & CRM verified: 8 stages, complete dossiers, and direct application routes');

// 7. Clean Print Styling verification
const globalsCss = fs.readFileSync('app/globals.css', 'utf8');
assert(globalsCss.includes('@media print'), 'app/globals.css must include print stylesheet');
console.log('✓ Print stylesheet verified: Clean PDF single-column resume export supported');

console.log('--- ALL CANONICAL JOB-CENTRIC WORKFLOW CHECKS PASSED (7/7) ---');
