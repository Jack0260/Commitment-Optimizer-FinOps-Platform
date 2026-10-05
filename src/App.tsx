import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@/lib/theme';
import { Sidebar, PageId } from '@/components/Sidebar';
import { Dashboard } from '@/pages/Dashboard';
import { Recommendations } from '@/pages/Recommendations';
import { SavingsReport } from '@/pages/SavingsReport';
import { Resources } from '@/pages/Resources';
import { Anomalies } from '@/pages/Anomalies';
import { Budgets } from '@/pages/Budgets';
import {
  fetchTeams, fetchResources, fetchBudgets,
  fetchRecommendations, fetchDailyUsage,
} from '@/lib/data';
import type { Team, CloudResource, Budget, Recommendation, DailyUsage } from '@/lib/types';

function AppContent() {
  const [page, setPage] = useState<PageId>('dashboard');
  const [teams, setTeams] = useState<Team[]>([]);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [usageData, setUsageData] = useState<DailyUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [t, r, b, recs] = await Promise.all([
        fetchTeams(),
        fetchResources(),
        fetchBudgets(),
        fetchRecommendations(),
      ]);
      setTeams(t);
      setResources(r);
      setBudgets(b);
      setRecommendations(recs);

      // Fetch usage data only for dashboard (it's large)
      if (page === 'dashboard' && usageData.length === 0) {
        const usage = await fetchDailyUsage();
        setUsageData(usage);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [page, usageData.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    fetchRecommendations().then(setRecommendations).catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600 dark:border-slate-800 dark:border-t-brand-400" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading FinOps data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center max-w-md">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error}</p>
          <button onClick={() => { setError(null); setLoading(true); loadData(); }} className="btn-primary mt-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <main className="md:ml-64 pt-14 md:pt-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {page === 'dashboard' && (
            <Dashboard
              teams={teams}
              resources={resources}
              budgets={budgets}
              recommendations={recommendations}
              usageData={usageData}
            />
          )}
          {page === 'recommendations' && (
            <Recommendations
              teams={teams}
              resources={resources}
              recommendations={recommendations}
              onRefresh={handleRefresh}
            />
          )}
          {page === 'savings-report' && (
            <SavingsReport teams={teams} recommendations={recommendations} />
          )}
          {page === 'resources' && (
            <Resources teams={teams} resources={resources} recommendations={recommendations} />
          )}
          {page === 'anomalies' && (
            <Anomalies teams={teams} resources={resources} recommendations={recommendations} />
          )}
          {page === 'budgets' && (
            <Budgets teams={teams} resources={resources} budgets={budgets} />
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
