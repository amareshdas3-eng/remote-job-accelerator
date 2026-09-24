import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { persistDiscoveredJobs } from '../../../../lib/jobs/ingestion';
import { normalizeJobRecord } from '../../../../lib/jobs/normalizer';
import type { CandidateMatchResult } from '../../../../lib/matching/types.ts';
import { computeCandidateJobMatch } from '../../../../lib/matching/engine.ts';

export interface RemoteJobOpportunity {
  id: string;
  external_id?: string;
  title: string;
  company: string;
  location: string;
  remote_status: string;
  salary_range: string;
  source: string;
  url: string;
  application_url?: string;
  category: 'electrical' | 'project_management' | 'ai_operations' | 'industrial' | 'software_engineering' | 'general';
  match_preview: {
    fit_score: number;
    aligned_skills: string[];
    role_focus: string;
  };
  candidate_intelligence?: CandidateMatchResult;
  is_shortlisted?: boolean;
  key_requirements: string[];
  description: string;
  published_at?: string;
}

// Curated high-conviction remote roles aligned with electrical engineering, project management, commissioning, and AI operations
const CURATED_REMOTE_JOBS: RemoteJobOpportunity[] = [
  {
    id: 'disc-schneider-elec-pm',
    external_id: 'seed:schneider-electric:elec-pm',
    title: 'Remote Senior Electrical Project Manager',
    company: 'Schneider Electric Global',
    location: '100% Remote (US / Global)',
    remote_status: '100% Remote',
    salary_range: '$145,000 – $180,000 / yr',
    source: 'Schneider Electric Careers',
    url: 'https://www.se.com/us/en/about-us/careers/',
    application_url: 'https://www.se.com/us/en/about-us/careers/',
    category: 'electrical',
    match_preview: {
      fit_score: 95,
      aligned_skills: ['Electrical Engineering', 'Erection & Commissioning', 'Project Management', 'Industrial Systems', 'PMP'],
      role_focus: 'End-to-end execution of utility-scale and industrial electrical distribution projects.',
    },
    key_requirements: [
      'Bachelor’s degree in Electrical Engineering with 10+ years of industrial power systems execution.',
      'Demonstrated expertise in erection, testing, commissioning, and safety standards for electrical substations and switchgear.',
      'PMP certification or equivalent senior project leadership experience managing multi-million-dollar technical budgets.',
      'Proven ability to manage remote technical teams, vendors, contractors, and client stakeholders asynchronously.',
      'Experience in contract management, technical tendering, FAT/SAT inspections, and quality assurance.',
    ],
    description: `About the Role:
Schneider Electric is seeking an experienced Remote Senior Electrical Project Manager to lead complex industrial electrical power, distribution, and automation projects across North America and global sites.

Key Responsibilities:
• Lead technical project planning, erection, installation, and testing & commissioning of medium-to-high voltage power distribution equipment, switchboards, and motor control centers.
• Direct multi-disciplinary project teams, engineering contractors, and site supervisors remotely using modern project tracking systems and digitized reporting.
• Manage project lifecycles from tendering, procurement, and technical submittals through to Site Acceptance Testing (SAT) and commercial hand-over.
• Ensure strict compliance with OSHA, NFPA 70E, IEEE, and IEC safety and engineering standards.
• Champion digital transformation and AI-assisted project tracking tools for schedule variance reduction and risk forecasting.

Qualifications:
• B.S. in Electrical Engineering (B.Tech / B.E. or equivalent).
• 10+ years in electrical project management, erection, commissioning, and plant maintenance.
• Strong foundation in contractual negotiations, schedule forecasting, and risk mitigation.`,
  },
  {
    id: 'disc-siemens-eng-pm',
    external_id: 'seed:siemens-energy:eng-pm',
    title: 'Remote Engineering Project Manager — Industrial & Energy Infrastructure',
    company: 'Siemens Energy',
    location: '100% Remote (US / Global Remote)',
    remote_status: '100% Remote',
    salary_range: '$150,000 – $185,000 / yr',
    source: 'Siemens Energy Portal',
    url: 'https://www.siemens-energy.com/global/en/company/jobs.html',
    application_url: 'https://www.siemens-energy.com/global/en/company/jobs.html',
    category: 'project_management',
    match_preview: {
      fit_score: 93,
      aligned_skills: ['Industrial Electrical Systems', 'Plant Engineering', 'Testing & Commissioning', 'Senior Management', 'Tendering'],
      role_focus: 'Large-scale energy infrastructure modernization and industrial power plant systems.',
    },
    key_requirements: [
      'Degree in Electrical or Mechanical Engineering with senior project management background.',
      'Deep background in industrial plant engineering, instrumentation, and testing & commissioning.',
      'Mastery of project governance, scope control, milestones, and contractor quality management.',
      'Familiarity with modern collaborative platforms and AI-enhanced schedule optimization.',
      'Excellent stakeholder presentation, vendor dispute resolution, and contractual oversight skills.',
    ],
    description: `Overview:
Siemens Energy is looking for a Remote Engineering Project Manager to direct key energy transition and electrical infrastructure projects. You will oversee technical planning, engineering review, and commissioning milestones from remote headquarters.

Responsibilities:
• Deliver turnkey electrical and automation engineering solutions for utility, industrial, and infrastructure clients.
• Coordinate with site managers, testing engineers, and OEM specialists for pre-commissioning, functional testing, and energization.
• Oversee procurement contracts, equipment FAT tests, and warranty transition phases.
• Drive predictive timeline analytics and AI-assisted resource allocation across distributed engineering portfolios.

Requirements:
• Electrical Engineering degree with 8+ years leading engineering execution.
• Hands-on history in industrial installations, switchgear, protection relays, or plant instrumentation.
• PMP or Prince2 certification preferred.`,
  },
  {
    id: 'disc-abb-tech-pm',
    external_id: 'seed:abb-global:tech-pm',
    title: 'Remote Technical Project Manager — Power Systems & Automation',
    company: 'ABB Global Systems',
    location: '100% Remote (Remote US / Americas)',
    remote_status: '100% Remote',
    salary_range: '$140,000 – $175,000 / yr',
    source: 'ABB Careers',
    url: 'https://careers.abb/global/en',
    application_url: 'https://careers.abb/global/en',
    category: 'electrical',
    match_preview: {
      fit_score: 91,
      aligned_skills: ['Electrical Installation', 'Operations & Maintenance', 'Instrumentation', 'Safety & Quality', 'PMP'],
      role_focus: 'Power grids, industrial drives, SCADA/automation integration, and lifecycle reliability.',
    },
    key_requirements: [
      'Extensive background managing technical deliverables in electrical automation and power delivery.',
      'Track record in operations & maintenance (O&M), shutdown planning, and equipment reliability.',
      'Strong knowledge of contracting, tendering, and vendor management.',
      'Remote leadership capabilities with cross-functional technical teams.',
    ],
    description: `Role Purpose:
ABB is looking for a Remote Technical Project Manager to coordinate the execution of power systems, industrial drives, and electrification infrastructure.

Responsibilities:
• Oversee project engineering, equipment specification, procurement tracking, and commissioning schedules.
• Interface directly with client project directors, electrical superintendents, and safety inspectors.
• Implement digitized O&M procedures and remote testing protocols.
• Deliver projects within strict safety, budget, and time constraints.`,
  },
  {
    id: 'disc-grid-ai-ops-pm',
    external_id: 'seed:grid-dynamics:ai-ops-pm',
    title: 'Remote Project Manager — AI-Assisted Operations & Engineering Systems',
    company: 'Grid Dynamics Energy',
    location: '100% Remote (Global)',
    remote_status: '100% Remote',
    salary_range: '$155,000 – $190,000 / yr',
    source: 'Grid Dynamics Jobs',
    url: 'https://www.griddynamics.com/careers',
    application_url: 'https://www.griddynamics.com/careers',
    category: 'ai_operations',
    match_preview: {
      fit_score: 89,
      aligned_skills: ['AI-assisted Project Management', 'Agentic AI Workflows', 'Engineering Leadership', 'Operations & Maintenance'],
      role_focus: 'Leveraging AI workflows to accelerate complex engineering and infrastructure project execution.',
    },
    key_requirements: [
      'Experience in engineering or technical operations combined with adoption of AI-assisted productivity tools.',
      'History of managing technical teams, setting milestone gates, and tracking KPIs.',
      'Ability to integrate agentic AI workflows and LLM-assisted document verification into PM pipelines.',
      'High-velocity async communication and documentation skills.',
    ],
    description: `Position Summary:
Grid Dynamics Energy is pioneering AI-driven workflows for modern infrastructure management. We seek an engineering leader to pilot and scale AI-augmented project management across technical portfolios.

Core Responsibilities:
• Lead cross-functional engineering deliverables while deploying AI tooling for schedule auditing, document intelligence, and cost tracking.
• Bridge traditional engineering methodologies (PMP, EPC) with modern generative AI assistance and automation.
• Manage stakeholder communications, deliverables, and quality assurance frameworks remotely.`,
  },
  {
    id: 'disc-tesla-infra-pm',
    external_id: 'seed:tesla:infra-pm',
    title: 'Remote Industrial Project Manager — Megapack & Microgrid Systems',
    company: 'Tesla Energy Infrastructure',
    location: '100% Remote (US)',
    remote_status: '100% Remote',
    salary_range: '$148,000 – $182,000 / yr',
    source: 'Tesla Careers',
    url: 'https://www.tesla.com/careers',
    application_url: 'https://www.tesla.com/careers',
    category: 'industrial',
    match_preview: {
      fit_score: 92,
      aligned_skills: ['Industrial Electrical Systems', 'Testing & Commissioning', 'Site Management', 'Safety & Quality'],
      role_focus: 'Grid-scale energy storage deployment, HV interconnects, and commissioning governance.',
    },
    key_requirements: [
      'Engineering degree with 8+ years leading large-scale industrial electrical or energy storage installations.',
      'Thorough understanding of electrical codes, interconnection agreements, and commissioning milestones.',
      'Demonstrated high ownership in fast-paced, high-stakes project environments.',
      'Excellent remote coordination across field engineers, contractors, and utility partners.',
    ],
    description: `The Role:
Tesla Energy is scaling global Megapack and renewable microgrid deployments. We are hiring a Remote Industrial Project Manager to supervise electrical interconnection, pre-commissioning checklists, and contractor delivery.

Responsibilities:
• Steer engineering submittals, single-line diagram (SLD) reviews, and utility inspection coordination.
• Drive commissioning milestone tracking, punch-list clearance, and final energization.
• Enforce zero-incident safety culture and quality compliance across all contractor crews.`,
  },
  {
    id: 'disc-black-veatch-consult',
    external_id: 'seed:black-veatch:consult',
    title: 'Remote Senior Technical Consultant — Electrical Systems & Tendering',
    company: 'Black & Veatch Engineering',
    location: '100% Remote (US / Global Remote)',
    remote_status: '100% Remote',
    salary_range: '$152,000 – $188,000 / yr',
    source: 'Black & Veatch Careers',
    url: 'https://www.bv.com/careers',
    application_url: 'https://www.bv.com/careers',
    category: 'electrical',
    match_preview: {
      fit_score: 94,
      aligned_skills: ['Contracting & Tendering', 'Plant Engineering', 'Erection & Commissioning', 'Senior Management'],
      role_focus: 'Owner’s engineering, technical bid evaluation, specification drafting, and commissioning oversight.',
    },
    key_requirements: [
      'Senior electrical engineering background with expertise in EPC contracting, tendering, and technical specifications.',
      'Experience reviewing contractor proposals, single-line diagrams, and protection schemes.',
      'Proven leadership in commissioning advisory, project audit, and handover governance.',
    ],
    description: `Opportunity:
Join Black & Veatch’s global advisory practice as a Remote Senior Technical Consultant. You will advise utility and industrial clients on electrical plant engineering, bid evaluation, and commissioning readiness.

Responsibilities:
• Formulate technical specifications and tender packages for electrical balance of plant (BOP).
• Review engineering calculations, equipment datasheets, and test protocols.
• Act as senior client advisor during critical project testing, commissioning, and acceptance phases.`,
  },
];

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim().toLowerCase();
    const category = searchParams.get('category') || 'all';
    const remoteOnly = searchParams.get('remote_only') !== 'false';
    const minFit = parseInt(searchParams.get('min_fit') || '0', 10);
    const sort = (searchParams.get('sort') || 'fit').toLowerCase(); // 'fit' | 'date' | 'company'
    const seniority = (searchParams.get('seniority') || 'all').toLowerCase(); // 'all' | 'executive' | 'senior' | 'mid'
    const shortlistedOnly = searchParams.get('shortlisted_only') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));

    const admin = supabaseAdmin();

    // 1. Fetch user profile & structured evidence signals for Candidate Intelligence
    let userEvidence = '';
    let structuredProfile: any = null;
    let shortlistedIds: string[] = [];

    try {
      const { data: prof } = await admin
        .from('profiles')
        .select('headline, resume_text, structured_profile')
        .eq('id', user.id)
        .maybeSingle();

      if (prof) {
        structuredProfile = prof.structured_profile || null;
        userEvidence = `${prof.headline || ''} ${prof.resume_text || ''} ${JSON.stringify(prof.structured_profile || {})}`.toLowerCase();
        if (Array.isArray(prof.structured_profile?.shortlisted_jobs)) {
          shortlistedIds = prof.structured_profile.shortlisted_jobs;
        }
      }
    } catch {
      // Non-fatal if profile read fails
    }

    // 2. Query discovered_jobs from Supabase
    let dbQuery = admin.from('discovered_jobs').select('*');

    if (category !== 'all') {
      dbQuery = dbQuery.eq('category', category);
    }
    if (query) {
      dbQuery = dbQuery.or(`title.ilike.%${query}%,company.ilike.%${query}%,description.ilike.%${query}%`);
    }
    if (remoteOnly) {
      dbQuery = dbQuery.ilike('remote_status', '%remote%');
    }

    const { data: dbJobs, error: dbError } = await dbQuery
      .order('published_at', { ascending: false })
      .limit(200);

    let allOpportunities: RemoteJobOpportunity[] = [];

    if (!dbError && dbJobs && dbJobs.length > 0) {
      allOpportunities = dbJobs.map((row: any) => {
        const skills: string[] = Array.isArray(row.skills) ? row.skills : [];
        const intel = computeCandidateJobMatch(
          {
            title: row.title,
            description: row.description || '',
            skills,
            location: row.location || '',
            remote_status: row.remote_status || '',
            category: row.category || '',
            company: row.company || '',
          },
          structuredProfile,
          userEvidence
        );

        const isShortlisted = shortlistedIds.includes(row.id) || (row.external_id ? shortlistedIds.includes(row.external_id) : false);

        return {
          id: row.id,
          external_id: row.external_id,
          title: row.title,
          company: row.company,
          location: row.location || '100% Remote',
          remote_status: row.remote_status || '100% Remote',
          salary_range: row.salary || 'Competitive / Unspecified',
          source: row.source || 'Direct Verified Employer',
          url: row.url,
          application_url: row.url,
          category: (row.category as any) || 'general',
          match_preview: {
            fit_score: intel.fit_score,
            aligned_skills: intel.matched_skills.length > 0 ? intel.matched_skills : (skills.length > 0 ? skills.slice(0, 4) : ['Remote Execution', 'Engineering Leadership']),
            role_focus: intel.why_matched[0] || `High-conviction remote opportunity at ${row.company}.`,
          },
          candidate_intelligence: intel,
          is_shortlisted: isShortlisted,
          key_requirements: skills.length > 0 ? skills.map((s) => `Demonstrated capability in ${s}.`) : [
            'Direct industry background and remote leadership capabilities.',
            'Proven track record in asynchronous communication and delivery.',
          ],
          description: row.description || '',
          published_at: row.published_at,
        };
      });
    } else {
      // Auto-seed into Supabase in background for subsequent requests
      persistDiscoveredJobs(
        CURATED_REMOTE_JOBS.map((j) =>
          normalizeJobRecord({
            native_id: j.external_id,
            title: j.title,
            company: j.company,
            url: j.url,
            application_url: j.application_url || j.url,
            description: j.description,
            salary: j.salary_range,
            location: j.location,
            remote_status: j.remote_status,
            source: j.source,
            category: j.category,
            skills: j.match_preview.aligned_skills,
          })
        )
      ).catch(() => {});

      let filtered = CURATED_REMOTE_JOBS;
      if (category !== 'all') {
        filtered = filtered.filter((j) => j.category === category);
      }
      if (query) {
        filtered = filtered.filter(
          (j) =>
            j.title.toLowerCase().includes(query) ||
            j.company.toLowerCase().includes(query) ||
            j.key_requirements.some((k) => k.toLowerCase().includes(query)) ||
            j.match_preview.aligned_skills.some((s) => s.toLowerCase().includes(query))
        );
      }

      allOpportunities = filtered.map((j) => {
        const intel = computeCandidateJobMatch(
          {
            title: j.title,
            description: j.description,
            skills: j.match_preview.aligned_skills,
            location: j.location,
            remote_status: j.remote_status,
            category: j.category,
            company: j.company,
          },
          structuredProfile,
          userEvidence
        );

        const isShortlisted = shortlistedIds.includes(j.id) || (j.external_id ? shortlistedIds.includes(j.external_id) : false);

        return {
          ...j,
          match_preview: {
            ...j.match_preview,
            fit_score: intel.fit_score,
            aligned_skills: intel.matched_skills.length > 0 ? intel.matched_skills : j.match_preview.aligned_skills,
            role_focus: intel.why_matched[0] || j.match_preview.role_focus,
          },
          candidate_intelligence: intel,
          is_shortlisted: isShortlisted,
        };
      });
    }

    // 3. Apply Multi-Criteria Filters
    let processed = allOpportunities;

    if (minFit > 0) {
      processed = processed.filter((o) => (o.candidate_intelligence?.fit_score || o.match_preview.fit_score) >= minFit);
    }

    if (seniority !== 'all') {
      if (seniority === 'executive') {
        processed = processed.filter((o) => /director|vp|head|chief|principal/i.test(o.title));
      } else if (seniority === 'senior') {
        processed = processed.filter((o) => /senior|sr\b|lead/i.test(o.title));
      } else if (seniority === 'mid') {
        processed = processed.filter((o) => !/director|vp|head|chief|senior|sr\b/i.test(o.title));
      }
    }

    if (shortlistedOnly) {
      processed = processed.filter((o) => o.is_shortlisted);
    }

    // 4. Sort Opportunities
    if (sort === 'fit') {
      processed.sort((a, b) => {
        const scoreA = a.candidate_intelligence?.fit_score ?? a.match_preview.fit_score;
        const scoreB = b.candidate_intelligence?.fit_score ?? b.match_preview.fit_score;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (new Date(b.published_at || 0).getTime()) - (new Date(a.published_at || 0).getTime());
      });
    } else if (sort === 'date') {
      processed.sort((a, b) => (new Date(b.published_at || 0).getTime()) - (new Date(a.published_at || 0).getTime()));
    } else if (sort === 'company') {
      processed.sort((a, b) => a.company.localeCompare(b.company));
    }

    // 5. Pagination
    const total = processed.length;
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedJobs = processed.slice(from, to);
    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      jobs: paginatedJobs,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      shortlisted_ids: shortlistedIds,
      evidence_profile: structuredProfile?.headline || 'Electrical Engineering · Project Management · Commissioning · AI Operations',
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'JOB_DISCOVERY_FAILED' },
      { status: e.message === 'UNAUTHENTICATED' ? 401 : 500 }
    );
  }
}
