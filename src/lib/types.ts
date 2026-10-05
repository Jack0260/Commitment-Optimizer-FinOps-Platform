export type Environment = 'production' | 'staging' | 'dev';

export type ResourceType =
  | 'compute'
  | 'storage'
  | 'database'
  | 'serverless'
  | 'network';

export type RecCategory =
  | 'idle_compute'
  | 'underutilized'
  | 'oversized'
  | 'unattached_storage'
  | 'storage_tier'
  | 'nonprod_scheduling'
  | 'commitment'
  | 'cost_anomaly'
  | 'untagged'
  | 'budget_risk';

export type RecStatus =
  | 'generated'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'deferred'
  | 'exception_requested'
  | 'scheduled'
  | 'implemented'
  | 'verified'
  | 'not_realized';

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type RiskLevel = 'low' | 'medium' | 'high';
export type ApprovalReq = 'auto' | 'manager' | 'architect';

export interface Team {
  id: string;
  name: string;
  owner: string;
  monthly_budget: number;
  cost_center: string;
  created_at: string;
}

export interface CloudResource {
  id: string;
  resource_name: string;
  resource_type: ResourceType;
  team_id: string;
  environment: Environment;
  region: string;
  provider: string;
  service: string;
  monthly_cost: number;
  tags: Record<string, string> | null;
  is_tagged: boolean;
  created_at: string;
}

export interface DailyUsage {
  id: string;
  resource_id: string;
  date: string;
  cost: number;
  cpu_utilization: number | null;
  memory_utilization: number | null;
  storage_gb: number | null;
  network_gb: number | null;
  running_hours: number | null;
  active: boolean;
}

export interface Budget {
  id: string;
  team_id: string;
  month: string;
  budget_amount: number;
  actual_spend: number;
  forecasted_spend: number;
}

export interface Recommendation {
  id: string;
  resource_id: string;
  team_id: string;
  category: RecCategory;
  title: string;
  description: string;
  current_monthly_cost: number;
  estimated_monthly_savings: number;
  confidence: ConfidenceLevel;
  risk_level: RiskLevel;
  required_downtime_hours: number;
  owner: string;
  approval_required: ApprovalReq;
  performance_impact: string;
  estimated_payback_days: number;
  status: RecStatus;
  assumptions: string | null;
  created_at: string;
  updated_at: string;
  implemented_at: string | null;
  measured_savings: number | null;
  measurement_start: string | null;
  measurement_end: string | null;
}

export interface AuditLog {
  id: string;
  recommendation_id: string;
  actor: string;
  action: string;
  old_status: RecStatus | null;
  new_status: RecStatus;
  notes: string | null;
  created_at: string;
}

export interface SavingsPlan {
  id: string;
  plan_name: string;
  provider: string;
  commitment_type: string;
  term_months: number;
  monthly_commitment: number;
  start_date: string;
  end_date: string;
  coverage_resources: number;
  discount_percent: number;
}
