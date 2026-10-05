import { useState, useMemo } from 'react';
import { Search, Server, Filter } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { formatCurrency, environmentLabels, resourceTypeLabels, classNames } from '@/lib/format';
import type { Team, CloudResource, Recommendation } from '@/lib/types';

interface ResourcesProps {
  teams: Team[];
  resources: CloudResource[];
  recommendations: Recommendation[];
}

export function Resources({ teams, resources, recommendations }: ResourcesProps) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [envFilter, setEnvFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const recsByResource = useMemo(() => {
    const map = new Map<string, number>();
    recommendations.forEach((r) => map.set(r.resource_id, (map.get(r.resource_id) || 0) + 1));
    return map;
  }, [recommendations]);

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (search && !r.resource_name.toLowerCase().includes(search.toLowerCase()) && !r.service.toLowerCase().includes(search.toLowerCase())) return false;
      if (teamFilter !== 'all' && r.team_id !== teamFilter) return false;
      if (envFilter !== 'all' && r.environment !== envFilter) return false;
      if (typeFilter !== 'all' && r.resource_type !== typeFilter) return false;
      return true;
    });
  }, [resources, search, teamFilter, envFilter, typeFilter]);

  const totalCost = filtered.reduce((s, r) => s + r.monthly_cost, 0);
  const activeFilterCount = [teamFilter, envFilter, typeFilter].filter((f) => f !== 'all').length;

  return (
    <div>
      <PageHeader
        title="Cloud Resources"
        description={`${resources.length} resources · ${formatCurrency(resources.reduce((s, r) => s + r.monthly_cost, 0))} total monthly cost`}
      />

      {/* Search + filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search resources..."
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
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Team</label>
            <select className="input w-full" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="all">All Teams</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Environment</label>
            <select className="input w-full" value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}>
              <option value="all">All Environments</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="dev">Dev</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
            <select className="input w-full" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              <option value="compute">Compute</option>
              <option value="storage">Storage</option>
              <option value="database">Database</option>
              <option value="serverless">Serverless</option>
              <option value="network">Network</option>
            </select>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-100 px-4 py-2.5 dark:bg-slate-800/50">
        <span className="text-sm text-slate-600 dark:text-slate-300">
          Showing <strong className="text-slate-900 dark:text-white">{filtered.length}</strong> resources
        </span>
        <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
          {formatCurrency(totalCost)}/mo
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Server className="h-6 w-6" />} title="No resources found" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Resource</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Environment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Region</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Monthly Cost</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Tags</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Recs</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const team = teamMap.get(r.team_id);
                  const recCount = recsByResource.get(r.id) || 0;
                  return (
                    <tr key={r.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{r.resource_name}</p>
                        <p className="text-xs text-slate-400">{r.service}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {resourceTypeLabels[r.resource_type as keyof typeof resourceTypeLabels] || r.resource_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{team?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className={r.environment === 'production' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : r.environment === 'staging' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}>
                          {environmentLabels[r.environment as keyof typeof environmentLabels] || r.environment}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{r.region}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">{formatCurrency(r.monthly_cost)}</td>
                      <td className="px-4 py-3 text-center">
                        {r.is_tagged ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Tagged</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Untagged</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {recCount > 0 ? (
                          <Badge className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{recCount}</Badge>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
