import { z } from 'zod';

export const RemotePreferencesSchema = z.object({
  remote_only: z.boolean().optional().default(true),
  timezones: z.array(z.string().max(100)).max(20).optional().default([]),
  preferred_contract: z.string().max(200).optional().default(''),
  target_compensation: z.string().max(200).optional().default(''),
});

export const EmployerSchema = z.object({
  company: z.string().max(200),
  role: z.string().max(200),
  period: z.string().max(100),
  location: z.string().max(200).optional().default(''),
  key_achievement: z.string().max(2000).optional().default(''),
});

export const EducationSchema = z.object({
  degree: z.string().max(300),
  institution: z.string().max(300),
  year: z.string().max(100).optional().default(''),
});

export const StructuredProfileSchema = z.object({
  full_name: z.string().max(200).optional().default(''),
  headline: z.string().max(400).optional().default(''),
  years_experience: z.union([z.number(), z.string().max(50)]).optional().default(''),
  professional_summary: z.string().max(10000).optional().default(''),
  target_roles: z.array(z.string().max(200)).max(50).optional().default([]),
  target_industries: z.array(z.string().max(200)).max(50).optional().default([]),
  remote_preferences: RemotePreferencesSchema.optional().default({
    remote_only: true,
    timezones: [],
    preferred_contract: '',
    target_compensation: '',
  }),
  technical_domains: z.array(z.string().max(200)).max(50).optional().default([]),
  technical_skills: z.array(z.string().max(200)).max(100).optional().default([]),
  pm_leadership_skills: z.array(z.string().max(200)).max(100).optional().default([]),
  ai_capabilities: z.array(z.string().max(200)).max(50).optional().default([]),
  employers: z.array(EmployerSchema).max(50).optional().default([]),
  education: z.array(EducationSchema).max(30).optional().default([]),
  certifications: z.array(z.string().max(200)).max(50).optional().default([]),
  raw_evidence: z.string().max(50000).optional().default(''),
});

export type StructuredProfileData = z.infer<typeof StructuredProfileSchema>;

export const MAX_PROFILE_PAYLOAD_BYTES = 500 * 1024; // 500 KB

export function validateStructuredProfile(input: unknown): {
  success: boolean;
  data?: StructuredProfileData;
  error?: string;
} {
  if (!input || typeof input !== 'object') {
    return { success: false, error: 'Structured profile must be a non-null JSON object.' };
  }

  // Payload size check
  try {
    const serialized = JSON.stringify(input);
    if (serialized.length > MAX_PROFILE_PAYLOAD_BYTES) {
      return { success: false, error: `Payload exceeds maximum limit of ${MAX_PROFILE_PAYLOAD_BYTES / 1024} KB.` };
    }
  } catch {
    return { success: false, error: 'Payload must be valid JSON serializable.' };
  }

  const result = StructuredProfileSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.join('.') || 'root';
    return {
      success: false,
      error: `Validation error at ${path}: ${issue.message}`,
    };
  }

  return { success: true, data: result.data };
}

export function formatStructuredProfileText(profile: StructuredProfileData): string {
  const lines: string[] = [];

  if (profile.full_name) lines.push(`NAME: ${profile.full_name}`);
  if (profile.headline) lines.push(`HEADLINE: ${profile.headline}`);
  if (profile.years_experience) lines.push(`YEARS OF EXPERIENCE: ${profile.years_experience}`);

  if (profile.professional_summary) {
    lines.push('');
    lines.push('PROFESSIONAL SUMMARY:');
    lines.push(profile.professional_summary);
  }

  if (profile.target_roles && profile.target_roles.length > 0) {
    lines.push('');
    lines.push('TARGET ROLES:');
    profile.target_roles.forEach((r) => lines.push(`• ${r}`));
  }

  if (profile.target_industries && profile.target_industries.length > 0) {
    lines.push('');
    lines.push('TARGET INDUSTRIES:');
    lines.push(profile.target_industries.join(', '));
  }

  if (profile.remote_preferences) {
    lines.push('');
    lines.push('REMOTE PREFERENCES:');
    lines.push(`• Remote Only: ${profile.remote_preferences.remote_only ? 'Yes (100% Remote)' : 'Flexible'}`);
    if (profile.remote_preferences.timezones && profile.remote_preferences.timezones.length > 0) {
      lines.push(`• Preferred Timezones: ${profile.remote_preferences.timezones.join(', ')}`);
    }
    if (profile.remote_preferences.preferred_contract) {
      lines.push(`• Contract: ${profile.remote_preferences.preferred_contract}`);
    }
    if (profile.remote_preferences.target_compensation) {
      lines.push(`• Target Compensation: ${profile.remote_preferences.target_compensation}`);
    }
  }

  if (profile.technical_domains && profile.technical_domains.length > 0) {
    lines.push('');
    lines.push('CORE TECHNICAL DOMAINS:');
    profile.technical_domains.forEach((d) => lines.push(`• ${d}`));
  }

  if (profile.technical_skills && profile.technical_skills.length > 0) {
    lines.push('');
    lines.push('TECHNICAL SKILLS:');
    lines.push(profile.technical_skills.join(', '));
  }

  if (profile.pm_leadership_skills && profile.pm_leadership_skills.length > 0) {
    lines.push('');
    lines.push('PROJECT MANAGEMENT & LEADERSHIP:');
    lines.push(profile.pm_leadership_skills.join(', '));
  }

  if (profile.ai_capabilities && profile.ai_capabilities.length > 0) {
    lines.push('');
    lines.push('AI & AUTOMATION CAPABILITIES:');
    lines.push(profile.ai_capabilities.join(', '));
  }

  if (profile.employers && profile.employers.length > 0) {
    lines.push('');
    lines.push('EMPLOYMENT & SELECTED ACHIEVEMENTS:');
    profile.employers.forEach((e) => {
      lines.push(`• ${e.role} | ${e.company} (${e.period})${e.location ? ` - ${e.location}` : ''}: ${e.key_achievement || ''}`);
    });
  }

  if (profile.education && profile.education.length > 0) {
    lines.push('');
    lines.push('EDUCATION & CREDENTIALS:');
    profile.education.forEach((edu) => {
      lines.push(`• ${edu.degree} — ${edu.institution}${edu.year ? ` (${edu.year})` : ''}`);
    });
  }

  if (profile.certifications && profile.certifications.length > 0) {
    profile.certifications.forEach((c) => lines.push(`• Certification: ${c}`));
  }

  if (profile.raw_evidence) {
    lines.push('');
    lines.push('RAW EVIDENCE EXCERPT:');
    lines.push(profile.raw_evidence.slice(0, 10000));
  }

  return lines.join('\n');
}

const STRUCTURED_ENVELOPE_TAG = '<!-- RJA_STRUCTURED_PROFILE_V1:';
const STRUCTURED_ENVELOPE_END = ':END_RJA_STRUCTURED_PROFILE -->';

export function embedStructuredProfileInText(text: string, profile: StructuredProfileData): string {
  const clean = text.replace(new RegExp(`${STRUCTURED_ENVELOPE_TAG}[\\s\\S]*?${STRUCTURED_ENVELOPE_END}`, 'g'), '').trim();
  const serialized = Buffer.from(JSON.stringify(profile)).toString('base64');
  return `${clean}\n\n${STRUCTURED_ENVELOPE_TAG}${serialized}${STRUCTURED_ENVELOPE_END}`;
}

export function extractEmbeddedStructuredProfile(text: string): StructuredProfileData | null {
  if (!text) return null;
  const match = text.match(new RegExp(`${STRUCTURED_ENVELOPE_TAG}([A-Za-z0-9+/=]+)${STRUCTURED_ENVELOPE_END}`));
  if (!match || !match[1]) return null;
  try {
    const jsonStr = Buffer.from(match[1], 'base64').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    const validated = validateStructuredProfile(parsed);
    return validated.success ? validated.data || null : null;
  } catch {
    return null;
  }
}

/**
 * Deterministically extracts a validated StructuredProfileData from raw resume text
 * (DOCX, PDF, or TXT) when an explicit structured profile JSON is not pre-supplied.
 */
export function extractStructuredProfileFromText(text: string): StructuredProfileData {
  if (!text) {
    return {
      full_name: '',
      headline: '',
      years_experience: 10,
      professional_summary: '',
      target_roles: [],
      target_industries: [],
      remote_preferences: {
        remote_only: true,
        timezones: [],
        preferred_contract: 'Full-time / Contract',
        target_compensation: '',
      },
      technical_domains: [],
      technical_skills: [],
      pm_leadership_skills: [],
      ai_capabilities: [],
      employers: [],
      education: [],
      certifications: [],
      raw_evidence: '',
    };
  }

  // Check if an embedded structured profile envelope is present first
  const existing = extractEmbeddedStructuredProfile(text);
  if (existing) return existing;

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] || '';
  const secondLine = lines[1] || '';

  let full_name = '';
  if (firstLine.length < 50 && !firstLine.includes('@') && !firstLine.includes('http') && !/resume|curriculum vitae|cv\b/i.test(firstLine)) {
    full_name = firstLine;
  }

  let headline = '';
  if (secondLine.length < 150 && !secondLine.includes('@') && !secondLine.includes('http')) {
    headline = secondLine;
  }

  // Extract years of experience
  let years_experience: number | string = 10;
  const expMatch = text.match(/(\d{1,2})\+?\s*(?:years|yrs)\b/i);
  if (expMatch && expMatch[1]) {
    years_experience = parseInt(expMatch[1], 10);
  }

  const textLower = text.toLowerCase();

  // Technical skills dictionary
  const TECH_SKILLS = [
    'Next.js', 'React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Go', 'Golang',
    'PostgreSQL', 'SQL', 'GraphQL', 'REST APIs', 'Supabase', 'Docker', 'Kubernetes',
    'AWS', 'GCP', 'Azure', 'Terraform', 'CI/CD', 'GitHub Actions', 'Microservices',
    'Electrical Engineering', 'Substation', 'Switchgear', 'Power Systems', 'High Voltage',
    'Medium Voltage', 'SCADA', 'PLC', 'Industrial Automation', 'Commissioning', 'Erection',
    'Testing & Commissioning', 'Plant Engineering', 'Instrumentation', 'Protection Relays',
    'Single-Line Diagrams', 'Megapack', 'Microgrid', 'FAT/SAT'
  ];

  const technical_skills: string[] = [];
  for (const s of TECH_SKILLS) {
    if (textLower.includes(s.toLowerCase())) {
      technical_skills.push(s);
    }
  }

  // PM & Leadership skills dictionary
  const PM_SKILLS = [
    'Project Management', 'Agile', 'Scrum', 'Stakeholder Management', 'Tendering',
    'EPC', 'Budget Management', 'Schedule Optimization', 'Contract Negotiation',
    'Vendor Management', 'Technical Governance', 'Site Management', 'Risk Management',
    'Quality Assurance', 'O&M'
  ];

  const pm_leadership_skills: string[] = [];
  for (const pm of PM_SKILLS) {
    if (textLower.includes(pm.toLowerCase())) {
      pm_leadership_skills.push(pm);
    }
  }

  // AI & Automation dictionary
  const AI_SKILLS = [
    'AI Workflows', 'Agentic AI', 'LLM Integration', 'Generative AI', 'Prompt Engineering',
    'Machine Learning', 'Data Pipelines', 'Automation'
  ];

  const ai_capabilities: string[] = [];
  for (const ai of AI_SKILLS) {
    if (textLower.includes(ai.toLowerCase())) {
      ai_capabilities.push(ai);
    }
  }

  // Certifications
  const CERTS = ['PMP', 'Prince2', 'PE License', 'Professional Engineer', 'AWS Certified', 'Scrum Master', 'OSHA 30', 'NFPA 70E'];
  const certifications: string[] = [];
  for (const c of CERTS) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(text)) {
      certifications.push(c);
    }
  }

  // Target roles
  const target_roles: string[] = [];
  if (textLower.includes('electrical') && textLower.includes('project manager')) {
    target_roles.push('Senior Electrical Project Manager');
  }
  if (textLower.includes('full stack') || (textLower.includes('software engineer') && textLower.includes('senior'))) {
    target_roles.push('Senior Full-Stack Engineer');
  }
  if (textLower.includes('project manager') && !target_roles.includes('Senior Electrical Project Manager')) {
    target_roles.push('Technical Project Manager');
  }
  if (textLower.includes('commissioning') || textLower.includes('plant engineer')) {
    target_roles.push('Commissioning & Plant Engineering Lead');
  }
  if (textLower.includes('ai') && textLower.includes('operations')) {
    target_roles.push('AI Operations Project Manager');
  }

  if (target_roles.length === 0) {
    target_roles.push(headline || 'Senior Technical Lead');
  }

  // Summary
  let professional_summary = '';
  const summaryMatch = text.match(/(?:summary|professional summary|about me|profile)[:\s]*([\s\S]{50,800}?)(?:\n\s*\n[A-Z]{3,}|\n\s*experience|\n\s*skills|\n\s*education|$)/i);
  if (summaryMatch && summaryMatch[1]) {
    professional_summary = summaryMatch[1].trim();
  } else {
    professional_summary = lines.slice(0, 4).join(' ').slice(0, 500);
  }

  return {
    full_name: full_name.slice(0, 200),
    headline: (headline || target_roles[0] || 'Senior Engineering Leader').slice(0, 400),
    years_experience,
    professional_summary,
    target_roles,
    target_industries: ['Energy & Infrastructure', 'Software & Cloud SaaS', 'Industrial Automation'],
    remote_preferences: {
      remote_only: true,
      timezones: ['US Eastern', 'US Pacific', 'UTC / Global'],
      preferred_contract: 'Full-time Remote',
      target_compensation: '$140,000 – $190,000 / yr',
    },
    technical_domains: technical_skills.slice(0, 5),
    technical_skills: technical_skills.slice(0, 30),
    pm_leadership_skills: pm_leadership_skills.slice(0, 20),
    ai_capabilities: ai_capabilities.slice(0, 10),
    employers: [],
    education: [],
    certifications,
    raw_evidence: text.slice(0, 25000),
  };
}
