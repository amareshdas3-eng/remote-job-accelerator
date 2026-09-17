import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';

export interface RemoteJobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  remote_status: string;
  salary_range: string;
  source: string;
  url: string;
  category: 'electrical' | 'project_management' | 'ai_operations' | 'industrial';
  match_preview: {
    fit_score: number;
    aligned_skills: string[];
    role_focus: string;
  };
  key_requirements: string[];
  description: string;
}

// Curated high-conviction remote roles aligned with electrical engineering, project management, commissioning, and AI operations
const CURATED_REMOTE_JOBS: RemoteJobOpportunity[] = [
  {
    id: 'disc-schneider-elec-pm',
    title: 'Remote Senior Electrical Project Manager',
    company: 'Schneider Electric Global',
    location: '100% Remote (US / Global)',
    remote_status: '100% Remote',
    salary_range: '$145,000 – $180,000 / yr',
    source: 'Schneider Electric Careers',
    url: 'https://www.se.com/us/en/about-us/careers/',
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
    title: 'Remote Engineering Project Manager — Industrial & Energy Infrastructure',
    company: 'Siemens Energy',
    location: '100% Remote (US / Global Remote)',
    remote_status: '100% Remote',
    salary_range: '$150,000 – $185,000 / yr',
    source: 'Siemens Energy Portal',
    url: 'https://www.siemens-energy.com/global/en/company/jobs.html',
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
    title: 'Remote Technical Project Manager — Power Systems & Automation',
    company: 'ABB Global Systems',
    location: '100% Remote (Remote US / Americas)',
    remote_status: '100% Remote',
    salary_range: '$140,000 – $175,000 / yr',
    source: 'ABB Careers',
    url: 'https://careers.abb/global/en',
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
    title: 'Remote Project Manager — AI-Assisted Operations & Engineering Systems',
    company: 'Grid Dynamics Energy',
    location: '100% Remote (Global)',
    remote_status: '100% Remote',
    salary_range: '$155,000 – $190,000 / yr',
    source: 'Grid Dynamics Jobs',
    url: 'https://www.griddynamics.com/careers',
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
    title: 'Remote Industrial Project Manager — Megapack & Microgrid Systems',
    company: 'Tesla Energy Infrastructure',
    location: '100% Remote (US)',
    remote_status: '100% Remote',
    salary_range: '$148,000 – $182,000 / yr',
    source: 'Tesla Careers',
    url: 'https://www.tesla.com/careers',
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
    title: 'Remote Senior Technical Consultant — Electrical Systems & Tendering',
    company: 'Black & Veatch Engineering',
    location: '100% Remote (US / Global Remote)',
    remote_status: '100% Remote',
    salary_range: '$152,000 – $188,000 / yr',
    source: 'Black & Veatch Careers',
    url: 'https://www.bv.com/careers',
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
  }
];

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim().toLowerCase();
    const category = searchParams.get('category') || 'all';

    // Filter by query and category
    let jobs = CURATED_REMOTE_JOBS;
    if (category !== 'all') {
      jobs = jobs.filter((j) => j.category === category);
    }
    if (query) {
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(query) ||
          j.company.toLowerCase().includes(query) ||
          j.key_requirements.some((k) => k.toLowerCase().includes(query)) ||
          j.match_preview.aligned_skills.some((s) => s.toLowerCase().includes(query))
      );
    }

    return NextResponse.json({
      jobs,
      total: jobs.length,
      evidence_profile: 'Electrical Engineering · Project Management · Commissioning · AI Operations',
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'JOB_DISCOVERY_FAILED' },
      { status: e.message === 'UNAUTHENTICATED' ? 401 : 500 }
    );
  }
}
