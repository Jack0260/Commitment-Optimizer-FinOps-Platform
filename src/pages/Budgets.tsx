import { useMemo } from 'react';
import { Wallet, TrendingUp, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, ReferenceLine,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { KPICard } from '@/components/KPICard';
import { Badge } from '@/components/Badge';
import { useTheme } from '@/lib/theme';
import { formatCurrency, formatPercent, classNames } from '@/lib/format';
import type { Team, CloudResource, Budget } from '@/lib/types';

interface BudgetsProps {
  teams: Team[];
  resources: CloudResource[];
  budgets: Budget[];
}

export function Budgets({ teams, resources, budgets }: BudgetsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Current month budgets with team info
  const currentMonth = '2026-10';
  const currentBudgets = useMemo(() => {
    return budgets
      .filter((b) => b.month === currentMonth)
      .map((b) => {
        const team = teamMap.get(b.team_id);
        const pct = (b.forecasted_spend / b.budget_amount) * 100;
        const variance = b.forecasted_spend - b.budget_amount;
        return { ...b, teamName: team?.name || 'Unknown', owner: team?.owner || '', pct, variance, over: pct > 100 };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, teamMap]);

  // KPIs
  const totalBudget = currentBudgets.reduce((s, b) => s + b.budget_amount, 0);
  const totalForecast = currentBudgets.reduce((s, b) => s + b.forecasted_spend, 0);
  const overBudgetTeams = currentBudgets.filter((b) => b.over).length;
  const totalVariance = totalForecast - totalBudget;

  // 3-month trend per team
  const trendData = useMemo(() => {
    const months = ['2026-08', '2026-09', '2026-10'];
    return months.map((month) => {
      const entry: Record<string, number | string> = { month: month.slice(5) };
      teams.forEach((t) => {
        const budget = budgets.find((b) => b.team_id === t.id && b.month === month);
        entry[t.name] = budget ? Math.round(budget.actual_spend) : 0;
        entry[`${t.name}_budget`] = budget ? Math.round(budget.budget_amount) : 0;
      });
      return entry;
    });
  }, [budgets, teams]);

  // Budget vs forecast chart
  const budgetVsForecast = currentBudgets.map((b) => ({
    name: b.teamName,
    Budget: Math.round(b.budget_amount),
    Forecast: Math.round(b.forecasted_spend),
    Actual: Math.round(b.actual_spend),
  }));

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Monthly budget tracking, forecast, and variance analysis"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Monthly Budget"
          value={formatCurrency(totalBudget)}
          subValue={`${teams.length} teams`}
          icon={<Wallet className="h-5 w-5" />}
        />
        <KPICard
          label="Forecasted Spend"
          value={formatCurrency(totalForecast)}
          subValue={`Variance: ${formatCurrency(totalVariance)}`}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={totalVariance > 0 ? 'up' : 'down'}
          trendValue={formatPercent(Math.abs((totalVariance / totalBudget) * 100))}
          trendPositive={totalVariance <= 0}
        />
        <KPICard
          label="Over Budget"
          value={`${overBudgetTeams}`}
          subValue={`of ${teams.length} teams projected over`}
          icon={<AlertCircle className="h-5 w-5" />}
          trendPositive={overBudgetTeams === 0}
        />
        <KPICard
          label="Budget Utilization"
          value={formatPercent((totalForecast / totalBudget) * 100)}
          subValue={totalForecast > totalBudget ? 'Over budget' : 'Within budget'}
          icon={<Wallet className="h-5 w-5" />}
          trendPositive={totalForecast <= totalBudget}
        />
      </div>

      {/* Budget vs Forecast chart */}
      <div className="mt-6 card p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Budget vs. Forecast by Team (October 2026)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={budgetVsForecast}>
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
            <Bar dataKey="Budget" fill="#64748b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Forecast" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Actual" fill="#14b8a6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 3-month trend */}
      <div className="mt-6 card p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">3-Month Spend Trend by Team</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData}>
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
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {teams.map((t, i) => {
              const colors = ['#14b8a6', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
              return (
                <Line
                  key={t.id}
                  type="monotone"
                  dataKey={t.name}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Budget table */}
      <div className="mt-6 card p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Budget Status by Team</h3>
        <div className="space-y-4">
          {currentBudgets.map((b) => (
            <div key={b.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{b.teamName}</span>
                  <span className="ml-2 text-xs text-slate-400">Owner: {b.owner}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatCurrency(b.forecasted_spend)} / {formatCurrency(b.budget_amount)}
                  </span>
                  <Badge className={b.over
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : b.pct > 85
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  }>
                    {formatPercent(b.pct)}
                  </Badge>
                </div>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={classNames(
                    'h-full rounded-full transition-all',
                    b.over ? 'bg-red-500' : b.pct > 85 ? 'bg-amber-500' : 'bg-brand-500'
                  )}
                  style={{ width: `${Math.min(b.pct, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={classNames(
                  'font-medium',
                  b.variance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                )}>
                  {b.variance > 0 ? '+' : ''}{formatCurrency(b.variance)} variance
                </span>
                <span className="text-slate-400">
                  Actual: {formatCurrency(b.actual_spend)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
