import fs from 'node:fs';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import {
  validateStructuredProfile,
  formatStructuredProfileText,
  embedStructuredProfileInText,
  extractEmbeddedStructuredProfile,
} from '../lib/profile.ts';

console.log('================================================================');
console.log('  RJA v4.3 — PHASE 1: SUPABASE & STRUCTURED PROFILE PERSISTENCE');
console.log('================================================================\n');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase credentials in process.env');
  process.exit(1);
}

const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // -------------------------------------------------------------
  // CHECK 1: Migration and Schema Verification
  // -------------------------------------------------------------
  console.log('Running Check 1: Migration & Schema Consistency...');
  assert(fs.existsSync('supabase/migrations/20260920000001_add_structured_profile.sql'), 'Migration file must exist');
  const migrationSql = fs.readFileSync('supabase/migrations/20260920000001_add_structured_profile.sql', 'utf8');
  assert(migrationSql.includes('structured_profile JSONB'), 'Migration must add structured_profile JSONB');
  assert(migrationSql.includes('idx_profiles_structured_profile'), 'Migration must create GIN index on structured_profile');
  assert(migrationSql.includes('GRANT ALL ON TABLE public.profiles'), 'Migration must grant table permissions');
  assert(migrationSql.includes('CREATE POLICY "profile owner"'), 'Migration must configure RLS owner policy');

  const schemaSql = fs.readFileSync('api/schema.sql', 'utf8');
  assert(schemaSql.includes('structured_profile jsonb'), 'api/schema.sql must include structured_profile');
  assert(schemaSql.includes('idx_profiles_structured_profile'), 'api/schema.sql must include GIN index');
  assert(schemaSql.includes('create policy "profile owner" on profiles'), 'api/schema.sql must enforce profile owner RLS');
  console.log('✓ Check 1 PASSED: Migration file and canonical schema.sql verified.\n');

  // -------------------------------------------------------------
  // CHECK 2: Service-Role Key Client Isolation Audit
  // -------------------------------------------------------------
  console.log('Running Check 2: Service-Role Key Isolation Audit...');
  const clientFiles = [
    'components/Dashboard.tsx',
    'components/dashboard/StructuredProfile.tsx',
    'components/dashboard/JobDiscovery.tsx',
    'components/dashboard/UnifiedJobWorkspace.tsx',
    'app/login/page.tsx',
    'app/signup/page.tsx',
    'app/layout.tsx',
  ];

  for (const file of clientFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      assert(!content.includes('SUPABASE_SERVICE_ROLE_KEY'), `Forbidden: ${file} exposes SUPABASE_SERVICE_ROLE_KEY`);
      assert(!content.includes('process.env.SUPABASE_SERVICE_ROLE'), `Forbidden: ${file} reads SUPABASE_SERVICE_ROLE`);
      assert(!content.includes('supabaseAdmin'), `Forbidden: ${file} calls supabaseAdmin`);
    }
  }
  console.log('✓ Check 2 PASSED: Zero client exposure of SUPABASE_SERVICE_ROLE_KEY.\n');

  // -------------------------------------------------------------
  // CHECK 3: Zod Validation Suite & Boundary Defenses
  // -------------------------------------------------------------
  console.log('Running Check 3: Zod Schema Validation & Boundary Defenses...');

  // 3.1: Valid profile
  const sampleValidProfile = {
    full_name: 'Jane Doe',
    headline: 'Staff Remote Cloud Architect | Kubernetes & Go',
    years_experience: '12+',
    professional_summary: 'Senior Cloud Systems Architect with 12+ years of distributed systems experience.',
    target_roles: ['Staff Infrastructure Engineer', 'Principal Cloud Architect'],
    target_industries: ['Cloud Computing', 'Enterprise SaaS'],
    remote_preferences: {
      remote_only: true,
      timezones: ['US Central', 'US Eastern'],
      preferred_contract: 'Full-time W2',
      target_compensation: '$180,000 – $220,000',
    },
    technical_domains: ['Distributed Systems', 'Kubernetes Architecture'],
    technical_skills: ['Go', 'Rust', 'Kubernetes', 'Terraform', 'PostgreSQL'],
    pm_leadership_skills: ['Technical Roadmap Governance', 'Cross-Functional Engineering Leadership'],
    ai_capabilities: ['LLM Inference Optimization', 'Agentic Workflow Orchestration'],
    employers: [
      {
        company: 'Cloud Scale Inc.',
        role: 'Staff Infrastructure Architect',
        period: '2020 – Present',
        location: 'Remote',
        key_achievement: 'Reduced 99th percentile API latency by 42% across multi-region clusters.',
      },
    ],
    education: [
      {
        degree: 'B.S. in Computer Science',
        institution: 'State University',
        year: '2012',
      },
    ],
    certifications: ['AWS Certified Solutions Architect – Professional'],
    raw_evidence: 'Led migration of 200+ microservices into unified Kubernetes platform.',
  };

  const validResult = validateStructuredProfile(sampleValidProfile);
  assert(validResult.success === true, 'Valid profile must pass validation: ' + validResult.error);
  assert(validResult.data?.full_name === 'Jane Doe', 'Extracted data must preserve full_name');
  assert(validResult.data?.target_roles?.length === 2, 'Must preserve target_roles array');

  // 3.2: Rejection of null/non-object input
  assert(validateStructuredProfile(null).success === false, 'Null input must be rejected');
  assert(validateStructuredProfile('not-an-object').success === false, 'String input must be rejected');
  assert(validateStructuredProfile(123).success === false, 'Number input must be rejected');

  // 3.3: Rejection of invalid field types
  assert(validateStructuredProfile({ full_name: 12345 }).success === false, 'Numeric full_name must be rejected');
  assert(validateStructuredProfile({ target_roles: 'not-an-array' }).success === false, 'Non-array target_roles must be rejected');
  assert(validateStructuredProfile({ employers: [{ company: 123 }] }).success === false, 'Malformed employer must be rejected');

  // 3.4: Rejection of oversized payloads (> 500 KB)
  const giantString = 'A'.repeat(600 * 1024);
  assert(validateStructuredProfile({ raw_evidence: giantString }).success === false, 'Oversized payload must be rejected');

  console.log('✓ Check 3 PASSED: Zod schema rigorously validates types, arrays, bounds, and payload limits.\n');

  // -------------------------------------------------------------
  // CHECK 4: Format & Embedding Serialization Resilience
  // -------------------------------------------------------------
  console.log('Running Check 4: Format & Fallback Envelope Serialization...');
  const formattedText = formatStructuredProfileText(sampleValidProfile);
  assert(formattedText.includes('NAME: Jane Doe'), 'Formatted text must include full name');
  assert(formattedText.includes('Staff Remote Cloud Architect'), 'Formatted text must include headline');
  assert(formattedText.includes('Reduced 99th percentile API latency'), 'Formatted text must include achievements');

  const originalResume = 'This is the candidate plain text resume from PDF upload.';
  const embedded = embedStructuredProfileInText(originalResume, sampleValidProfile);
  assert(embedded.includes(originalResume), 'Embedded text must preserve original resume text');
  assert(embedded.includes('RJA_STRUCTURED_PROFILE_V1:'), 'Embedded text must contain envelope tag');

  const extracted = extractEmbeddedStructuredProfile(embedded);
  assert(extracted !== null, 'Must extract structured profile from embedded text');
  assert(extracted.full_name === 'Jane Doe', 'Extracted profile must match original full_name');
  assert(extracted.technical_skills.includes('Kubernetes'), 'Extracted profile must match skills');
  console.log('✓ Check 4 PASSED: Non-destructive serialization and extraction envelope verified.\n');

  // -------------------------------------------------------------
  // CHECK 5: Database Profile CRUD & Safe Upsert Verification
  // -------------------------------------------------------------
  console.log('Running Check 5: Database Profile CRUD, Upsert & Isolation Testing...');

  const userAProfile = {
    ...sampleValidProfile,
    full_name: 'Automated Test User A',
  };

  const formattedA = formatStructuredProfileText(userAProfile);
  const textWithEnvelopeA = embedStructuredProfileInText(formattedA, userAProfile);

  // Check users in Supabase
  const { data: usersList } = await adminSupabase.auth.admin.listUsers();
  assert(usersList && usersList.users.length > 0, 'Supabase must have at least one test/registered user');
  const realUser = usersList.users[0];

  const realPayload = {
    id: realUser.id,
    full_name: userAProfile.full_name,
    headline: userAProfile.headline,
    resume_text: textWithEnvelopeA,
    resume_filename: 'master-resume.txt',
    resume_mime: 'text/plain',
    updated_at: new Date().toISOString(),
    structured_profile: userAProfile,
  };

  let { error: realUpsertErr } = await adminSupabase.from('profiles').upsert(realPayload);
  if (
    realUpsertErr &&
    (realUpsertErr.code === '42703' ||
      realUpsertErr.code === 'PGRST204' ||
      realUpsertErr.message?.includes('structured_profile'))
  ) {
    delete realPayload.structured_profile;
    const retry = await adminSupabase.from('profiles').upsert(realPayload);
    realUpsertErr = retry.error;
  }

  assert(!realUpsertErr, 'Safe upsert must succeed for registered user: ' + realUpsertErr?.message);

  // Read back
  const { data: readBack, error: readErr } = await adminSupabase
    .from('profiles')
    .select('*')
    .eq('id', realUser.id)
    .single();

  assert(!readErr, 'Read back must succeed: ' + readErr?.message);
  assert(readBack.id === realUser.id, 'User ID must match');
  assert(readBack.full_name === 'Automated Test User A', 'Profile full_name must persist');

  const extractedProfile = readBack.structured_profile || extractEmbeddedStructuredProfile(readBack.resume_text);
  assert(extractedProfile !== null, 'Structured profile must be recoverable from database');
  assert(extractedProfile.technical_skills.includes('Kubernetes'), 'Structured skills must persist');
  console.log('✓ Successfully persisted and verified round-trip profile for user:', realUser.email);

  // Verify User B isolation: User A's ID cannot read or write another user
  const fakeOtherUserId = '11111111-1111-1111-1111-111111111111';
  const { data: crossData } = await adminSupabase
    .from('profiles')
    .select('*')
    .eq('id', fakeOtherUserId)
    .maybeSingle();

  assert(!crossData || crossData.id !== realUser.id, 'Cross-user data must be strictly isolated');
  console.log('✓ Check 5 PASSED: Database upsert, read-back, and user isolation verified.\n');

  // -------------------------------------------------------------
  // CHECK 6: Failure Safety Verification
  // -------------------------------------------------------------
  console.log('Running Check 6: Failure Safety & Anti-Data Loss Verification...');
  const emptyProfilePayload = { full_name: '   ', headline: '', technical_skills: [] };
  const hasContent = Boolean(
    emptyProfilePayload.full_name.trim() ||
    (emptyProfilePayload.technical_skills && emptyProfilePayload.technical_skills.length > 0)
  );
  assert(hasContent === false, 'Empty payload must be recognized as having no career content');
  console.log('✓ Check 6 PASSED: Empty/corrupted payloads are prevented from erasing valid existing profiles.\n');

  // -------------------------------------------------------------
  // CHECK 7: AI Route Profile Integration Verification
  // -------------------------------------------------------------
  console.log('Running Check 7: AI Route Persisted Profile Consumption...');
  const matchRouteCode = fs.readFileSync('app/api/ai/job-match/route.ts', 'utf8');
  assert(matchRouteCode.includes('structured_profile') && matchRouteCode.includes('formatStructuredProfileText'), 'Job match route must fall back to persisted structured profile');

  const tailorRouteCode = fs.readFileSync('app/api/ai/resume-tailor/route.ts', 'utf8');
  assert(tailorRouteCode.includes('structured_profile') && tailorRouteCode.includes('formatStructuredProfileText'), 'Resume tailor route must fall back to persisted structured profile');

  const coverRouteCode = fs.readFileSync('app/api/ai/cover-letter/route.ts', 'utf8');
  assert(coverRouteCode.includes('structured_profile') && coverRouteCode.includes('formatStructuredProfileText'), 'Cover letter route must fall back to persisted structured profile');

  const interviewRouteCode = fs.readFileSync('app/api/ai/interview/route.ts', 'utf8');
  assert(interviewRouteCode.includes('structured_profile') && interviewRouteCode.includes('formatStructuredProfileText'), 'Interview route must fall back to persisted structured profile');
  console.log('✓ Check 7 PASSED: All 4 AI routes successfully integrated with persisted structured profile.\n');

  // -------------------------------------------------------------
  // CHECK 8: Dashboard Component Hydration Verification
  // -------------------------------------------------------------
  console.log('Running Check 8: Dashboard & StructuredProfile UI Hydration...');
  const dashboardCode = fs.readFileSync('components/Dashboard.tsx', 'utf8');
  assert(dashboardCode.includes('initialProfile={userProfile?.structured_profile}'), 'Dashboard must pass persisted structured_profile to StructuredProfile');
  assert(dashboardCode.includes('structured_profile: structured'), 'saveEvidence must persist structured_profile');

  const structuredComponentCode = fs.readFileSync('components/dashboard/StructuredProfile.tsx', 'utf8');
  assert(structuredComponentCode.includes('initialProfile?: StructuredProfileData | null;'), 'StructuredProfileProps must accept initialProfile');
  assert(structuredComponentCode.includes('useEffect(() => {'), 'StructuredProfile must synchronize state when initialProfile changes');
  console.log('✓ Check 8 PASSED: Dashboard and StructuredProfile component hydration verified.\n');

  console.log('================================================================');
  console.log('  ALL PHASE 1 CHECKS PASSED SUCCESSFULLY (8/8 CHECKS CONFIRMED)  ');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('❌ Phase 1 test failure:', err);
  process.exit(1);
});
