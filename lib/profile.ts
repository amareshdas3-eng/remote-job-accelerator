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
