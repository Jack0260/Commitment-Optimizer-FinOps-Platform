import { useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { ShieldCheck, TrendingUp, Target, AlertTriangle, Award, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { KPICard } from '@/components/KPICard';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/lib/theme';
import { formatCurrency, formatPercent, categoryLabels, classNames } from '@/lib/format';
import type { Team, Recommendation } from '@/lib/types';

interface SavingsReportProps {
  teams: Team[];
  recommendations: Recommendation[];
}

export function SavingsReport({ teams, recommendations }: SavingsReportProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const implemented = useMemo(() =>
    recommendations.filter((r) => ['verified', 'not_realized'].includes(r.status) && r.measured_savings !== null),
    [recommendations]
  );

  // KPIs
  const totalPredicted = implemented.reduce((s, r) => s + r.estimated_monthly_savings, 0);
  const totalActual = implemented.reduce((s, r) => s + (r.measured_savings || 0), 0);
  const accuracy = totalPredicted > 0 ? (totalActual / totalPredicted) * 100 : 0;
  const verifiedCount = implemented.filter((r) => r.status === 'verified').length;
  const notRealizedCount = implemented.filter((r) => r.status === 'not_realized').length;

  // Prediction vs Actual by category
  const byCategory = useMemo(() => {
    const map = new Map<string, { predicted: number; actual: number; count: number; verified: number }>();
    implemented.forEach((r) => {
      const existing = map.get(r.category) || { predicted: 0, actual: 0, count: 0, verified: 0 };
      existing.predicted += r.estimated_monthly_savings;
      existing.actual += r.measured_savings || 0;
      existing.count += 1;
      if (r.status === 'verified') existing.verified += 1;
      map.set(r.category, existing);
    });
    return [...map.entries()].map(([cat, v]) => ({
      category: cat,
      label: categoryLabels[cat as keyof typeof categoryLabels] || cat,
      predicted: Math.round(v.predicted),
      actual: Math.round(v.actual),
      accuracy: v.predicted > 0 ? Math.round((v.actual / v.predicted) * 100) : 0,
      count: v.count,
      verified: v.verified,
      verificationRate: v.count > 0 ? Math.round((v.verified / v.count) * 100) : 0,
    }));
  }, [implemented]);

  // Category quality radar
  const radarData = useMemo(() => {
    return byCategory.map((c) => ({
      category: c.label.length > 15 ? c.label.slice(0, 12) + '...' : c.label,
      accuracy: Math.min(c.accuracy, 100),
      verification: c.verificationRate,
    }));
  }, [byCategory]);

  // Teams with highest unrealized savings
  const teamUnrealized = useMemo(() => {
    const map = new Map<string, { name: string; unrealized: number; pending: number; pipeline: number }>();
    recommendations.forEach((r) => {
      const team = teams.find((t) => t.id === r.team_id);
      if (!team) return;
      const existing = map.get(r.team_id) || { name: team.name, unrealized: 0, pending: 0, pipeline: 0 };
      // Unrealized: not_realized savings + pending recommendations
      if (r.status === 'not_realized') {
        existing.unrealized += r.estimated_monthly_savings - (r.measured_savings || 0);
      }
      if (['generated', 'under_review', 'accepted', 'scheduled', 'exception_requested', 'deferred'].includes(r.status)) {
        existing.pending += 1;
        existing.pipeline += r.estimated_monthly_savings;
      }
      map.set(r.team_id, existing);
    });
    return [...map.values()]
      .map((v) => ({ ...v, unrealized: Math.round(v.unrealized), pipeline: Math.round(v.pipeline) }))
      .sort((a, b) => b.unrealized + b.pipeline - a.unrealized + a.pipeline);
  }, [recommendations, teams]);

  // Main risks
  const risks = useMemo(() => {
    const riskMap = new Map<string, number>();
    implemented.filter((r) => r.status === 'not_realized').forEach((r) => {
      riskMap.set(r.category, (riskMap.get(r.category) || 0) + 1);
    });
    return [...riskMap.entries()].map(([cat, count]) => ({
      category: categoryLabels[cat as keyof typeof categoryLabels] || cat,
      count,
    }));
  }, [implemented]);

  // Assumptions summary
  const commonAssumptions = useMemo(() => {
    const assumptionMap = new Map<string, number>();
    implemented.forEach((r) => {
      if (r.assumptions) {
        // Extract key assumption (first sentence)
        const firstSentence = r.assumptions.split('.')[0];
        assumptionMap.set(firstSentence, (assumptionMap.get(firstSentence) || 0) + 1);
      }
    });
    return [...assumptionMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [implemented]);

  if (implemented.length === 0) {
    return (
      <div>
        <PageHeader title="Savings Confidence Report" description="Predicted vs. actual savings analysis" />
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="No verified recommendations yet"
          description="Once recommendations are implemented and verified, this report will show prediction accuracy, risks, and team performance."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Savings Confidence Report"
        description="Predicted vs. actual savings — forecast accuracy and recommendation quality"
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Predicted Savings"
          value={formatCurrency(totalPredicted)}
          subValue={`Across ${implemented.length} recommendations`}
          icon={<Target className="h-5 w-5" />}
        />
        <KPICard
          label="Total Actual Savings"
          value={formatCurrency(totalActual)}
          subValue={`Verified: ${verifiedCount} · Not realized: ${notRealizedCount}`}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={accuracy >= 80 ? 'up' : 'down'}
          trendValue={formatPercent(accuracy)}
          trendPositive={accuracy >= 80}
        />
        <KPICard
          label="Forecast Accuracy"
          value={formatPercent(accuracy)}
          subValue={accuracy >= 80 ? 'High accuracy' : accuracy >= 60 ? 'Moderate accuracy' : 'Needs improvement'}
          icon={<ShieldCheck className="h-5 w-5" />}
          trendPositive={accuracy >= 80}
        />
        <KPICard
          label="Verification Rate"
          value={formatPercent(verifiedCount / implemented.length * 100)}
          subValue={`${verifiedCount} of ${implemented.length} verified`}
          icon={<Award className="h-5 w-5" />}
          trendPositive
        />
      </div>

      {/* Prediction vs Actual by Category */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
            Predicted vs. Actual Savings by Category
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="label" stroke={textColor} fontSize={10} angle={-20} textAnchor="end" height={70} />
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
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="predicted" fill="#3b82f6" name="Predicted" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="#22c55e" name="Actual" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quality radar */}
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Recommendation Quality</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={gridColor} />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: textColor }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: textColor }} />
              <Radar name="Accuracy" dataKey="accuracy" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.3} />
              <Radar name="Verification" dataKey="verification" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#fff',
                  border: `1px solid ${gridColor}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category quality table */}
      <div className="mt-6 card p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Recommendation Quality by Category</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Category</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Count</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Predicted</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Actual</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Accuracy</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Verified</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Quality</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((c) => (
                <tr key={c.category} className="border-b border-slate-100 dark:border-slate-800/50">
                  <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">{c.label}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{c.count}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{formatCurrency(c.predicted)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{formatCurrency(c.actual)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={classNames(
                      'font-medium',
                      c.accuracy >= 80 ? 'text-green-600 dark:text-green-400' :
                      c.accuracy >= 50 ? 'text-amber-600 dark:text-amber-400' :
                      'text-red-600 dark:text-red-400'
                    )}>
                      {formatPercent(c.accuracy)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">
                    {c.verified}/{c.count}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Badge className={classNames(
                      'badge',
                      c.accuracy >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                      c.accuracy >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    )}>
                      {c.accuracy >= 80 ? 'Excellent' : c.accuracy >= 50 ? 'Fair' : 'Poor'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teams + Risks */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Teams with highest unrealized savings */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Teams with Highest Unrealized Savings</h3>
          </div>
          <div className="space-y-3">
            {teamUnrealized.map((t, i) => (
              <div key={t.name} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.pending} pending recommendations</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(t.unrealized + t.pipeline)}
                  </p>
                  <p className="text-xs text-slate-400">unrealized + pipeline</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risks + Assumptions */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Key Risks & Assumptions</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Risks that caused predictions to miss:</p>
              {risks.length === 0 ? (
                <p className="text-sm text-slate-400">No significant prediction misses detected.</p>
              ) : (
                <div className="space-y-2">
                  {risks.map((r) => (
                    <div key={r.category} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300">{r.category}</span>
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        {r.count} miss{r.count > 1 ? 'es' : ''}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="mb-2 text-xs font-medium text-slate-500">Main assumptions driving predictions:</p>
              <ul className="space-y-1.5">
                {commonAssumptions.map(([assumption, count]) => (
                  <li key={assumption} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>{assumption}.</span>
                    <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 shrink-0">
                      {count}×
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Individual recommendation accuracy */}
      <div className="mt-6 card p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Individual Recommendation Accuracy</h3>
        <div className="space-y-2">
          {implemented.map((r) => {
            const accuracy = r.estimated_monthly_savings > 0
              ? Math.round(((r.measured_savings || 0) / r.estimated_monthly_savings) * 100)
              : 0;
            return (
              <div key={r.id} className="flex items-center gap-4 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{r.title}</p>
                  <p className="text-xs text-slate-400">{categoryLabels[r.category]}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-slate-500">Predicted: <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(r.estimated_monthly_savings)}</span></p>
                  <p className="text-slate-500">Actual: <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(r.measured_savings)}</span></p>
                </div>
                <div className="w-20 text-right">
                  <span className={classNames(
                    'text-sm font-bold',
                    accuracy >= 80 ? 'text-green-600 dark:text-green-400' :
                    accuracy >= 50 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  )}>
                    {accuracy}%
                  </span>
                </div>
                <Badge className={r.status === 'verified' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'}>
                  {r.status === 'verified' ? 'Verified' : 'Not Realized'}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
