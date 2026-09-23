import type { JobCategory, NormalizedJob } from './types.ts';
import { canonicalizeUrl, generateDeduplicationKey } from './dedup.ts';

const COMMON_SKILLS_DICTIONARY: Record<string, string[]> = {
  'Electrical Engineering': ['electrical', 'substation', 'switchgear', 'power system', 'high voltage', 'medium voltage', 'transformer', 'grid'],
  'Erection & Commissioning': ['erection', 'commissioning', 'testing & commissioning', 'fat/sat', 'energization', 'pre-commissioning'],
  'Project Management': ['project manager', 'project management', 'pmp', 'prince2', 'epc', 'schedule', 'budget', 'tendering'],
  'Plant & Industrial Systems': ['plant engineering', 'scada', 'plc', 'instrumentation', 'drives', 'automation', 'o&m'],
  'AI & Agentic Operations': ['ai', 'machine learning', 'llm', 'generative ai', 'prompt', 'agentic', 'python', 'analytics'],
  'Cloud & Distributed Systems': ['aws', 'gcp', 'azure', 'kubernetes', 'docker', 'terraform', 'cloud'],
  'Software Development': ['react', 'next.js', 'typescript', 'node.js', 'golang', 'rust', 'postgresql', 'apis'],
  'Safety & Compliance': ['osha', 'nfpa', 'ieee', 'iec', 'iso 9001', 'hse'],
};

export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

export function detectCategory(title: string, description: string): JobCategory {
  const text = `${title} ${description}`.toLowerCase();

  if (text.includes('electrical') || text.includes('substation') || text.includes('switchgear') || text.includes('power system') || text.includes('megapack')) {
    return 'electrical';
  }
  if (text.includes('project manager') || text.includes('technical project manager') || text.includes('pmp') || text.includes('project management')) {
    return 'project_management';
  }
  if (text.includes('ai ops') || text.includes('ai-assisted') || text.includes('agentic') || text.includes('machine learning') || text.includes('llm')) {
    return 'ai_operations';
  }
  if (text.includes('industrial') || text.includes('scada') || text.includes('plc') || text.includes('manufacturing') || text.includes('plant engineer')) {
    return 'industrial';
  }
  if (text.includes('software engineer') || text.includes('full stack') || text.includes('backend') || text.includes('frontend') || text.includes('developer')) {
    return 'software_engineering';
  }

  return 'general';
}

export function extractSkills(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const matchedSkills: string[] = [];

  for (const [skillName, keywords] of Object.entries(COMMON_SKILLS_DICTIONARY)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      matchedSkills.push(skillName);
    }
  }

  return matchedSkills.length > 0 ? matchedSkills : ['Technical Leadership', 'Remote Execution'];
}

export function normalizeRemoteStatus(locationStr = '', remoteStr = ''): string {
  const combined = `${locationStr} ${remoteStr}`.toLowerCase();
  if (combined.includes('global') || combined.includes('worldwide') || combined.includes('anywhere')) {
    return '100% Remote (Global)';
  }
  if (combined.includes('us') || combined.includes('united states') || combined.includes('americas')) {
    return '100% Remote (US)';
  }
  if (combined.includes('hybrid')) {
    return 'Hybrid Remote';
  }
  return '100% Remote';
}

export function normalizeJobRecord(raw: {
  native_id?: string | number;
  title: string;
  company: string;
  url: string;
  application_url?: string;
  description: string;
  salary?: string;
  location?: string;
  remote_status?: string;
  source: string;
  category?: JobCategory;
  skills?: string[];
  published_at?: string;
  company_website?: string;
  employment_type?: string;
}): NormalizedJob {
  const cleanTitle = raw.title.trim().slice(0, 200);
  const cleanCompany = raw.company.trim().slice(0, 200);
  const cleanDescription = stripHtml(raw.description || '').slice(0, 30000);
  const cleanUrl = canonicalizeUrl(raw.url);
  const cleanAppUrl = raw.application_url ? canonicalizeUrl(raw.application_url) : cleanUrl;

  const category = raw.category || detectCategory(cleanTitle, cleanDescription);
  const skills = raw.skills && raw.skills.length > 0 ? raw.skills : extractSkills(cleanTitle, cleanDescription);
  const remote_status = raw.remote_status || normalizeRemoteStatus(raw.location, cleanTitle);
  const location = raw.location?.trim() || remote_status;

  const external_id = generateDeduplicationKey(
    cleanCompany,
    cleanTitle,
    cleanUrl,
    raw.native_id,
    raw.source
  );

  let published_at = raw.published_at;
  if (!published_at || isNaN(Date.parse(published_at))) {
    published_at = new Date().toISOString();
  }

  return {
    external_id,
    title: cleanTitle,
    company: cleanCompany,
    url: cleanUrl,
    application_url: cleanAppUrl,
    description: cleanDescription,
    salary: raw.salary?.trim() || undefined,
    location,
    remote_status,
    source: raw.source.trim(),
    category,
    skills,
    published_at: new Date(published_at).toISOString(),
    company_website: raw.company_website?.trim() || undefined,
    employment_type: raw.employment_type?.trim() || 'Full-time Remote',
  };
}
