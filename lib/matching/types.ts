export type MatchTier = 'exceptional' | 'strong' | 'moderate' | 'exploratory';

export interface MatchDimensions {
  role_alignment: number;      // 0 - 25 pts
  technical_skills: number;    // 0 - 35 pts
  leadership: number;          // 0 - 20 pts
  seniority_remote: number;    // 0 - 20 pts
}

export interface CandidateMatchResult {
  fit_score: number;           // 0 - 100
  tier: MatchTier;
  dimensions: MatchDimensions;
  matched_skills: string[];
  missing_skills: string[];
  why_matched: string[];
  strategic_advice: string;
}

export interface MatchFilterOptions {
  category?: string;
  query?: string;
  remote_only?: boolean;
  min_fit?: number;
  sort?: 'fit' | 'date' | 'company';
  seniority?: 'all' | 'executive' | 'senior' | 'mid';
  shortlisted_only?: boolean;
}
