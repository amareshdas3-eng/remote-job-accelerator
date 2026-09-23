// lib/growth.ts
// Growth Experimentation, Cohorts, and North-Star Metric Framework for RJA v4.3

export interface FunnelCounts {
  visitors: number;
  signups: number;
  activated: number;
  proInterest: number;
  checkoutStarted: number;
  paid: number;
}

export interface FunnelConversionRates {
  visitorToSignupRate: number;
  signupToActivationRate: number;
  activationToProInterestRate: number;
  proInterestToCheckoutRate: number;
  checkoutToPaidRate: number;
  visitorToPaidOverallRate: number;
}

export interface RetentionCohorts {
  day1: number;
  day7: number;
  day14: number;
  day30: number;
}

export interface CareerOutcomeFunnel {
  applications: number;
  responses: number;
  interviews: number;
  offers: number;
  hired: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  hireRate: number;
}

/**
 * Canonical application statuses that represent an application that has ACTUALLY been submitted.
 * Excludes draft/work-in-progress statuses (saved, selected, in_progress, ready_to_apply, withdrawn).
 */
export const SUBMITTED_APPLICATION_STATUSES = [
  'applied',
  'follow_up',
  'screening',
  'interview',
  'offer',
  'rejected',
  'closed',
] as const;

export type SubmittedApplicationStatus = typeof SUBMITTED_APPLICATION_STATUSES[number];

export function isSubmittedApplicationStatus(status: string): boolean {
  return SUBMITTED_APPLICATION_STATUSES.includes(status as any);
}

export interface UserActivityTimestamps {
  activatedAt: string; // ISO date
  lastActiveAt: string; // ISO date
}

/**
 * Calculates empirical cohort retention rates from actual user activation & activity records.
 */
export function calculateCohortRetention(users: UserActivityTimestamps[]): RetentionCohorts {
  if (!users.length) return { day1: 0, day7: 0, day14: 0, day30: 0 };

  let d1 = 0, d7 = 0, d14 = 0, d30 = 0;
  for (const u of users) {
    const act = new Date(u.activatedAt).getTime();
    const last = new Date(u.lastActiveAt).getTime();
    const diffDays = (last - act) / (1000 * 60 * 60 * 24);
    if (diffDays >= 1) d1++;
    if (diffDays >= 7) d7++;
    if (diffDays >= 14) d14++;
    if (diffDays >= 30) d30++;
  }

  const total = users.length;
  return {
    day1: Math.round((d1 / total) * 100),
    day7: Math.round((d7 / total) * 100),
    day14: Math.round((d14 / total) * 100),
    day30: Math.round((d30 / total) * 100),
  };
}

/**
 * Calculates the North-Star Metric:
 * "Qualified applications successfully submitted per active user per week"
 */
export function calculateNorthStarMetric(
  totalQualifiedApplications: number,
  activeUsers: number,
  weeksInPeriod: number = 1
): number {
  if (activeUsers <= 0 || weeksInPeriod <= 0) return 0;
  const raw = totalQualifiedApplications / (activeUsers * weeksInPeriod);
  return Math.round(raw * 10) / 10;
}

/**
 * Calculates conversion rates across each stage of the funnel.
 */
export function calculateFunnelRates(counts: FunnelCounts): FunnelConversionRates {
  const visitorToSignupRate = counts.visitors > 0 ? Math.round((counts.signups / counts.visitors) * 100) : 0;
  const signupToActivationRate = counts.signups > 0 ? Math.round((counts.activated / counts.signups) * 100) : 0;
  const activationToProInterestRate = counts.activated > 0 ? Math.round((counts.proInterest / counts.activated) * 100) : 0;
  const proInterestToCheckoutRate = counts.proInterest > 0 ? Math.round((counts.checkoutStarted / counts.proInterest) * 100) : 0;
  const checkoutToPaidRate = counts.checkoutStarted > 0 ? Math.round((counts.paid / counts.checkoutStarted) * 100) : 0;
  const visitorToPaidOverallRate = counts.visitors > 0 ? Math.round((counts.paid / counts.visitors) * 1000) / 10 : 0;

  return {
    visitorToSignupRate,
    signupToActivationRate,
    activationToProInterestRate,
    proInterestToCheckoutRate,
    checkoutToPaidRate,
    visitorToPaidOverallRate,
  };
}

/**
 * Calculates the full career outcome pipeline conversion.
 */
export function calculateCareerOutcomes(
  applications: number,
  responses: number,
  interviews: number,
  offers: number,
  hired: number
): CareerOutcomeFunnel {
  const responseRate = applications > 0 ? Math.round((responses / applications) * 100) : 0;
  const interviewRate = responses > 0 ? Math.round((interviews / responses) * 100) : (applications > 0 ? Math.round((interviews / applications) * 100) : 0);
  const offerRate = interviews > 0 ? Math.round((offers / interviews) * 100) : 0;
  const hireRate = offers > 0 ? Math.round((hired / offers) * 100) : 0;

  return {
    applications,
    responses,
    interviews,
    offers,
    hired,
    responseRate,
    interviewRate,
    offerRate,
    hireRate,
  };
}

/**
 * Standard industry benchmark comparison for candidate feedback.
 */
export const GROWTH_BENCHMARKS = {
  northStarTarget: 6.5, // 6-7 qualified tailored applications per active user per week
  activationTargetRate: 45, // 45% of signups complete their first tailored application
  industryManualAppsPerWeek: 2.5,
  industryManualPrepMins: 45,
  rjaAutomatedPrepMins: 6,
  industryColdInterviewRate: 3.2,
  rjaEvidenceInterviewRate: 18.5,
  retentionTargets: {
    day1: 65, // %
    day7: 42, // %
    day14: 34, // %
    day30: 28, // %
  },
};
