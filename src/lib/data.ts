import { supabase } from './supabase';
import type { Team, CloudResource, DailyUsage, Budget, Recommendation, AuditLog, SavingsPlan, RecCategory, ConfidenceLevel, RiskLevel, ApprovalReq, RecStatus } from './types';

// ── Data fetching helpers ───────────────────────────────────────────────────

export async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from('teams').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchResources(): Promise<CloudResource[]> {
  const { data, error } = await supabase.from('cloud_resources').select('*').order('resource_name');
  if (error) throw error;
  return data || [];
}

export async function fetchResourcesByTeam(teamId: string): Promise<CloudResource[]> {
  const { data, error } = await supabase.from('cloud_resources').select('*').eq('team_id', teamId).order('resource_name');
  if (error) throw error;
  return data || [];
}

export async function fetchDailyUsage(resourceId?: string): Promise<DailyUsage[]> {
  const allData: DailyUsage[] = [];
  let offset = 0;
  while (true) {
    let query = supabase.from('daily_usage').select('*').order('date').range(offset, offset + 999);
    if (resourceId) query = query.eq('resource_id', resourceId);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return allData;
}

export async function fetchDailyUsageForResource(resourceId: string): Promise<DailyUsage[]> {
  const { data, error } = await supabase.from('daily_usage').select('*').eq('resource_id', resourceId).order('date');
  if (error) throw error;
  return data || [];
}

export async function fetchBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase.from('budgets').select('*, teams(*)').order('month');
  if (error) throw error;
  return data || [];
}

export async function fetchRecommendations(): Promise<Recommendation[]> {
  const { data, error } = await supabase.from('recommendations').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchRecommendation(id: string): Promise<Recommendation | null> {
  const { data, error } = await supabase.from('recommendations').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAuditLogs(recId: string): Promise<AuditLog[]> {
  const { data, error } = await supabase.from('audit_logs').select('*').eq('recommendation_id', recId).order('created_at');
  if (error) throw error;
  return data || [];
}

export async function fetchSavingsPlans(): Promise<SavingsPlan[]> {
  const { data, error } = await supabase.from('savings_plans').select('*').order('monthly_commitment', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Governance workflow mutations ───────────────────────────────────────────

export async function updateRecommendationStatus(
  recId: string,
  newStatus: RecStatus,
  actor: string,
  notes?: string
): Promise<void> {
  // Fetch current status
  const { data: rec, error: fetchErr } = await supabase
    .from('recommendations')
    .select('status')
    .eq('id', recId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!rec) throw new Error('Recommendation not found');

  const oldStatus = rec.status as RecStatus;

  // Update recommendation
  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === 'implemented') {
    updates.implemented_at = new Date().toISOString();
    updates.measurement_start = new Date().toISOString();
    // Measurement end is 30 days later
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    updates.measurement_end = endDate.toISOString();
  }

  if (newStatus === 'verified' || newStatus === 'not_realized') {
    // Generate a measured savings value
    const { data: fullRec } = await supabase
      .from('recommendations')
      .select('estimated_monthly_savings')
      .eq('id', recId)
      .maybeSingle();
    const estimated = fullRec?.estimated_monthly_savings || 0;
    // 80% of verified recs realize 70-110% of estimated; 20% realize 40-70%
    const isVerified = newStatus === 'verified';
    const factor = isVerified ? (0.7 + Math.random() * 0.4) : (0.4 + Math.random() * 0.3);
    updates.measured_savings = Math.round(estimated * factor * 100) / 100;
  }

  const { error: updateErr } = await supabase
    .from('recommendations')
    .update(updates)
    .eq('id', recId);
  if (updateErr) throw updateErr;

  // Insert audit log
  const { error: logErr } = await supabase.from('audit_logs').insert({
    recommendation_id: recId,
    actor,
    action: `Status changed from ${oldStatus} to ${newStatus}`,
    old_status: oldStatus,
    new_status: newStatus,
    notes: notes || null,
  });
  if (logErr) throw logErr;
}

// ── Dashboard data helpers ──────────────────────────────────────────────────

export interface DashboardKPIs {
  totalMonthlySpend: number;
  totalBudget: number;
  forecastedMonthEnd: number;
  realizedSavings: number;
  pipelineSavings: number;
  totalRecommendations: number;
  acceptedCount: number;
  openAnomalies: number;
  acceptanceRate: number;
}

export async function fetchDashboardKPIs(
  recs: Recommendation[],
  resources: CloudResource[],
  budgets: Budget[]
): Promise<DashboardKPIs> {
  const totalMonthlySpend = resources.reduce((sum, r) => sum + r.monthly_cost, 0);

  // Current month budgets
  const currentMonth = '2026-10';
  const currentBudgets = budgets.filter((b) => b.month === currentMonth);
  const totalBudget = currentBudgets.reduce((sum, b) => sum + b.budget_amount, 0);
  const forecastedMonthEnd = currentBudgets.reduce((sum, b) => sum + b.forecasted_spend, 0);

  const realizedSavings = recs
    .filter((r) => r.status === 'verified' && r.measured_savings)
    .reduce((sum, r) => sum + (r.measured_savings || 0), 0);

  const pipelineRecs = recs.filter(
    (r) => ['generated', 'under_review', 'accepted', 'scheduled', 'exception_requested'].includes(r.status)
  );
  const pipelineSavings = pipelineRecs.reduce((sum, r) => sum + r.estimated_monthly_savings, 0);

  const totalRecommendations = recs.length;
  const decided = recs.filter((r) =>
    ['accepted', 'rejected', 'deferred', 'exception_requested', 'scheduled', 'implemented', 'verified', 'not_realized'].includes(r.status)
  );
  const acceptedCount = recs.filter((r) =>
    ['accepted', 'scheduled', 'implemented', 'verified', 'not_realized'].includes(r.status)
  ).length;
  const acceptanceRate = decided.length > 0 ? (acceptedCount / decided.length) * 100 : 0;

  const openAnomalies = recs.filter((r) => r.category === 'cost_anomaly' && r.status !== 'verified' && r.status !== 'rejected').length;

  return {
    totalMonthlySpend,
    totalBudget,
    forecastedMonthEnd,
    realizedSavings,
    pipelineSavings,
    totalRecommendations,
    acceptedCount,
    openAnomalies,
    acceptanceRate,
  };
}
