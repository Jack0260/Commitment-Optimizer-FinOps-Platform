/*
# Commitment Optimizer - Core Schema

Creates the foundational tables for the FinOps platform: teams, cloud resources,
daily usage/cost data, budgets, recommendations, audit logs, and savings plans.

1. New Tables
- `teams`: 6 cloud teams with owners, monthly budgets, cost centers
- `cloud_resources`: 50 cloud resources (compute, storage, database, serverless, network)
  with team assignment, environment, region, provider, service, monthly cost, tags
- `daily_usage`: 90 days of daily cost + utilization metrics per resource
  (CPU, memory, storage, network, running hours, active flag)
- `budgets`: Monthly budget vs. actual vs. forecasted spend per team
- `recommendations`: Cost optimization recommendations with all calculated fields
  (category, savings, confidence, risk, downtime, owner, approval, performance impact, payback)
  and governance workflow status
- `audit_logs`: Audit trail for every recommendation state change
- `savings_plans`: Existing reserved capacity / savings plan commitments

2. Security
- RLS enabled on all tables
- Single-tenant demo app (no sign-in): all policies use TO anon, authenticated with USING(true)
  because the data is intentionally shared/public

3. Important Notes
- All IDs are UUID with gen_random_uuid() defaults
- Timestamps default to now()
- Recommendation status defaults to 'generated'
- Foreign keys enforce referential integrity
*/

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner text NOT NULL,
  monthly_budget numeric NOT NULL,
  cost_center text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cloud_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_name text NOT NULL,
  resource_type text NOT NULL DEFAULT 'compute',
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'production',
  region text NOT NULL,
  provider text NOT NULL DEFAULT 'AWS',
  service text NOT NULL,
  monthly_cost numeric NOT NULL DEFAULT 0,
  tags jsonb DEFAULT '{}',
  is_tagged boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES cloud_resources(id) ON DELETE CASCADE,
  date date NOT NULL,
  cost numeric NOT NULL DEFAULT 0,
  cpu_utilization numeric,
  memory_utilization numeric,
  storage_gb numeric,
  network_gb numeric,
  running_hours numeric,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  month text NOT NULL,
  budget_amount numeric NOT NULL,
  actual_spend numeric NOT NULL DEFAULT 0,
  forecasted_spend numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES cloud_resources(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  current_monthly_cost numeric NOT NULL DEFAULT 0,
  estimated_monthly_savings numeric NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'medium',
  risk_level text NOT NULL DEFAULT 'medium',
  required_downtime_hours numeric NOT NULL DEFAULT 0,
  owner text NOT NULL,
  approval_required text NOT NULL DEFAULT 'manager',
  performance_impact text NOT NULL DEFAULT '',
  estimated_payback_days numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'generated',
  assumptions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  implemented_at timestamptz,
  measured_savings numeric,
  measurement_start timestamptz,
  measurement_end timestamptz
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  actor text NOT NULL,
  action text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS savings_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name text NOT NULL,
  provider text NOT NULL,
  commitment_type text NOT NULL,
  term_months integer NOT NULL,
  monthly_commitment numeric NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  coverage_resources integer NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_usage_resource_date ON daily_usage(resource_id, date);
CREATE INDEX IF NOT EXISTS idx_recommendations_team ON recommendations(team_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_category ON recommendations(category);
CREATE INDEX IF NOT EXISTS idx_cloud_resources_team ON cloud_resources(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_rec ON audit_logs(recommendation_id);

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_plans ENABLE ROW LEVEL SECURITY;

-- Teams policies (single-tenant, public data)
DROP POLICY IF EXISTS "teams_select" ON teams;
CREATE POLICY "teams_select" ON teams FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "teams_insert" ON teams;
CREATE POLICY "teams_insert" ON teams FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "teams_update" ON teams;
CREATE POLICY "teams_update" ON teams FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "teams_delete" ON teams;
CREATE POLICY "teams_delete" ON teams FOR DELETE TO anon, authenticated USING (true);

-- Cloud resources policies
DROP POLICY IF EXISTS "resources_select" ON cloud_resources;
CREATE POLICY "resources_select" ON cloud_resources FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "resources_insert" ON cloud_resources;
CREATE POLICY "resources_insert" ON cloud_resources FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "resources_update" ON cloud_resources;
CREATE POLICY "resources_update" ON cloud_resources FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "resources_delete" ON cloud_resources;
CREATE POLICY "resources_delete" ON cloud_resources FOR DELETE TO anon, authenticated USING (true);

-- Daily usage policies
DROP POLICY IF EXISTS "usage_select" ON daily_usage;
CREATE POLICY "usage_select" ON daily_usage FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "usage_insert" ON daily_usage;
CREATE POLICY "usage_insert" ON daily_usage FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "usage_update" ON daily_usage;
CREATE POLICY "usage_update" ON daily_usage FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "usage_delete" ON daily_usage;
CREATE POLICY "usage_delete" ON daily_usage FOR DELETE TO anon, authenticated USING (true);

-- Budgets policies
DROP POLICY IF EXISTS "budgets_select" ON budgets;
CREATE POLICY "budgets_select" ON budgets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "budgets_insert" ON budgets;
CREATE POLICY "budgets_insert" ON budgets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "budgets_update" ON budgets;
CREATE POLICY "budgets_update" ON budgets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "budgets_delete" ON budgets;
CREATE POLICY "budgets_delete" ON budgets FOR DELETE TO anon, authenticated USING (true);

-- Recommendations policies
DROP POLICY IF EXISTS "recs_select" ON recommendations;
CREATE POLICY "recs_select" ON recommendations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "recs_insert" ON recommendations;
CREATE POLICY "recs_insert" ON recommendations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "recs_update" ON recommendations;
CREATE POLICY "recs_update" ON recommendations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "recs_delete" ON recommendations;
CREATE POLICY "recs_delete" ON recommendations FOR DELETE TO anon, authenticated USING (true);

-- Audit logs policies
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
CREATE POLICY "audit_select" ON audit_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "audit_update" ON audit_logs;
CREATE POLICY "audit_update" ON audit_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "audit_delete" ON audit_logs;
CREATE POLICY "audit_delete" ON audit_logs FOR DELETE TO anon, authenticated USING (true);

-- Savings plans policies
DROP POLICY IF EXISTS "plans_select" ON savings_plans;
CREATE POLICY "plans_select" ON savings_plans FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "plans_insert" ON savings_plans;
CREATE POLICY "plans_insert" ON savings_plans FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "plans_update" ON savings_plans;
CREATE POLICY "plans_update" ON savings_plans FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "plans_delete" ON savings_plans;
CREATE POLICY "plans_delete" ON savings_plans FOR DELETE TO anon, authenticated USING (true);
