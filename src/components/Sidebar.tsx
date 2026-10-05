import { useState } from 'react';
import { Sun, Moon, Menu, X, TrendingDown, LayoutDashboard, Lightbulb, FileBarChart, Server, AlertTriangle, Wallet, ShieldCheck } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { classNames } from '@/lib/format';

export type PageId = 'dashboard' | 'recommendations' | 'savings-report' | 'resources' | 'anomalies' | 'budgets';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

const navItems: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
  { id: 'savings-report', label: 'Savings Confidence', icon: ShieldCheck },
  { id: 'resources', label: 'Resources', icon: Server },
  { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
  { id: 'budgets', label: 'Budgets', icon: Wallet },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (page: PageId) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 md:hidden">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-6 w-6 text-brand-600" />
          <span className="font-bold text-slate-900 dark:text-white">FinOps</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="btn-ghost p-2">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button onClick={() => setMobileOpen(true)} className="btn-ghost p-2">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={classNames(
        'fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-transform duration-200 md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
              <TrendingDown className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Commitment</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Optimizer</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="btn-ghost p-1.5 md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={classNames(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                )}
              >
                <Icon className={classNames('h-5 w-5 shrink-0', active ? 'text-brand-600 dark:text-brand-400' : '')} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Theme toggle + footer */}
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <p className="mt-3 px-3 text-xs text-slate-400 dark:text-slate-600">
            FinOps Platform v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
