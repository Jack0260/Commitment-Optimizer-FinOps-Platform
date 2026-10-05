import { ReactNode } from 'react';
import { classNames } from '@/lib/format';

interface KPICardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  trendPositive?: boolean;
}

export function KPICard({ label, value, subValue, icon, trend, trendValue, trendPositive }: KPICardProps) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          {subValue && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subValue}</p>
          )}
        </div>
        {icon && (
          <div className="ml-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
            {icon}
          </div>
        )}
      </div>
      {trend && trendValue && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className={classNames(
            'font-medium',
            trendPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}
