import type { StructuredProfileData } from '../profile.ts';

export interface ObjectionMitigation {
  hurdle: string;
  mitigation: string;
  evidence_anchor: string;
}

export interface CompensationGuidance {
  stated_range?: string;
  target_anchor: string;
  negotiation_angle: string;
}

export interface ApplicationStrategy {
  role_title: string;
  company: string;
  strategic_angle: string;
  positioning_hook: string;
  core_themes: string[];
  hurdles: ObjectionMitigation[];
  compensation_guidance: CompensationGuidance;
  recommended_route: string;
  elevator_pitch: string;
  generated_at: string;
}

/**
 * Deterministic baseline strategy generator used as an instantaneous foundation
 * and reliable fallback for the AI strategy formulation engine.
 */
export function buildDeterministicStrategy(
  job: {
    title: string;
    company: string;
    description?: string;
    salary?: string;
    location?: string;
  },
  profile?: Partial<StructuredProfileData> | null,
  rawResumeText?: string
): ApplicationStrategy {
  const role = job.title || 'Target Role';
  const company = job.company || 'Target Company';
  const targetRoles = profile?.target_roles || [];
  const primarySkills = profile?.technical_skills?.slice(0, 4) || ['System Architecture', 'Cloud Infrastructure', 'Team Leadership'];
  const yearsExp = profile?.years_experience || 10;
  const isSenior = role.toLowerCase().includes('senior') || role.toLowerCase().includes('lead') || role.toLowerCase().includes('director') || role.toLowerCase().includes('principal');

  const strategicAngle = `Position as a seasoned ${isSenior ? 'executive' : 'senior'} practitioner who combines deep hands-on mastery in ${primarySkills.slice(0, 2).join(' and ')} with proven capability to deliver high-reliability outcomes in distributed remote environments.`;

  const positioningHook = `An accomplished technical leader with ${yearsExp}+ years of verified execution, specialized in delivering robust ${primarySkills[0] || 'engineering'} solutions that accelerate ${company}'s operational velocity without sacrificing architectural integrity.`;

  const coreThemes = [
    `Verifiable technical depth in ${primarySkills.join(', ')} directly addressing ${company}'s requirements.`,
    `Autonomous remote delivery with disciplined asynchronous communication and engineering rigor.`,
    `Cross-functional collaboration aligning business objectives with high-velocity software delivery.`
  ];

  const hurdles: ObjectionMitigation[] = [
    {
      hurdle: isSenior ? 'Potential concern regarding senior title fit or hands-on willingness.' : 'Verification of breadth across modern distributed tooling.',
      mitigation: `Emphasize enthusiasm for direct, high-impact contributions and architectural leadership. Reassure hiring managers of pragmatic, builder-first focus.`,
      evidence_anchor: `${yearsExp}+ years of continuous engineering and leadership deliverables.`
    },
    {
      hurdle: 'High applicant volume across remote job listings.',
      mitigation: 'Bypass generic application queues by pairing the ATS submission with an executive LinkedIn connection note to the talent lead.',
      evidence_anchor: 'Targeted single-column ATS resume tailored to exact job specifications.'
    },
    {
      hurdle: 'Asynchronous communication and distributed remote velocity concerns.',
      mitigation: 'Demonstrate documented history of self-directed execution, clear written documentation, and transparent sprint reporting.',
      evidence_anchor: 'Proven track record of high-autonomy delivery across distributed time zones.'
    }
  ];

  const statedSalary = job.salary || (isSenior ? '$150,000 – $190,000 USD' : '$120,000 – $160,000 USD');
  const compensationGuidance: CompensationGuidance = {
    stated_range: job.salary,
    target_anchor: statedSalary,
    negotiation_angle: `Anchor at the upper third of the range (${statedSalary}) based on immediate operational readiness and verified capability.`
  };

  const recommendedRoute = `Dual-track strategy: Submit 100% ATS-tailored application through the official company portal, immediately followed by a personalized LinkedIn connection note to the recruiting lead.`;

  const elevatorPitch = `I bring ${yearsExp}+ years of specialized experience in ${primarySkills.slice(0, 2).join(' and ')}. I've driven mission-critical deliverables across distributed teams, and I'm excited by ${company}'s vision. I'm ready to drive immediate value for this ${role} position.`;

  return {
    role_title: role,
    company,
    strategic_angle: strategicAngle,
    positioning_hook: positioningHook,
    core_themes: coreThemes,
    hurdles,
    compensation_guidance: compensationGuidance,
    recommended_route: recommendedRoute,
    elevator_pitch: elevatorPitch,
    generated_at: new Date().toISOString()
  };
}
