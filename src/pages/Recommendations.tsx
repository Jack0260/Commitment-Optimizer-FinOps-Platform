import { useState, useMemo } from 'react';
import { Search, Filter, Lightbulb, ChevronDown, X, CheckCircle2, XCircle, Clock, AlertCircle, Calendar, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import {
  formatCurrency, categoryLabels, statusLabels, statusColors,
  confidenceColors, riskColors, approvalLabels, classNames,
} from '@/lib/format';
import { updateRecommendationStatus } from '@/lib/data';
import type { Team, CloudResource, Recommendation, RecStatus } from '@/lib/types';

interface RecommendationsProps {
  teams: Team[];
  resources: CloudResource[];
  recommendations: Recommendation[];
  onRefresh: () => void;
}

const allStatuses: RecStatus[] = [
  'generated', 'under_review', 'accepted', 'rejected', 'deferred',
  'exception_requested', 'scheduled', 'implemented', 'verified', 'not_realized',
];

export function Recommendations({ teams, resources, recommendations, onRefresh }: RecommendationsProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const resourceMap = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  const filtered = useMemo(() => {
    return recommendations.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.title.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
      }
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (teamFilter !== 'all' && r.team_id !== teamFilter) return false;
      if (confidenceFilter !== 'all' && r.confidence !== confidenceFilter) return false;
      return true;
    });
  }, [recommendations, search, categoryFilter, statusFilter, teamFilter, confidenceFilter]);

  const totalSavings = filtered.reduce((s, r) => s + r.estimated_monthly_savings, 0);

  const handleAction = async (recId: string, newStatus: RecStatus) => {
    setActionLoading(true);
    try {
      const rec = recommendations.find((r) => r.id === recId);
      const actor = rec?.owner || 'System';
      await updateRecommendationStatus(recId, newStatus, actor);
      onRefresh();
      setSelectedRec(null);
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const availableActions = (status: RecStatus): { label: string; status: RecStatus; icon: typeof CheckCircle2; variant: string }[] => {
    switch (status) {
      case 'generated':
        return [
          { label: 'Start Review', status: 'under_review', icon: Search, variant: 'btn-secondary' },
        ];
      case 'under_review':
        return [
          { label: 'Accept', status: 'accepted', icon: CheckCircle2, variant: 'btn-primary' },
          { label: 'Reject', status: 'rejected', icon: XCircle, variant: 'btn-secondary' },
          { label: 'Defer', status: 'deferred', icon: Clock, variant: 'btn-secondary' },
          { label: 'Request Exception', status: 'exception_requested', icon: AlertCircle, variant: 'btn-secondary' },
        ];
      case 'accepted':
      case 'exception_requested':
        return [
          { label: 'Schedule', status: 'scheduled', icon: Calendar, variant: 'btn-primary' },
        ];
      case 'scheduled':
        return [
          { label: 'Mark Implemented', status: 'implemented', icon: CheckCircle2, variant: 'btn-primary' },
        ];
      case 'implemented':
        return [
          { label: 'Verify Savings', status: 'verified', icon: CheckCircle2, variant: 'btn-primary' },
          { label: 'Mark Not Realized', status: 'not_realized', icon: XCircle, variant: 'btn-secondary' },
        ];
      default:
        return [];
    }
  };

  const activeFilterCount = [categoryFilter, statusFilter, teamFilter, confidenceFilter].filter((f) => f !== 'all').length;

  return (
    <div>
      <PageHeader
        title="Recommendations"
        description={`${recommendations.length} recommendations · ${formatCurrency(recommendations.reduce((s, r) => s + r.estimated_monthly_savings, 0))} total estimated savings`}
        actions={
          <button onClick={onRefresh} className="btn-secondary">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {/* Search + filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search recommendations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-9"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={classNames('btn-secondary', activeFilterCount > 0 && 'border-brand-500 text-brand-600')}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-brand-500 px-1.5 text-xs text-white">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Category</label>
            <select className="input w-full" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
            <select className="input w-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {allStatuses.map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Team</label>
            <select className="input w-full" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="all">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Confidence</label>
            <select className="input w-full" value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value)}>
              <option value="all">All Levels</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-100 px-4 py-2.5 dark:bg-slate-800/50">
        <span className="text-sm text-slate-600 dark:text-slate-300">
          Showing <strong className="text-slate-900 dark:text-white">{filtered.length}</strong> recommendations
        </span>
        <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
          {formatCurrency(totalSavings)} est. savings
        </span>
      </div>

      {/* Recommendations list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="h-6 w-6" />}
          title="No recommendations match your filters"
          description="Try adjusting your search or filter criteria"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((rec) => {
            const resource = resourceMap.get(rec.resource_id);
            const team = teamMap.get(rec.team_id);
            const actions = availableActions(rec.status);
            return (
              <div
                key={rec.id}
                className="card card-hover cursor-pointer p-4"
                onClick={() => setSelectedRec(rec)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={statusColors[rec.status]}>{statusLabels[rec.status]}</Badge>
                      <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {categoryLabels[rec.category]}
                      </Badge>
                      <Badge className={confidenceColors[rec.confidence]}>
                        {rec.confidence} confidence
                      </Badge>
                      <Badge className={riskColors[rec.risk_level]}>
                        {rec.risk_level} risk
                      </Badge>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{rec.title}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{rec.description}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                      <span>{resource?.resource_name}</span>
                      <span>·</span>
                      <span>{team?.name}</span>
                      <span>·</span>
                      <span>Owner: {rec.owner}</span>
                      <span>·</span>
                      <span>{approvalLabels[rec.approval_required]}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-brand-600 dark:text-brand-400">
                      {formatCurrency(rec.estimated_monthly_savings)}
                    </p>
                    <p className="text-xs text-slate-400">est. monthly savings</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Cost: {formatCurrency(rec.current_monthly_cost)}/mo
                    </p>
                  </div>
                </div>
                {actions.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                    {actions.map((a) => {
                      const Icon = a.icon;
                      return (
                        <button
                          key={a.status}
                          onClick={() => handleAction(rec.id, a.status)}
                          disabled={actionLoading}
                          className={a.variant}
                        >
                          <Icon className="h-4 w-4" /> {a.label}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setSelectedRec(rec)}
                      className="btn-ghost ml-auto"
                    >
                      Details <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {actions.length === 0 && (
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    {rec.measured_savings !== null && (
                      <span className="text-xs">
                        <span className="text-slate-400">Measured savings: </span>
                        <span className={classNames(
                          'font-medium',
                          rec.status === 'verified' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                        )}>
                          {formatCurrency(rec.measured_savings)}/mo
                        </span>
                      </span>
                    )}
                    <button onClick={() => setSelectedRec(rec)} className="btn-ghost ml-auto">
                      View Details <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      {selectedRec && (
        <RecommendationDetail
          rec={selectedRec}
          resource={resourceMap.get(selectedRec.resource_id)}
          team={teamMap.get(selectedRec.team_id)}
          onClose={() => setSelectedRec(null)}
          onAction={handleAction}
          actionLoading={actionLoading}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

// ── Detail Drawer ────────────────────────────────────────────────────────────

interface DetailProps {
  rec: Recommendation;
  resource?: CloudResource;
  team?: Team;
  onClose: () => void;
  onAction: (recId: string, status: RecStatus) => void;
  actionLoading: boolean;
  onRefresh: () => void;
}

import { fetchAuditLogs } from '@/lib/data';
import { useEffect } from 'react';
import type { AuditLog } from '@/lib/types';
import { formatDateTime, formatDate, environmentLabels, resourceTypeLabels } from '@/lib/format';

function RecommendationDetail({ rec, resource, team, onClose, onAction, actionLoading }: DetailProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    fetchAuditLogs(rec.id).then((data) => {
      setLogs(data);
      setLoadingLogs(false);
    }).catch(() => setLoadingLogs(false));
  }, [rec.id]);

  const actions = (() => {
    switch (rec.status) {
      case 'generated': return [{ label: 'Start Review', status: 'under_review' as RecStatus, icon: Search, variant: 'btn-secondary' }];
      case 'under_review': return [
        { label: 'Accept', status: 'accepted' as RecStatus, icon: CheckCircle2, variant: 'btn-primary' },
        { label: 'Reject', status: 'rejected' as RecStatus, icon: XCircle, variant: 'btn-secondary' },
        { label: 'Defer', status: 'deferred' as RecStatus, icon: Clock, variant: 'btn-secondary' },
        { label: 'Request Exception', status: 'exception_requested' as RecStatus, icon: AlertCircle, variant: 'btn-secondary' },
      ];
      case 'accepted':
      case 'exception_requested': return [{ label: 'Schedule', status: 'scheduled' as RecStatus, icon: Calendar, variant: 'btn-primary' }];
      case 'scheduled': return [{ label: 'Mark Implemented', status: 'implemented' as RecStatus, icon: CheckCircle2, variant: 'btn-primary' }];
      case 'implemented': return [
        { label: 'Verify Savings', status: 'verified' as RecStatus, icon: CheckCircle2, variant: 'btn-primary' },
        { label: 'Mark Not Realized', status: 'not_realized' as RecStatus, icon: XCircle, variant: 'btn-secondary' },
      ];
      default: return [];
    }
  })();

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl dark:bg-slate-900">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={statusColors[rec.status]}>{statusLabels[rec.status]}</Badge>
              <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {categoryLabels[rec.category]}
              </Badge>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Title */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{rec.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{rec.description}</p>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-brand-50 p-3 dark:bg-brand-900/20">
              <p className="text-xs text-slate-500 dark:text-slate-400">Current Cost</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(rec.current_monthly_cost)}/mo</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <p className="text-xs text-slate-500 dark:text-slate-400">Est. Savings</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(rec.estimated_monthly_savings)}/mo</p>
            </div>
          </div>

          {rec.measured_savings !== null && (
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Measured Savings (post-implementation)</p>
              <p className={classNames(
                'text-lg font-bold',
                rec.status === 'verified' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
              )}>
                {formatCurrency(rec.measured_savings)}/mo
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Prediction accuracy: {rec.estimated_monthly_savings > 0
                  ? Math.round((rec.measured_savings / rec.estimated_monthly_savings) * 100)
                  : 0}%
              </p>
            </div>
          )}

          {/* Details grid */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recommendation Details</h3>
            <DetailRow label="Confidence" value={<Badge className={confidenceColors[rec.confidence]}>{rec.confidence}</Badge>} />
            <DetailRow label="Risk Level" value={<Badge className={riskColors[rec.risk_level]}>{rec.risk_level}</Badge>} />
            <DetailRow label="Approval Required" value={approvalLabels[rec.approval_required]} />
            <DetailRow label="Owner" value={rec.owner} />
            <DetailRow label="Required Downtime" value={`${rec.required_downtime_hours}h`} />
            <DetailRow label="Payback Period" value={rec.estimated_payback_days > 0 ? `${rec.estimated_payback_days} days` : 'Immediate'} />
            <DetailRow label="Performance Impact" value={rec.performance_impact} />
          </div>

          {/* Resource info */}
          {resource && (
            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Resource</h3>
              <DetailRow label="Name" value={resource.resource_name} />
              <DetailRow label="Type" value={resourceTypeLabels[resource.resource_type as keyof typeof resourceTypeLabels]} />
              <DetailRow label="Service" value={resource.service} />
              <DetailRow label="Environment" value={environmentLabels[resource.environment as keyof typeof environmentLabels]} />
              <DetailRow label="Region" value={resource.region} />
              <DetailRow label="Team" value={team?.name || '—'} />
            </div>
          )}

          {/* Assumptions */}
          {rec.assumptions && (
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
              <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Key Assumptions</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{rec.assumptions}</p>
            </div>
          )}

          {/* Measurement window */}
          {rec.implemented_at && (
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Measurement Window</h3>
              <DetailRow label="Implemented" value={formatDateTime(rec.implemented_at)} />
              <DetailRow label="Measurement Start" value={formatDate(rec.measurement_start)} />
              <DetailRow label="Measurement End" value={formatDate(rec.measurement_end)} />
            </div>
          )}

          {/* Audit log */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Audit Trail</h3>
            {loadingLogs ? (
              <p className="text-sm text-slate-400">Loading...</p>
            ) : (
              <div className="space-y-2">
                {logs.length === 0 ? (
              <p className="text-sm text-slate-400">No audit entries</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{log.action}</p>
                        {log.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{log.notes}</p>}
                        <p className="text-xs text-slate-400 mt-1">
                          {log.actor} · {formatDateTime(log.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <div className="sticky bottom-0 flex items-center gap-2 border-t border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900 -mx-5 px-5">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.status}
                    onClick={() => onAction(rec.id, a.status)}
                    disabled={actionLoading}
                    className={a.variant}
                  >
                    <Icon className="h-4 w-4" /> {a.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-white text-right font-medium">{value}</span>
    </div>
  );
}
