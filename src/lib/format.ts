import { RecCategory, RecStatus, ConfidenceLevel, RiskLevel, ApprovalReq, Environment, ResourceType } from './types';

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 10_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatCurrencyDetailed(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '$0.00';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const categoryLabels: Record<RecCategory, string> = {
  idle_compute: 'Idle Compute',
  underutilized: 'Underutilized Instance',
  oversized: 'Oversized Instance',
  unattached_storage: 'Unattached Storage',
  storage_tier: 'Storage Tier Optimization',
  nonprod_scheduling: 'Non-Prod Scheduling',
  commitment: 'Commitment / Savings Plan',
  cost_anomaly: 'Cost Anomaly',
  untagged: 'Untagged Resource',
  budget_risk: 'Budget Risk',
};

export const categoryColors: Record<RecCategory, string> = {
  idle_compute: '#ef4444',
  underutilized: '#f59e0b',
  oversized: '#f97316',
  unattached_storage: '#8b5cf6',
  storage_tier: '#06b6d4',
  nonprod_scheduling: '#14b8a6',
  commitment: '#3b82f6',
  cost_anomaly: '#ec4899',
  untagged: '#64748b',
  budget_risk: '#dc2626',
};

export const statusLabels: Record<RecStatus, string> = {
  generated: 'Generated',
  under_review: 'Under Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  deferred: 'Deferred',
  exception_requested: 'Exception Requested',
  scheduled: 'Scheduled',
  implemented: 'Implemented',
  verified: 'Verified',
  not_realized: 'Not Realized',
};

export const statusColors: Record<RecStatus, string> = {
  generated: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  accepted: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  deferred: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  exception_requested: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  scheduled: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  implemented: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  verified: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  not_realized: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

export const confidenceColors: Record<ConfidenceLevel, string> = {
  high: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const riskColors: Record<RiskLevel, string> = {
  low: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const approvalLabels: Record<ApprovalReq, string> = {
  auto: 'Auto-Approve',
  manager: 'Manager Approval',
  architect: 'Architect Approval',
};

export const environmentLabels: Record<Environment, string> = {
  production: 'Production',
  staging: 'Staging',
  dev: 'Dev',
};

export const resourceTypeLabels: Record<ResourceType, string> = {
  compute: 'Compute',
  storage: 'Storage',
  database: 'Database',
  serverless: 'Serverless',
  network: 'Network',
};

export function classNames(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
