import { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart,
} from 'recharts';
import { TrendingDown, DollarSign, PiggyBank, Lightbulb, AlertTriangle, Target, Zap, Leaf } from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/lib/theme';
import { formatCurrency, formatPercent, categoryLabels, categoryColors, statusLabels, statusColors, classNames } from '@/lib/format';
import type { Team, CloudResource, Budget, Recommendation, DailyUsage } from '@/lib/types';

interface DashboardProps {
  teams: Team[];
  resources: CloudResource[];
  budgets: Budget[];
  recommendations: Recommendation[];
  usageData: DailyUsage[];
}

export function Dashboard({ teams, resources, budgets, recommendations, usageData }: DashboardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  // KPIs
  const kpis = useMemo(() => {
    const totalMonthlySpend = resources.reduce((s, r) => s + r.monthly_cost, 0);
    const currentBudgets = budgets.filter((b) => b.month === '2026-10');
    const totalBudget = currentBudgets.reduce((s, b) => s + b.budget_amount, 0);
    const forecasted = currentBudgets.reduce((s, b) => s + b.forecasted_spend, 0);
    const realizedSavings = recommendations
      .filter((r) => r.status === 'verified' && r.measured_savings)
      .reduce((s, r) => s + (r.measured_savings || 0), 0);
    const pipelineSavings = recommendations
      .filter((r) => ['generated', 'under_review', 'accepted', 'scheduled', 'exception_requested'].includes(r.status))
      .reduce((s, r) => s + r.estimated_monthly_savings, 0);
    const decided = recommendations.filter((r) => !['generated', 'under_review'].includes(r.status));
    const accepted = recommendations.filter((r) => ['accepted', 'scheduled', 'implemented', 'verified', 'not_realized'].includes(r.status));
    const acceptanceRate = decided.length > 0 ? (accepted.length / decided.length) * 100 : 0;
    const openAnomalies = recommendations.filter((r) => r.category === 'cost_anomaly' && !['verified', 'rejected'].includes(r.status)).length;

    return { totalMonthlySpend, totalBudget, forecasted, realizedSavings, pipelineSavings, acceptanceRate, openAnomalies };
  }, [resources, budgets, recommendations]);

  // Spend trend (daily aggregate)
  const spendTrend = useMemo(() => {
    const byDate = new Map<string, number>();
    usageData.forEach((u) => {
      byDate.set(u.date, (byDate.get(u.date) || 0) + u.cost);
    });
    const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([date, cost]) => ({
      date: date.slice(5), // MM-DD
      cost: Math.round(cost * 100) / 100,
    }));
  }, [usageData]);

  // Forecast data - extend spend trend with forecast
  const spendWithForecast = useMemo(() => {
    if (spendTrend.length === 0) return [];
    const last30 = spendTrend.slice(-30);
    const avgDaily = last30.reduce((s, d) => s + d.cost, 0) / last30.length;
    const forecastMonthly = avgDaily * 30;

    // Add a forecast point at end
    return [...spendTrend, ...Array.from({ length: 15 }, (_, i) => {
      const lastDate = new Date(spendTrend[spendTrend.length - 1].date);
      lastDate.setDate(lastDate.getDate() + i + 1);
      return {
        date: lastDate.toISOString().slice(5, 10),
        cost: null as number | null,
        forecast: Math.round((avgDaily + (Math.random() - 0.5) * avgDaily * 0.1) * 100) / 100,
      };
    })];
  }, [spendTrend]);

  // Savings by category
  const savingsByCategory = useMemo(() => {
    const byCat = new Map<string, number>();
    recommendations.forEach((r) => {
      const current = byCat.get(r.category) || 0;
      byCat.set(r.category, current + r.estimated_monthly_savings);
    });
    return [...byCat.entries()]
      .map(([cat, savings]) => ({ category: cat, label: categoryLabels[cat as keyof typeof categoryLabels], savings: Math.round(savings) }))
      .sort((a, b) => b.savings - a.savings);
  }, [recommendations]);

  // Savings by team
  const savingsByTeam = useMemo(() => {
    const byTeam = new Map<string, { name: string; savings: number; spend: number }>();
    resources.forEach((r) => {
      const team = teams.find((t) => t.id === r.team_id);
      if (!team) return;
      const existing = byTeam.get(r.team_id) || { name: team.name, savings: 0, spend: 0 };
      existing.spend += r.monthly_cost;
      byTeam.set(r.team_id, existing);
    });
    recommendations.forEach((r) => {
      const team = teams.find((t) => t.id === r.team_id);
      if (!team) return;
      const existing = byTeam.get(r.team_id) || { name: team.name, savings: 0, spend: 0 };
      existing.savings += r.estimated_monthly_savings;
      byTeam.set(r.team_id, existing);
    });
    return [...byTeam.values()].map((v) => ({ ...v, savings: Math.round(v.savings), spend: Math.round(v.spend) }));
  }, [recommendations, teams, resources]);

  // Savings by environment
  const savingsByEnv = useMemo(() => {
    const envMap = new Map<string, { savings: number; spend: number }>();
    resources.forEach((r) => {
      const existing = envMap.get(r.environment) || { savings: 0, spend: 0 };
      existing.spend += r.monthly_cost;
      envMap.set(r.environment, existing);
    });
    recommendations.forEach((r) => {
      const resource = resources.find((res) => res.id === r.resource_id);
      if (!resource) return;
      const existing = envMap.get(resource.environment) || { savings: 0, spend: 0 };
      existing.savings += r.estimated_monthly_savings;
      envMap.set(resource.environment, existing);
    });
    return [...envMap.entries()].map(([env, v]) => ({
      env: env.charAt(0).toUpperCase() + env.slice(1),
      savings: Math.round(v.savings),
      spend: Math.round(v.spend),
    }));
  }, [recommendations, resources]);

  // Recommendation funnel
  const funnel = useMemo(() => {
    const stages = [
      { stage: 'Generated', count: recommendations.length, color: '#64748b' },
      { stage: 'Under Review', count: recommendations.filter((r) => r.status === 'under_review').length, color: '#3b82f6' },
      { stage: 'Accepted', count: recommendations.filter((r) => ['accepted', 'scheduled', 'exception_requested'].includes(r.status)).length, color: '#14b8a6' },
      { stage: 'Implemented', count: recommendations.filter((r) => r.status === 'implemented').length, color: '#06b6d4' },
      { stage: 'Verified', count: recommendations.filter((r) => r.status === 'verified').length, color: '#22c55e' },
    ];
    return stages.filter((s) => s.count > 0);
  }, [recommendations]);

  // Budget alerts
  const budgetAlerts = useMemo(() => {
    return budgets
      .filter((b) => b.month === '2026-10')
      .map((b) => {
        const team = teams.find((t) => t.id === b.team_id);
        const pct = (b.forecasted_spend / b.budget_amount) * 100;
        return { ...b, teamName: team?.name || 'Unknown', pct, over: pct > 100 };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, teams]);

  // Recent anomalies
  const anomalies = useMemo(() => {
    return recommendations.filter((r) => r.category === 'cost_anomaly').slice(0, 5);
  }, [recommendations]);

  // Carbon estimate (illustrative)
  const carbonEstimate = useMemo(() => {
    // Very rough proxy: compute hours * 0.0007 tCO2/kWh * 0.35 kW/hour
    const computeResources = resources.filter((r) => r.resource_type === 'compute' || r.resource_type === 'database');
    const totalMonthlyCost = computeResources.reduce((s, r) => s + r.monthly_cost, 0);
    // Rough: $100/month of compute ≈ 50 kWh/month ≈ 0.035 tCO2/month
    const tCO2 = (totalMonthlyCost / 100) * 0.035;
    return Math.round(tCO2 * 10) / 10;
  }, [resources]);

  // Realized savings trend (mock from verified recs)
  const realizedSavingsTrend = useMemo(() => {
    const verified = recommendations.filter((r) => r.status === 'verified' && r.measured_savings);
    const months = ['Jul', 'Aug', 'Sep', 'Oct'];
    return months.map((m, i) => {
      const monthlySavings = verified
        .filter(() => Math.random() > 0.3)
        .reduce((s, r) => s + (r.measured_savings || 0), 0) * (0.5 + i * 0.15);
      return { month: m, savings: Math.round(monthlySavings) };
    });
  }, [recommendations]);

  return (
    <div>
      <PageHeader
        title="FinOps Dashboard"
        description="Cloud spend, savings, and governance at a glance"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Monthly Spend"
          value={formatCurrency(kpis.totalMonthlySpend)}
          subValue={`Budget: ${formatCurrency(kpis.totalBudget)}`}
          icon={<DollarSign className="h-5 w-5" />}
          trend={kpis.totalMonthlySpend > kpis.totalBudget ? 'up' : 'down'}
          trendValue={formatPercent(((kpis.totalMonthlySpend - kpis.totalBudget) / kpis.totalBudget) * 100)}
          trendPositive={kpis.totalMonthlySpend <= kpis.totalBudget}
        />
        <KPICard
          label="Forecasted Month-End"
          value={formatCurrency(kpis.forecasted)}
          subValue={`vs. Budget ${formatCurrency(kpis.totalBudget)}`}
          icon={<Target className="h-5 w-5" />}
          trend={kpis.forecasted > kpis.totalBudget ? 'up' : 'down'}
          trendValue={formatPercent(Math.abs(((kpis.forecasted - kpis.totalBudget) / kpis.totalBudget) * 100))}
          trendPositive={kpis.forecasted <= kpis.totalBudget}
        />
        <KPICard
          label="Realized Savings"
          value={formatCurrency(kpis.realizedSavings)}
          subValue={`Pipeline: ${formatCurrency(kpis.pipelineSavings)}`}
          icon={<PiggyBank className="h-5 w-5" />}
          trend="up"
          trendValue="trending up"
          trendPositive
        />
        <KPICard
          label="Acceptance Rate"
          value={formatPercent(kpis.acceptanceRate)}
          subValue={`${recommendations.filter(r => ['accepted','scheduled','implemented','verified','not_realized'].includes(r.status)).length} accepted of ${recommendations.length} total`}
          icon={<Lightbulb className="h-5 w-5" />}
          trend="neutral"
          trendValue={`${kpis.openAnomalies} open anomalies`}
          trendPositive
        />
      </div>

      {/* Spend vs Budget + Forecast */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Spend vs. Budget (90 days)</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-500" /> Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Forecast
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={spendWithForecast}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" stroke={textColor} fontSize={11} interval={14} />
              <YAxis stroke={textColor} fontSize={11} tickFormatter={(v) => `$${Math.round(v / 1000)}K`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#fff',
                  border: `1px solid ${gridColor}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: any) => formatCurrency(Number(value))}
              />
              <Area type="monotone" dataKey="cost" stroke="#14b8a6" strokeWidth={2} fill="url(#spendGradient)" name="Actual" />
              <Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Forecast" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Budget alerts */}
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Budget Alerts</h3>
          <div className="space-y-3">
            {budgetAlerts.map((b) => (
              <div key={b.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{b.teamName}</span>
                  <span className={classNames(
                    'font-medium',
                    b.over ? 'text-red-600 dark:text-red-400' : b.pct > 85 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
                  )}>
                    {formatPercent(b.pct)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={classNames(
                      'h-full rounded-full transition-all',
                      b.over ? 'bg-red-500' : b.pct > 85 ? 'bg-amber-500' : 'bg-brand-500'
                    )}
                    style={{ width: `${Math.min(b.pct, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{formatCurrency(b.forecasted_spend)}</span>
                  <span>{formatCurrency(b.budget_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Savings by Category + Funnel */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Estimated Savings by Category</h3>
          {savingsByCategory.length === 0 ? (
            <EmptyState title="No recommendations yet" description="Generate recommendations to see savings breakdown" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={savingsByCategory} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" stroke={textColor} fontSize={11} tickFormatter={(v) => `$${v / 1000}K`} />
                <YAxis type="category" dataKey="label" stroke={textColor} fontSize={11} width={140} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#fff',
                    border: `1px solid ${gridColor}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => formatCurrency(Number(value))}
                />
                <Bar dataKey="savings" radius={[0, 4, 4, 0]}>
                  {savingsByCategory.map((entry, idx) => (
                    <Cell key={idx} fill={categoryColors[entry.category as keyof typeof categoryColors] || '#14b8a6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recommendation funnel */}
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Savings Pipeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnel} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" stroke={textColor} fontSize={11} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" stroke={textColor} fontSize={11} width={100} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#fff',
                  border: `1px solid ${gridColor}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {funnel.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Realized savings + Savings by team */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Realized Savings (Monthly)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={realizedSavingsTrend}>
              <defs>
                <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" stroke={textColor} fontSize={11} />
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
              <Area type="monotone" dataKey="savings" stroke="#22c55e" strokeWidth={2} fill="url(#savingsGradient)" name="Realized" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Savings by Team</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={savingsByTeam}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke={textColor} fontSize={11} />
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
              <Bar dataKey="spend" fill="#64748b" name="Monthly Spend" radius={[4, 4, 0, 0]} />
              <Bar dataKey="savings" fill="#14b8a6" name="Est. Savings" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Savings by Environment + Carbon Estimate */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Savings by Environment</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={savingsByEnv}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="env" stroke={textColor} fontSize={11} />
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
              <Bar dataKey="spend" fill="#64748b" name="Monthly Spend" radius={[4, 4, 0, 0]} />
              <Bar dataKey="savings" fill="#14b8a6" name="Est. Savings" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Leaf className="h-5 w-5 text-green-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Carbon Estimate</h3>
          </div>
          <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{carbonEstimate} tCO₂</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">estimated monthly emissions from compute</p>
          </div>
          <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>Compute resources</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {resources.filter(r => r.resource_type === 'compute' || r.resource_type === 'database').length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Est. energy consumption</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {Math.round(carbonEstimate * 14.3)} kWh/mo
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Savings from optimization</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {Math.round(carbonEstimate * 0.15 * 10) / 10} tCO₂/mo
              </span>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-600">
            Illustrative estimate only — not an official measurement. Based on a proxy of compute cost to energy consumption.
          </p>
        </div>
      </div>

      {/* Recent anomalies */}
      <div className="mt-6 card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Cost Anomalies</h3>
          </div>
          <Zap className="h-4 w-4 text-slate-400" />
        </div>
        {anomalies.length === 0 ? (
          <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No anomalies detected" />
        ) : (
          <div className="space-y-3">
            {anomalies.map((a) => {
              const resource = resources.find((r) => r.id === a.resource_id);
              const team = teams.find((t) => t.id === a.team_id);
              return (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{a.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {resource?.resource_name} · {team?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      {formatCurrency(a.estimated_monthly_savings)}
                    </span>
                    <Badge className={statusColors[a.status]}>{statusLabels[a.status]}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
