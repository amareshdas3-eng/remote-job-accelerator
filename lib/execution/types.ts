import type { StructuredProfileData } from '../profile';

export interface EvidenceSnapshot {
  id: string;
  candidate_id: string;
  profile_data: StructuredProfileData;
  evidence_hash: string;
  captured_at: string;
}

export interface ArtifactFingerprint {
  hash: string;
  algorithm: 'sha256';
  components: {
    resume_length: number;
    cover_letter_length: number;
    answers_count: number;
  };
  computed_at: string;
}

export interface ApprovedArtifact {
  id: string;
  application_id: string;
  fingerprint: ArtifactFingerprint;
  approved_by: string;
  approved_at: string;
  content: {
    resume: any;
    cover_letter: any;
    screening_answers: any;
  };
}

export interface ExecutionAttempt {
  id: string;
  application_id: string;
  approved_artifact_id: string;
  verified_fingerprint: string;
  route: string;
  destination: string;
  status: 'dispatched' | 'confirmed' | 'failed' | 'blocked';
  error?: string;
  dispatched_at: string;
}

export interface SubmissionReceipt {
  id: string;
  execution_attempt_id: string;
  application_id: string;
  destination: string;
  external_confirmation_id?: string;
  verified_fingerprint: string;
  received_at: string;
  timestamp: string;
}

export type OutcomeEventType =
  | 'applied'
  | 'acknowledged'
  | 'viewed'
  | 'recruiter_response'
  | 'screening'
  | 'interview'
  | 'technical_round'
  | 'final_round'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface OutcomeEvent {
  id: string;
  application_id: string;
  user_id: string;
  type: OutcomeEventType;
  stage: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface CareerRoiMetrics {
  total_applications: number;
  responses_count: number;
  interviews_count: number;
  offers_count: number;
  application_to_response_rate: number; // 0 - 100 %
  interview_to_offer_rate: number;      // 0 - 100 %
  application_to_offer_rate: number;     // 0 - 100 %
  avg_time_to_response_days?: number;
  avg_time_to_offer_days?: number;
}
