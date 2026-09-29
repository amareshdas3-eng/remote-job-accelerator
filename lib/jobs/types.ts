export type JobCategory =
  | 'electrical'
  | 'project_management'
  | 'ai_operations'
  | 'industrial'
  | 'software_engineering'
  | 'general';

export type JobSourceTier =
  | 'tier1_direct_ats'
  | 'tier1_company_jsonld'
  | 'tier2_job_board'
  | 'tier3_aggregator';

export type JobSourceHealth =
  | 'healthy'
  | 'degraded'
  | 'rate_limited'
  | 'offline'
  | 'quarantined';

export type TimestampEvidenceType =
  | 'first_published'
  | 'date_posted'
  | 'created_at'
  | 'epoch_declared'
  | 'none';

export interface JobSourceRecord {
  id: string;
  source_type: JobSourceTier;
  provider: string; // 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'jsonld' | 'remoteok'
  company_name: string;
  canonical_domain: string;
  endpoint_url: string;
  country_code: string;
  target_region: string;
  rate_limit_per_minute: number;
  concurrency_limit: number;
  supports_posted_at: boolean;
  timestamp_evidence: TimestampEvidenceType;
  two_phase: boolean;
  supports_remote_filter: boolean;
  supports_salary: boolean;
  health_status: JobSourceHealth;
  failure_count: number;
  circuit_breaker_tripped_at?: string;
  last_discovery_at?: string;
  last_success_at?: string;
  average_latency_ms: number;
  total_jobs_discovered: number;
  total_fresh_jobs: number;
  created_at: string;
  updated_at: string;
}

export interface JobObservation {
  source_id: string;
  source_name: string;
  source_tier: JobSourceTier;
  observed_url: string;
  declared_posted_at?: string;
  detected_at: string;
}

export interface CanonicalJobCluster {
  canonical_id: string;
  company: string;
  normalized_title: string;
  requisition_id?: string;
  earliest_posted_at?: string;
  canonical_url: string;
  primary_source: string;
  primary_tier: JobSourceTier;
  observations: JobObservation[];
  observation_badges: string[];
}

export interface DiscoveryLatencyMetric {
  jobId?: string;
  sourcePostedAtIso: string;
  rjaDetectedAtIso: string;
  discoveryLatencyMs: number;
  discoveryLatencyMinutes: number;
  discoveryLatencyText: string;
  isTrustworthy: boolean;
}

export interface GlobalCoverageMetrics {
  total_sources_registered: number;
  healthy_sources: number;
  degraded_sources: number;
  tier1_sources: number;
  tier2_sources: number;
  tier3_sources: number;
  countries_covered: string[];
  total_jobs_in_catalog: number;
  live_fresh_jobs: number;
  timestamp_evidence_fidelity_rate: number; // percentage carrying authentic LIVE_FRESH timestamps
  average_discovery_latency_minutes: number;
}

export interface NormalizedJob {
  external_id: string;
  title: string;
  company: string;
  url: string;
  application_url?: string;
  description: string;
  salary?: string;
  location: string;
  remote_status: string;
  source: string;
  source_id?: string;
  source_tier?: JobSourceTier;
  requisition_id?: string;
  category: JobCategory;
  skills: string[];
  published_at?: string;
  posted_at?: string;
  company_website?: string;
  employment_type?: string;
  detected_at?: string;
  discovery_latency_ms?: number;
  discovery_latency_text?: string;
  observation_badges?: string[];
  observations?: JobObservation[];
  is_clustered?: boolean;
}

export type { FreshnessWindow, JobFreshnessClassification, JobFreshnessEvaluation } from './freshness.ts';

export interface IngestionResult {
  source: string;
  total_fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface JobSourceAdapter {
  name: string;
  fetchJobs(options?: { limit?: number; category?: string; companyKey?: string; board?: string; organization?: string; account?: string }): Promise<NormalizedJob[]>;
  fetchJobByUrl?(url: string): Promise<NormalizedJob | null>;
}
