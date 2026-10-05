import { useMemo } from 'react';
import { AlertTriangle, Zap } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '@/lib/theme';
import { formatCurrency, statusLabels, statusColors, classNames } from '@/lib/format';
import type { Team, CloudResource, Recommendation } from '@/lib/types';

interface AnomaliesProps {
  teams: Team[];
  resources: CloudResource[];
  recommendations: Recommendation[];
}

export function Anomalies({ teams, resources, recommendations }: AnomaliesProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const anomalies = useMemo(() =>
    recommendations.filter((r) => r.category === 'cost_anomaly'),
    [recommendations]
  );

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const resourceMap = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  // Daily spend for anomalous resources
  const anomalyData = useMemo(() => {
    const anomalousResourceIds = new Set(anomalies.map((a) => a.resource_id));
    const resources_ = resources.filter((r) => anomalousResourceIds.has(r.id));
    return resources_.map((r) => ({
      name: r.resource_name,
      cost: r.monthly_cost,
    }));
  }, [anomalies, resources]);

  if (anomalies.length === 0) {
    return (
      <div>
        <PageHeader title="Cost Anomalies" description="Detected spend anomalies across your cloud infrastructure" />
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="No anomalies detected"
          description="The recommendation engine found no cost anomalies in the current data."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Cost Anomalies"
        description={`${anomalies.length} anomalies detected · ${formatCurrency(anomalies.reduce((s, a) => s + a.estimated_monthly_savings, 0))} potential impact`}
      />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Open Anomalies</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {anomalies.filter((a) => !['verified', 'rejected'].includes(a.status)).length}
          </p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-red-500" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Affected Resources</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {new Set(anomalies.map((a) => a.resource_id)).size}
          </p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-brand-500" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Resolved</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
            {anomalies.filter((a) => ['verified', 'rejected'].includes(a.status)).length}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="card mb-6 p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Anomalous Resource Cost</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={anomalyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="name" stroke={textColor} fontSize={10} angle={-15} textAnchor="end" height={60} />
            <YAxis stroke={textColor} fontSize={11} tickFormatter={(v) => `$${v / 1000}K`} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#0f172a' : '#fff',
                border: `1px solid ${gridColor}`,
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: any) => formatCurrency(Number(value))}
            />
            <Bar dataKey="cost" fill="#ec4899" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Anomaly list */}
      <div className="space-y-3">
        {anomalies.map((a) => {
          const resource = resourceMap.get(a.resource_id);
          const team = teamMap.get(a.team_id);
          return (
            <div key={a.id} className="card card-hover p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">Cost Anomaly</Badge>
                    <Badge className={statusColors[a.status]}>{statusLabels[a.status]}</Badge>
                    <Badge className={classNames(
                      'badge',
                      a.risk_level === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                      a.risk_level === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    )}>
                      {a.risk_level} risk
                    </Badge>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{a.title}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{a.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span>{resource?.resource_name}</span>
                    <span>·</span>
                    <span>{team?.name}</span>
                    <span>·</span>
                    <span>Owner: {a.owner}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-pink-600 dark:text-pink-400">
                    {formatCurrency(a.estimated_monthly_savings)}
                  </p>
                  <p className="text-xs text-slate-400">est. impact</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
