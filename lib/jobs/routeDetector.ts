export type ApplicationRouteType =
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'ashby'
  | 'taleo'
  | 'icims'
  | 'email'
  | 'linkedin'
  | 'direct_portal'
  | 'external_aggregator';

export const SUPPORTED_PLATFORMS: ApplicationRouteType[] = [
  'greenhouse',
  'lever',
  'workday',
  'ashby',
  'taleo',
  'icims',
  'email',
  'linkedin',
  'direct_portal',
  'external_aggregator',
];

export type FrictionLevel = 'low' | 'medium' | 'high';

export interface RouteDetectionResult {
  route: ApplicationRouteType;
  platformName: string;
  friction: FrictionLevel;
  directApplyUrl: string;
  requiresAccount: boolean;
  supportsPlainTextResume: boolean;
  emailRecipient?: string;
  tacticalTips: string[];
  formTrapWarnings: string[];
}

/**
 * Extracts a verified application recipient email address from job URLs,
 * application URLs, or posting instructions.
 * Strictly adheres to the rule: Do not invent email addresses.
 * Only returns an email if an explicit application email address is detected.
 */
export function extractApplicationEmail(
  url?: string | null,
  applicationUrl?: string | null,
  description?: string | null
): string | undefined {
  const targetUrl = (applicationUrl || url || '').trim();
  const urlLower = targetUrl.toLowerCase();

  // 1. Direct mailto: URL extraction
  if (targetUrl.startsWith('mailto:')) {
    const raw = targetUrl.replace(/^mailto:/i, '').split('?')[0].trim();
    if (raw && raw.includes('@')) return raw;
  }
  if (urlLower.includes('mailto:')) {
    const match = urlLower.match(/mailto:([^?&]+)/);
    if (match && match[1]) {
      const email = match[1].trim();
      if (email && email.includes('@')) return email;
    }
  }

  // 2. Explicit application instructions in description text:
  // e.g. "Send CV to jobs@abc.com", "Apply via email: hr@company.com", "Email resume to...", "Submit application to..."
  const explicitInstruction = (description || '').match(
    /(?:send|email|submit|forward|apply|reach|contact|mail)\s+(?:your\s+)?(?:resume|cv|application|inquiries|profile)?\s*(?:via\s+email\s+)?(?:to|at|via|:)\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
  );
  if (explicitInstruction && explicitInstruction[1]) {
    return explicitInstruction[1].trim();
  }

  // 3. Explicit labels in description text:
  // e.g. "Apply via email: hr@company.com", "Recipient Email: ...", "Application Email: ..."
  const labelMatch = (description || '').match(
    /(?:apply\s+via\s+email|application\s+email|recipient\s+email|hiring\s+email|recruiter\s+email|to\s+apply,?\s+email|email\s+to\s+apply)\s*[:\-]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
  );
  if (labelMatch && labelMatch[1]) {
    return labelMatch[1].trim();
  }

  // 4. Fallback: If URL itself is a plain email address without http
  if (targetUrl.includes('@') && !targetUrl.startsWith('http')) {
    const directMatch = targetUrl.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (directMatch && directMatch[1]) {
      return directMatch[1].trim();
    }
  }

  return undefined;
}

/**
 * Deterministically analyzes job URLs and description text to detect
 * the ATS platform, friction level, and tactical submission requirements.
 */
export function detectApplicationRoute(
  url?: string | null,
  applicationUrl?: string | null,
  description?: string | null
): RouteDetectionResult {
  const targetUrl = (applicationUrl || url || '').trim();
  const urlLower = targetUrl.toLowerCase();
  const descLower = (description || '').toLowerCase();

  // 1. Email Extraction & Direct Email Route Detection
  const extractedEmail = extractApplicationEmail(url, applicationUrl, description);
  const isExplicitMailto = targetUrl.startsWith('mailto:') || urlLower.includes('mailto:');
  const isKnownPortal =
    urlLower.includes('greenhouse.io') ||
    urlLower.includes('boards.greenhouse') ||
    urlLower.includes('lever.co') ||
    urlLower.includes('jobs.lever') ||
    urlLower.includes('myworkdayjobs.com') ||
    urlLower.includes('ashbyhq.com') ||
    urlLower.includes('taleo.net') ||
    urlLower.includes('icims.com') ||
    urlLower.includes('linkedin.com/jobs');

  if (isExplicitMailto || (extractedEmail && !isKnownPortal)) {
    return {
      route: 'email',
      platformName: 'Direct Email Application',
      friction: 'low',
      directApplyUrl: extractedEmail ? `mailto:${extractedEmail}` : targetUrl,
      requiresAccount: false,
      supportsPlainTextResume: true,
      emailRecipient: extractedEmail,
      tacticalTips: [
        'Direct human inbox route. Highest recruiter conversion velocity.',
        'Use concise subject line with role title and candidate name.',
        'Attach tailored ATS-ready PDF and paste clean email pitch directly into body.'
      ],
      formTrapWarnings: [
        'Avoid sending multiple attachments; combine resume and cover letter or attach resume only.'
      ]
    };
  }

  // 2. Greenhouse ATS Detection
  if (urlLower.includes('greenhouse.io') || urlLower.includes('boards.greenhouse') || descLower.includes('powered by greenhouse')) {
    return {
      route: 'greenhouse',
      platformName: 'Greenhouse ATS',
      friction: 'low',
      directApplyUrl: targetUrl,
      requiresAccount: false,
      supportsPlainTextResume: true,
      tacticalTips: [
        'Single-page direct form submission with zero account creation required.',
        'Parses single-column ATS plain text with near 100% fidelity.',
        'Standard custom questions typically include LinkedIn profile, remote authorization, and notice period.'
      ],
      formTrapWarnings: [
        'Some Greenhouse boards have optional cover letter fields; always submit the tailored cover letter.',
        'Do not use tables or multi-column PDF layouts which can scramble Greenhouse text extraction.'
      ]
    };
  }

  // 3. Lever ATS Detection
  if (urlLower.includes('lever.co') || urlLower.includes('jobs.lever') || descLower.includes('lever.co')) {
    return {
      route: 'lever',
      platformName: 'Lever ATS',
      friction: 'low',
      directApplyUrl: targetUrl,
      requiresAccount: false,
      supportsPlainTextResume: true,
      tacticalTips: [
        'Streamlined 1-page application flow with immediate auto-fill.',
        'Supports direct plain text paste in addition to PDF/Word document upload.',
        'Excellent mobile and desktop parsing engine.'
      ],
      formTrapWarnings: [
        'Lever "Additional Information" box is the ideal location to paste your tailored executive summary.'
      ]
    };
  }

  // 4. Ashby ATS Detection
  if (urlLower.includes('ashbyhq.com') || urlLower.includes('jobs.ashby') || descLower.includes('ashbyhq')) {
    return {
      route: 'ashby',
      platformName: 'Ashby ATS',
      friction: 'low',
      directApplyUrl: targetUrl,
      requiresAccount: false,
      supportsPlainTextResume: true,
      tacticalTips: [
        'Modern high-performance ATS favored by elite high-growth startups.',
        'Strict character counting on long-form screening answers.',
        'Fast recruiter triage loop (usually screened within 48-72 hours).'
      ],
      formTrapWarnings: [
        'Keep custom response answers concise (< 1,500 characters) to avoid truncation.'
      ]
    };
  }

  // 5. Workday ATS Detection
  if (urlLower.includes('myworkdayjobs.com') || urlLower.includes('workday') || urlLower.includes('myworkday.com')) {
    return {
      route: 'workday',
      platformName: 'Workday HCM',
      friction: 'high',
      directApplyUrl: targetUrl,
      requiresAccount: true,
      supportsPlainTextResume: true,
      tacticalTips: [
        'High-friction multi-step portal requiring candidate login creation.',
        'Extremely sensitive ATS parser that frequently misreads multi-column documents.',
        'Always review every pre-filled field after document upload before clicking submit.'
      ],
      formTrapWarnings: [
        'Workday often splits work experience into separate form steps; use 1-Click Quick-Fill helper to verify bullet points.',
        'Ensure contact phone and email match exactly between login and uploaded document.'
      ]
    };
  }

  // 6. Taleo ATS Detection
  if (urlLower.includes('taleo.net') || urlLower.includes('oraclecloud.com') || descLower.includes('taleo')) {
    return {
      route: 'taleo',
      platformName: 'Oracle Taleo',
      friction: 'high',
      directApplyUrl: targetUrl,
      requiresAccount: true,
      supportsPlainTextResume: true,
      tacticalTips: [
        'Legacy enterprise ATS. Multi-page workflow with mandatory profile registration.',
        'Strict chronological ordering required.'
      ],
      formTrapWarnings: [
        'Do not use non-standard date formats (use standard Month Year format).'
      ]
    };
  }

  // 7. iCIMS ATS Detection
  if (urlLower.includes('icims.com') || urlLower.includes('jobs.icims')) {
    return {
      route: 'icims',
      platformName: 'iCIMS Talent Cloud',
      friction: 'medium',
      directApplyUrl: targetUrl,
      requiresAccount: true,
      supportsPlainTextResume: true,
      tacticalTips: [
        'Standard enterprise portal. Often provides both Social Profile apply and Resume upload.'
      ],
      formTrapWarnings: [
        'Ensure plain-text resume is ready in case document upload parser stalls.'
      ]
    };
  }

  // 8. LinkedIn Easy Apply / LinkedIn Direct
  if (urlLower.includes('linkedin.com/jobs')) {
    return {
      route: 'linkedin',
      platformName: 'LinkedIn Jobs Portal',
      friction: 'low',
      directApplyUrl: targetUrl,
      requiresAccount: true,
      supportsPlainTextResume: false,
      tacticalTips: [
        'May redirect to external ATS or support 1-Click Easy Apply.',
        'Ensure LinkedIn profile headline and experience match tailored ATS resume.'
      ],
      formTrapWarnings: [
        'Always check if LinkedIn job description contains a direct link to the employer portal; direct ATS submissions have higher conversion rates.'
      ]
    };
  }

  // 9. General Direct Employer Career Portal
  return {
    route: targetUrl ? 'direct_portal' : 'external_aggregator',
    platformName: targetUrl ? 'Direct Employer Portal' : 'Unspecified Portal',
    friction: 'medium',
    directApplyUrl: targetUrl || '',
    requiresAccount: false,
    supportsPlainTextResume: true,
    emailRecipient: extractedEmail || undefined,
    tacticalTips: [
      'Verified direct company career page.',
      'Use single-column ATS resume to ensure universal parser compatibility.',
      'Keep tailored cover letter ready for optional attachment.'
    ],
    formTrapWarnings: [
      'Verify company name and official URL match the job offer before submitting personal data.'
    ]
  };
}
