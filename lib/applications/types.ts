export interface JobRequirement {
  id: string;
  category: 'required' | 'preferred';
  statement: string;
  keywords: string[];
  domain?: string;
}

export interface RequirementMatch {
  requirement_id: string;
  statement: string;
  category: 'required' | 'preferred';
  status: 'verified' | 'partial' | 'unsupported';
  evidence_citation?: string;
  candidate_capability?: string;
}

export interface CandidateGapAnalysis {
  total_requirements: number;
  verified_count: number;
  partial_count: number;
  gap_count: number;
  readiness_score: number; // 0 - 100
  matches: RequirementMatch[];
  gaps: string[];
  strategic_positioning: string;
}

export interface TruthfulnessAudit {
  is_truthful: boolean;
  truth_score: number; // 0 - 100
  verified_claims: string[];
  unsupported_claims: string[];
  flags: string[];
}

export interface ApplicationPackage {
  id: string;
  job_id: string;
  application_id?: string;
  user_id: string;
  status: 'saved' | 'selected' | 'draft' | 'under_review' | 'approved' | 'ready_to_apply' | 'applied';
  route: string;
  company: string;
  role: string;
  job_url?: string;
  requirements: JobRequirement[];
  gap_analysis: CandidateGapAnalysis;
  tailored_resume?: any;
  cover_letter?: any;
  screening_answers?: any;
  truthfulness: TruthfulnessAudit;
  human_reviewed: boolean;
  human_approved_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
