export type JobCategory =
  | 'electrical'
  | 'project_management'
  | 'ai_operations'
  | 'industrial'
  | 'software_engineering'
  | 'general';

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
  category: JobCategory;
  skills: string[];
  published_at: string;
  company_website?: string;
  employment_type?: string;
}

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
  fetchJobs(options?: { limit?: number; category?: string }): Promise<NormalizedJob[]>;
  fetchJobByUrl?(url: string): Promise<NormalizedJob | null>;
}
