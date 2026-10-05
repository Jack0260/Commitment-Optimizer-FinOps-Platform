import type { CloudResource, DailyUsage, Team, Budget, RecCategory, ConfidenceLevel, RiskLevel, ApprovalReq } from './types';

export interface GeneratedRecommendation {
  resource_id: string;
  team_id: string;
  category: RecCategory;
  title: string;
  description: string;
  current_monthly_cost: number;
  estimated_monthly_savings: number;
  confidence: ConfidenceLevel;
  risk_level: RiskLevel;
  required_downtime_hours: number;
  owner: string;
  approval_required: ApprovalReq;
  performance_impact: string;
  estimated_payback_days: number;
  assumptions: string;
}

interface ResourceWithUsage {
  resource: CloudResource;
  usage: DailyUsage[];
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(-n);
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

function isOutsideWorkingHours(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  const hour = new Date(dateStr).getHours();
  return day === 0 || day === 6 || hour < 8 || hour >= 18;
}

export function generateRecommendations(
  resources: CloudResource[],
  usageData: DailyUsage[],
  teams: Team[],
  budgets: Budget[]
): GeneratedRecommendation[] {
  const recs: GeneratedRecommendation[] = [];
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const usageByResource = new Map<string, DailyUsage[]>();
  usageData.forEach((u) => {
    if (!usageByResource.has(u.resource_id)) usageByResource.set(u.resource_id, []);
    usageByResource.get(u.resource_id)!.push(u);
  });

  const items: ResourceWithUsage[] = resources.map((r) => ({
    resource: r,
    usage: (usageByResource.get(r.id) || []).sort((a, b) => a.date.localeCompare(b.date)),
  }));

  for (const { resource, usage } of items) {
    if (usage.length === 0) continue;
    const team = teamMap.get(resource.team_id);
    const owner = resource.tags?.owner || team?.owner || 'Unassigned';
    const dailyCost = resource.monthly_cost / 30;

    // ── Idle compute ────────────────────────────────────────────────────────
    if (resource.resource_type === 'compute' || resource.resource_type === 'database') {
      const recentUsage = lastN(usage, 30);
      const cpuValues = recentUsage.map((u) => u.cpu_utilization).filter((v): v is number => v !== null);
      const memValues = recentUsage.map((u) => u.memory_utilization).filter((v): v is number => v !== null);

      if (cpuValues.length > 0) {
        const avgCpu = avg(cpuValues);
        const avgMem = avg(memValues);

        if (avgCpu < 5 && avgMem < 10) {
          const savings = resource.monthly_cost * 0.95;
          recs.push({
            resource_id: resource.id,
            team_id: resource.team_id,
            category: 'idle_compute',
            title: `Terminate idle resource: ${resource.resource_name}`,
            description: `${resource.service} has averaged ${avgCpu.toFixed(1)}% CPU and ${avgMem.toFixed(1)}% memory utilization over the last 30 days. This resource appears to be completely idle and can be terminated.`,
            current_monthly_cost: resource.monthly_cost,
            estimated_monthly_savings: Math.round(savings * 100) / 100,
            confidence: 'high',
            risk_level: 'low',
            required_downtime_hours: 0,
            owner,
            approval_required: 'manager',
            performance_impact: 'None expected — resource is idle with negligible utilization.',
            estimated_payback_days: 0,
            assumptions: 'Assumes resource is truly idle (CPU < 5%, memory < 10% for 30 consecutive days). Verify no scheduled batch jobs or standby roles before terminating.',
          });
        }
      }
    }

    // ── Underutilized instances ─────────────────────────────────────────────
    if (resource.resource_type === 'compute' || resource.resource_type === 'database') {
      const recentUsage = lastN(usage, 30);
      const cpuValues = recentUsage.map((u) => u.cpu_utilization).filter((v): v is number => v !== null);

      if (cpuValues.length > 0) {
        const avgCpu = avg(cpuValues);

        if (avgCpu >= 5 && avgCpu < 30) {
          const savings = resource.monthly_cost * 0.4;
          recs.push({
            resource_id: resource.id,
            team_id: resource.team_id,
            category: 'underutilized',
            title: `Rightsize underutilized instance: ${resource.resource_name}`,
            description: `${resource.service} has averaged ${avgCpu.toFixed(1)}% CPU utilization over 30 days. Consider downsizing to a smaller instance type that better matches the actual workload.`,
            current_monthly_cost: resource.monthly_cost,
            estimated_monthly_savings: Math.round(savings * 100) / 100,
            confidence: 'medium',
            risk_level: 'medium',
            required_downtime_hours: resource.resource_type === 'database' ? 2 : 1,
            owner,
            approval_required: 'manager',
            performance_impact: `Moderate — CPU headroom reduced from ~${(100 - avgCpu).toFixed(0)}% to ~${(100 - avgCpu * 2).toFixed(0)}%. Monitor for latency spikes after resize.`,
            estimated_payback_days: Math.round(dailyCost > 0 ? resource.monthly_cost / (savings / 30) : 0),
            assumptions: 'Assumes a smaller instance tier is available at ~60% of current cost. Validate that memory and network requirements are also met by the smaller tier.',
          });
        }
      }
    }

    // ── Oversized instances ─────────────────────────────────────────────────
    if (resource.resource_type === 'compute' || resource.resource_type === 'database') {
      const recentUsage = lastN(usage, 30);
      const cpuValues = recentUsage.map((u) => u.cpu_utilization).filter((v): v is number => v !== null);
      const memValues = recentUsage.map((u) => u.memory_utilization).filter((v): v is number => v !== null);

      if (cpuValues.length > 0 && memValues.length > 0) {
        const avgCpu = avg(cpuValues);
        const avgMem = avg(memValues);

        if (avgCpu < 25 && avgMem < 35) {
          const savings = resource.monthly_cost * 0.55;
          recs.push({
            resource_id: resource.id,
            team_id: resource.team_id,
            category: 'oversized',
            title: `Downsize oversized instance: ${resource.resource_name}`,
            description: `${resource.service} shows consistently low utilization (${avgCpu.toFixed(1)}% CPU, ${avgMem.toFixed(1)}% memory). This instance is significantly over-provisioned and can be downsized by 2 tiers.`,
            current_monthly_cost: resource.monthly_cost,
            estimated_monthly_savings: Math.round(savings * 100) / 100,
            confidence: 'high',
            risk_level: 'medium',
            required_downtime_hours: resource.resource_type === 'database' ? 4 : 2,
            owner,
            approval_required: 'architect',
            performance_impact: `Low to moderate — current peak utilization is well below capacity. After downsizing, peak CPU may reach ~${(avgCpu * 3).toFixed(0)}%. Validate during next peak event.`,
            estimated_payback_days: Math.round(dailyCost > 0 ? resource.monthly_cost / (savings / 30) : 0),
            assumptions: 'Assumes a 2-tier-smaller instance is available at ~45% of current cost. Peak workload should fit within 50% of the smaller instance capacity.',
          });
        }
      }
    }

    // ── Unattached storage ──────────────────────────────────────────────────
    if (resource.resource_type === 'storage') {
      const recentUsage = lastN(usage, 14);
      const networkValues = recentUsage.map((u) => u.network_gb).filter((v): v is number => v !== null);
      const allInactive = recentUsage.every((u) => !u.active);

      if (allInactive || (networkValues.length > 0 && avg(networkValues) < 0.01)) {
        const savings = resource.monthly_cost * 0.9;
        recs.push({
          resource_id: resource.id,
          team_id: resource.team_id,
          category: 'unattached_storage',
          title: `Delete unattached storage: ${resource.resource_name}`,
          description: `${resource.service} shows no I/O activity in the last 14 days and is marked as inactive. This volume appears to be unattached and can be snapshot-then-deleted.`,
          current_monthly_cost: resource.monthly_cost,
          estimated_monthly_savings: Math.round(savings * 100) / 100,
          confidence: 'high',
            risk_level: 'low',
            required_downtime_hours: 0,
            owner,
            approval_required: 'auto',
            performance_impact: 'None — storage is unattached with no I/O.',
            estimated_payback_days: 0,
            assumptions: 'Assumes storage is truly unattached. Create a snapshot before deletion as a safety net. Verify no pending reattachment or migration plans.',
        });
      }
    }

    // ── Storage tier optimization ───────────────────────────────────────────
    if (resource.resource_type === 'storage') {
      const recentUsage = lastN(usage, 30);
      const networkValues = recentUsage.map((u) => u.network_gb).filter((v): v is number => v !== null);

      if (networkValues.length > 0) {
        const avgNetwork = avg(networkValues);
        const storageValues = recentUsage.map((u) => u.storage_gb).filter((v): v is number => v !== null);
        const avgStorage = storageValues.length > 0 ? avg(storageValues) : 0;

        if (avgNetwork > 0 && avgNetwork < 3 && avgStorage > 500 && resource.service.includes('S3')) {
          const savings = resource.monthly_cost * 0.45;
          recs.push({
            resource_id: resource.id,
            team_id: resource.team_id,
            category: 'storage_tier',
            title: `Move to infrequent access tier: ${resource.resource_name}`,
            description: `${resource.service} has ${avgStorage.toFixed(0)}GB of data with only ${avgNetwork.toFixed(2)}GB/day network activity. This data is infrequently accessed and should move to S3 Infrequent Access for 40% cost reduction.`,
            current_monthly_cost: resource.monthly_cost,
            estimated_monthly_savings: Math.round(savings * 100) / 100,
            confidence: 'high',
            risk_level: 'low',
            required_downtime_hours: 0,
            owner,
            approval_required: 'auto',
            performance_impact: 'Minimal — retrieval latency increases from ms to seconds for infrequent access. Suitable for backup, archive, and compliance data.',
            estimated_payback_days: 0,
            assumptions: 'Assumes access pattern remains infrequent (< 3GB/day). If access frequency increases, IA tier becomes more expensive than standard. Review quarterly.',
          });
        }

        if (avgNetwork > 0 && avgNetwork < 0.5 && resource.service.includes('EBS')) {
          const savings = resource.monthly_cost * 0.35;
          recs.push({
            resource_id: resource.id,
            team_id: resource.team_id,
            category: 'storage_tier',
            title: `Downgrade EBS volume type: ${resource.resource_name}`,
            description: `${resource.service} shows very low I/O activity (${avgNetwork.toFixed(2)}GB/day). Consider downgrading from gp3 to st1 (HDD-backed) for 35% cost savings.`,
            current_monthly_cost: resource.monthly_cost,
            estimated_monthly_savings: Math.round(savings * 100) / 100,
            confidence: 'medium',
            risk_level: 'low',
            required_downtime_hours: 0,
            owner,
            approval_required: 'manager',
            performance_impact: 'Low — IOPS will decrease significantly. Only suitable for sequential workloads like logs, backups, and data lakes.',
            estimated_payback_days: 0,
            assumptions: 'Assumes workload is sequential and does not require high IOPS. Validate that no random-access database or application depends on this volume.',
          });
        }
      }
    }

    // ── Non-production scheduling ───────────────────────────────────────────
    if ((resource.resource_type === 'compute' || resource.resource_type === 'database') &&
        (resource.environment === 'staging' || resource.environment === 'dev')) {
      const weekendUsage = usage.filter((u) => isWeekend(u.date));
      const weekendRunning = weekendUsage.filter((u) => u.running_hours !== null && u.running_hours > 0);

      if (weekendUsage.length > 0 && weekendRunning.length / weekendUsage.length > 0.7) {
        const weekdayOffHours = usage.filter((u) => {
          const day = new Date(u.date).getDay();
          return day >= 1 && day <= 5 && u.running_hours !== null && u.running_hours > 0;
        });

        // Calculate savings: 48 weekend hours + ~10 weekday off-hours = 58 hours/week saved
        const hoursSavedPerWeek = 58;
        const weeklyCost = resource.monthly_cost / 4.33;
        const hourlyCost = weeklyCost / (24 * 7);
        const weeklySavings = hourlyCost * hoursSavedPerWeek;
        const monthlySavings = weeklySavings * 4.33;

        recs.push({
          resource_id: resource.id,
          team_id: resource.team_id,
          category: 'nonprod_scheduling',
          title: `Schedule non-prod resource off-hours: ${resource.resource_name}`,
          description: `${resource.service} in ${resource.environment} is running 24/7 including weekends and after-hours. Implement auto-scheduling to stop during off-hours (7pm-7am weekdays, all weekend) for ~${hoursSavedPerWeek}h/week savings.`,
          current_monthly_cost: resource.monthly_cost,
          estimated_monthly_savings: Math.round(monthlySavings * 100) / 100,
          confidence: 'high',
          risk_level: 'low',
          required_downtime_hours: 0,
          owner,
          approval_required: 'auto',
          performance_impact: 'None during business hours. Resource will be unavailable outside working hours — ensure no overnight batch jobs or deployments depend on it.',
          estimated_payback_days: 0,
          assumptions: `Assumes ${hoursSavedPerWeek} hours/week can be saved (weekends + weekday evenings). Resource can be started/stopped automatically via scheduler. No impact during 7am-7pm business hours.`,
        });
      }
    }

    // ── Cost anomalies ──────────────────────────────────────────────────────
    if (resource.resource_type === 'compute' || resource.resource_type === 'database') {
      const recentUsage = lastN(usage, 90);
      if (recentUsage.length >= 30) {
        const costs = recentUsage.map((u) => u.cost);
        const avgCost = avg(costs);
        const stdDev = Math.sqrt(avg(costs.map((c) => (c - avgCost) ** 2)));
        const recent30 = lastN(costs, 30);
        const maxRecent = Math.max(...recent30);

        if (stdDev > 0 && maxRecent > avgCost + 3 * stdDev) {
          const spikeDate = recentUsage[recentUsage.length - 30 + recent30.indexOf(maxRecent)]?.date;
          const anomalyCost = maxRecent * 30 - avgCost * 30;
          recs.push({
            resource_id: resource.id,
            team_id: resource.team_id,
            category: 'cost_anomaly',
            title: `Investigate cost anomaly: ${resource.resource_name}`,
            description: `Detected a cost spike on ${spikeDate} — daily cost reached $${maxRecent.toFixed(2)} vs. the 90-day average of $${avgCost.toFixed(2)} (>${(maxRecent / avgCost).toFixed(1)}x normal). Investigate root cause: unexpected traffic, runaway process, or misconfigured auto-scaling.`,
            current_monthly_cost: resource.monthly_cost,
            estimated_monthly_savings: Math.round(anomalyCost * 100) / 100,
            confidence: 'medium',
            risk_level: 'medium',
            required_downtime_hours: 0,
            owner,
            approval_required: 'manager',
            performance_impact: 'Investigation only — no infrastructure change required unless a misconfiguration is found.',
            estimated_payback_days: 0,
            assumptions: 'Assumes the anomaly is caused by a fixable issue (not legitimate traffic growth). If the spike represents real demand, no savings are achievable and the budget should be adjusted instead.',
          });
        }
      }
    }

    // ── Untagged resources ──────────────────────────────────────────────────
    if (!resource.is_tagged || !resource.tags || Object.keys(resource.tags || {}).length === 0) {
      recs.push({
        resource_id: resource.id,
        team_id: resource.team_id,
        category: 'untagged',
        title: `Add missing tags: ${resource.resource_name}`,
        description: `${resource.service} (${resource.resource_type}) has no resource tags. Without tags, cost allocation, ownership tracking, and governance are impossible. Add required tags: team, owner, environment, project, cost-center.`,
        current_monthly_cost: resource.monthly_cost,
        estimated_monthly_savings: 0,
        confidence: 'high',
        risk_level: 'low',
        required_downtime_hours: 0,
        owner,
        approval_required: 'auto',
        performance_impact: 'None — tagging is a metadata operation with no runtime impact.',
        estimated_payback_days: 0,
        assumptions: 'No direct savings, but enables cost attribution and prevents orphaned resources. Tagging policy enforcement will prevent future untagged resources.',
      });
    }

    // ── Commitment / savings plan candidates ────────────────────────────────
    if (resource.resource_type === 'compute' && resource.environment === 'production') {
      const recentUsage = lastN(usage, 60);
      const runningHours = recentUsage.map((u) => u.running_hours).filter((v): v is number => v !== null);
      if (runningHours.length > 0) {
        const avgHours = avg(runningHours);
        if (avgHours >= 23) {
          // Check if already covered by a savings plan (skip for now - all prod compute gets this)
          const savings = resource.monthly_cost * 0.30; // 30% discount from RI
          recs.push({
            resource_id: resource.id,
            team_id: resource.team_id,
            category: 'commitment',
            title: `Purchase Reserved Instance for: ${resource.resource_name}`,
            description: `${resource.service} runs ${avgHours.toFixed(0)}h/day in production — a steady-state workload ideal for a 1-year Reserved Instance or Compute Savings Plan. Committing to this instance saves ~30% vs. on-demand pricing.`,
            current_monthly_cost: resource.monthly_cost,
            estimated_monthly_savings: Math.round(savings * 100) / 100,
            confidence: 'high',
            risk_level: 'low',
            required_downtime_hours: 0,
            owner,
            approval_required: 'architect',
            performance_impact: 'None — Reserved Instances are a billing construct, not an infrastructure change. The instance continues running exactly as before.',
            estimated_payback_days: 0,
            assumptions: 'Assumes the workload will run continuously for the next 12 months. If the workload is temporary or expected to be migrated, a 1-year commitment may not be optimal. Consider a Convertible RI for flexibility.',
          });
        }
      }
    }
  }

  // ── Budget risk (per team) ────────────────────────────────────────────────
  const currentMonth = '2026-10';
  const currentBudgets = budgets.filter((b) => b.month === currentMonth);
  for (const budget of currentBudgets) {
    if (budget.forecasted_spend > budget.budget_amount * 1.05) {
      const team = teamMap.get(budget.team_id);
      const overrun = budget.forecasted_spend - budget.budget_amount;
      const teamResources = resources.filter((r) => r.team_id === budget.team_id);
      const topResource = teamResources.sort((a, b) => b.monthly_cost - a.monthly_cost)[0];

      recs.push({
        resource_id: topResource?.id || teamResources[0]?.id || resources[0].id,
        team_id: budget.team_id,
        category: 'budget_risk',
        title: `Budget risk alert: ${team?.name} team projected to exceed October budget`,
        description: `${team?.name} is forecasted to spend $${budget.forecasted_spend.toLocaleString()} against a $${budget.budget_amount.toLocaleString()} budget — a projected overrun of $${overrun.toLocaleString()} (${((overrun / budget.budget_amount) * 100).toFixed(1)}%). Immediate action: review top-cost resources, implement pending recommendations, and consider temporary resource reductions.`,
        current_monthly_cost: budget.forecasted_spend,
        estimated_monthly_savings: Math.round(overrun * 100) / 100,
        confidence: 'medium',
        risk_level: 'high',
        required_downtime_hours: 0,
        owner: team?.owner || 'Unassigned',
        approval_required: 'architect',
        performance_impact: 'Varies — depends on which cost reduction actions are taken. Prioritize non-production scheduling and idle resource termination to minimize production impact.',
        estimated_payback_days: 0,
        assumptions: `Forecast based on ${currentMonth} run-rate. If spend trajectory continues, budget will be exceeded by end of month. Actual overrun may differ if usage patterns change.`,
      });
    }
  }

  return recs;
}
