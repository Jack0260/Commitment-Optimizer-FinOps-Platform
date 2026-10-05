// Seed script: generates 90 days of usage/cost data across 50 resources and 6 teams
// Run with: npx tsx src/seed/seed-data.ts
import { createClient } from '@supabase/supabase-js';

import { readFileSync } from 'fs';
const envFile = readFileSync('.env', 'utf-8');
const envVars: Record<string, string> = {};
envFile.split('\n').forEach((line) => {
  const [key, ...valParts] = line.split('=');
  if (key && valParts.length) envVars[key.trim()] = valParts.join('=').trim();
});
const SUPABASE_URL = envVars.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Deterministic pseudo-random for reproducible data
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
const rand = seededRandom(42);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randFloat = (min: number, max: number) => min + rand() * (max - min);
const randInt = (min: number, max: number) => Math.floor(randFloat(min, max + 1));

// ── Teams ──────────────────────────────────────────────────────────────────
const teams = [
  { name: 'Platform',     owner: 'Alice Chen',    monthly_budget: 45000, cost_center: 'CC-1001' },
  { name: 'Data',         owner: 'Bob Martinez',  monthly_budget: 38000, cost_center: 'CC-1002' },
  { name: 'ML/AI',        owner: 'Carol Johnson', monthly_budget: 52000, cost_center: 'CC-1003' },
  { name: 'Payments',     owner: 'David Kim',     monthly_budget: 30000, cost_center: 'CC-1004' },
  { name: 'Mobile',       owner: 'Emma Wilson',   monthly_budget: 18000, cost_center: 'CC-1005' },
  { name: 'Security',     owner: 'Frank Lee',     monthly_budget: 12000, cost_center: 'CC-1006' },
];

// ── Resource templates ─────────────────────────────────────────────────────
const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-2'];
const services: Record<string, string[]> = {
  compute: ['EC2 m5.2xlarge', 'EC2 c5.xlarge', 'EC2 r5.4xlarge', 'EC2 t3.medium', 'EC2 m5.large', 'EC2 c5.2xlarge', 'EC2 r5.xlarge'],
  storage: ['EBS gp3 1TB', 'EBS gp3 2TB', 'EBS st1 4TB', 'S3 Standard 500GB', 'EBS io2 1TB', 'S3 Standard 2TB'],
  database: ['RDS PostgreSQL db.r5.xlarge', 'RDS MySQL db.m5.large', 'Aurora PostgreSQL r5.large', 'DynamoDB', 'RDS PostgreSQL db.t3.medium'],
  serverless: ['Lambda 1M req', 'Lambda 5M req', 'Fargate 2 vCPU', 'Fargate 4 vCPU', 'Lambda 500K req'],
  network: ['NAT Gateway', 'Load Balancer ALB', 'CloudFront 10TB', 'VPC Endpoints', 'Route53'],
};

const resourceTemplates: { type: string; env: string; teamIdx: number; cost: number; tagIssues: boolean; usagePattern: string }[] = [
  // Platform team (idx 0) - 10 resources
  { type: 'compute', env: 'production', teamIdx: 0, cost: 4200, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'production', teamIdx: 0, cost: 2800, tagIssues: false, usagePattern: 'oversized' },
  { type: 'compute', env: 'staging', teamIdx: 0, cost: 1800, tagIssues: false, usagePattern: 'nonprod_247' },
  { type: 'compute', env: 'dev', teamIdx: 0, cost: 600, tagIssues: false, usagePattern: 'idle' },
  { type: 'storage', env: 'production', teamIdx: 0, cost: 900, tagIssues: false, usagePattern: 'steady' },
  { type: 'storage', env: 'production', teamIdx: 0, cost: 350, tagIssues: false, usagePattern: 'unattached' },
  { type: 'network', env: 'production', teamIdx: 0, cost: 1200, tagIssues: false, usagePattern: 'steady' },
  { type: 'database', env: 'production', teamIdx: 0, cost: 5400, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'production', teamIdx: 0, cost: 2200, tagIssues: true, usagePattern: 'underutilized' },
  { type: 'storage', env: 'dev', teamIdx: 0, cost: 200, tagIssues: false, usagePattern: 'storage_tier' },

  // Data team (idx 1) - 9 resources
  { type: 'compute', env: 'production', teamIdx: 1, cost: 3600, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'production', teamIdx: 1, cost: 4800, tagIssues: false, usagePattern: 'oversized' },
  { type: 'database', env: 'production', teamIdx: 1, cost: 6200, tagIssues: false, usagePattern: 'steady' },
  { type: 'storage', env: 'production', teamIdx: 1, cost: 1500, tagIssues: false, usagePattern: 'storage_tier' },
  { type: 'compute', env: 'staging', teamIdx: 1, cost: 1200, tagIssues: false, usagePattern: 'nonprod_247' },
  { type: 'compute', env: 'dev', teamIdx: 1, cost: 400, tagIssues: true, usagePattern: 'idle' },
  { type: 'storage', env: 'production', teamIdx: 1, cost: 280, tagIssues: false, usagePattern: 'unattached' },
  { type: 'network', env: 'production', teamIdx: 1, cost: 800, tagIssues: false, usagePattern: 'steady' },
  { type: 'database', env: 'staging', teamIdx: 1, cost: 2400, tagIssues: false, usagePattern: 'nonprod_247' },

  // ML/AI team (idx 2) - 10 resources
  { type: 'compute', env: 'production', teamIdx: 2, cost: 8400, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'production', teamIdx: 2, cost: 7200, tagIssues: false, usagePattern: 'oversized' },
  { type: 'compute', env: 'production', teamIdx: 2, cost: 9600, tagIssues: false, usagePattern: 'anomaly_spike' },
  { type: 'compute', env: 'staging', teamIdx: 2, cost: 3200, tagIssues: false, usagePattern: 'nonprod_247' },
  { type: 'storage', env: 'production', teamIdx: 2, cost: 2200, tagIssues: false, usagePattern: 'steady' },
  { type: 'storage', env: 'production', teamIdx: 2, cost: 600, tagIssues: false, usagePattern: 'unattached' },
  { type: 'database', env: 'production', teamIdx: 2, cost: 5800, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'dev', teamIdx: 2, cost: 900, tagIssues: true, usagePattern: 'idle' },
  { type: 'serverless', env: 'production', teamIdx: 2, cost: 300, tagIssues: false, usagePattern: 'steady' },
  { type: 'storage', env: 'production', teamIdx: 2, cost: 1800, tagIssues: false, usagePattern: 'storage_tier' },

  // Payments team (idx 3) - 8 resources
  { type: 'compute', env: 'production', teamIdx: 3, cost: 2600, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'production', teamIdx: 3, cost: 1800, tagIssues: false, usagePattern: 'underutilized' },
  { type: 'database', env: 'production', teamIdx: 3, cost: 3200, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'staging', teamIdx: 3, cost: 800, tagIssues: false, usagePattern: 'nonprod_247' },
  { type: 'storage', env: 'production', teamIdx: 3, cost: 500, tagIssues: false, usagePattern: 'storage_tier' },
  { type: 'network', env: 'production', teamIdx: 3, cost: 600, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'dev', teamIdx: 3, cost: 300, tagIssues: false, usagePattern: 'idle' },
  { type: 'serverless', env: 'production', teamIdx: 3, cost: 150, tagIssues: true, usagePattern: 'steady' },

  // Mobile team (idx 4) - 7 resources
  { type: 'compute', env: 'production', teamIdx: 4, cost: 1500, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'production', teamIdx: 4, cost: 1100, tagIssues: false, usagePattern: 'oversized' },
  { type: 'compute', env: 'staging', teamIdx: 4, cost: 500, tagIssues: false, usagePattern: 'nonprod_247' },
  { type: 'storage', env: 'production', teamIdx: 4, cost: 300, tagIssues: false, usagePattern: 'unattached' },
  { type: 'serverless', env: 'production', teamIdx: 4, cost: 200, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'dev', teamIdx: 4, cost: 200, tagIssues: false, usagePattern: 'idle' },
  { type: 'database', env: 'production', teamIdx: 4, cost: 1800, tagIssues: false, usagePattern: 'steady' },

  // Security team (idx 5) - 6 resources
  { type: 'compute', env: 'production', teamIdx: 5, cost: 1200, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'production', teamIdx: 5, cost: 800, tagIssues: true, usagePattern: 'underutilized' },
  { type: 'storage', env: 'production', teamIdx: 5, cost: 400, tagIssues: false, usagePattern: 'storage_tier' },
  { type: 'network', env: 'production', teamIdx: 5, cost: 900, tagIssues: false, usagePattern: 'steady' },
  { type: 'compute', env: 'staging', teamIdx: 5, cost: 300, tagIssues: false, usagePattern: 'nonprod_247' },
  { type: 'database', env: 'production', teamIdx: 5, cost: 1500, tagIssues: false, usagePattern: 'anomaly_spike' },
];

function generateDailyData(
  template: { type: string; env: string; cost: number; usagePattern: string },
  days: number,
  endDate: Date
) {
  const records: any[] = [];
  const dailyBase = template.cost / 30;

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWorkingHour = dayOfWeek >= 1 && dayOfWeek <= 5;

    let cost = dailyBase;
    let cpu: number | null = null;
    let memory: number | null = null;
    let storage: number | null = null;
    let network: number | null = null;
    let runningHours: number | null = null;
    let active = true;

    const noise = 1 + (rand() - 0.5) * 0.15;

    switch (template.usagePattern) {
      case 'steady':
        cost = dailyBase * noise;
        if (template.type === 'compute') {
          cpu = randFloat(45, 70);
          memory = randFloat(50, 75);
          runningHours = 24;
        }
        if (template.type === 'database') {
          cpu = randFloat(40, 65);
          memory = randFloat(55, 80);
          runningHours = 24;
        }
        if (template.type === 'storage') {
          storage = randFloat(800, 1200);
          network = randFloat(5, 20);
        }
        if (template.type === 'network') {
          network = randFloat(50, 200);
        }
        break;

      case 'oversized':
        cost = dailyBase * noise;
        if (template.type === 'compute') {
          cpu = randFloat(8, 22);
          memory = randFloat(12, 28);
          runningHours = 24;
        }
        if (template.type === 'database') {
          cpu = randFloat(10, 25);
          memory = randFloat(15, 30);
          runningHours = 24;
        }
        break;

      case 'underutilized':
        cost = dailyBase * noise;
        if (template.type === 'compute') {
          cpu = randFloat(15, 35);
          memory = randFloat(20, 40);
          runningHours = 24;
        }
        break;

      case 'idle':
        cost = dailyBase * (0.3 + rand() * 0.2);
        if (template.type === 'compute') {
          cpu = randFloat(0.5, 3);
          memory = randFloat(1, 5);
          runningHours = 24;
        }
        if (template.type === 'storage') {
          storage = randFloat(100, 200);
          network = randFloat(0, 0.5);
        }
        break;

      case 'nonprod_247':
        if (isWeekend || !isWorkingHour) {
          // Should be off but is running
          cost = dailyBase * (0.5 + rand() * 0.3);
          if (template.type === 'compute') {
            cpu = randFloat(2, 10);
            memory = randFloat(5, 15);
            runningHours = 24;
          }
          if (template.type === 'database') {
            cpu = randFloat(3, 12);
            memory = randFloat(8, 20);
            runningHours = 24;
          }
        } else {
          cost = dailyBase * noise;
          if (template.type === 'compute') {
            cpu = randFloat(25, 55);
            memory = randFloat(30, 60);
            runningHours = 24;
          }
          if (template.type === 'database') {
            cpu = randFloat(20, 50);
            memory = randFloat(30, 55);
            runningHours = 24;
          }
        }
        break;

      case 'unattached':
        cost = dailyBase * noise;
        storage = randFloat(500, 2000);
        network = 0;
        cpu = null;
        memory = null;
        runningHours = null;
        active = false;
        break;

      case 'storage_tier':
        cost = dailyBase * noise;
        storage = randFloat(1000, 3000);
        network = randFloat(0.1, 2); // Very low access - could move to infrequent access
        break;

      case 'anomaly_spike':
        // Normal with occasional spikes
        if (i < 75 && rand() < 0.08) {
          // Spike day
          cost = dailyBase * randFloat(3, 6);
          if (template.type === 'compute') {
            cpu = randFloat(85, 99);
            memory = randFloat(80, 95);
            runningHours = 24;
          }
          if (template.type === 'database') {
            cpu = randFloat(80, 98);
            memory = randFloat(85, 99);
            runningHours = 24;
          }
        } else {
          cost = dailyBase * noise;
          if (template.type === 'compute') {
            cpu = randFloat(45, 70);
            memory = randFloat(50, 75);
            runningHours = 24;
          }
          if (template.type === 'database') {
            cpu = randFloat(40, 65);
            memory = randFloat(50, 75);
            runningHours = 24;
          }
        }
        break;

      case 'steady_serverless':
        cost = dailyBase * noise;
        network = randFloat(1, 5);
        break;
    }

    records.push({
      date: date.toISOString().split('T')[0],
      cost: Math.round(cost * 100) / 100,
      cpu_utilization: cpu !== null ? Math.round(cpu * 10) / 10 : null,
      memory_utilization: memory !== null ? Math.round(memory * 10) / 10 : null,
      storage_gb: storage !== null ? Math.round(storage * 10) / 10 : null,
      network_gb: network !== null ? Math.round(network * 10) / 10 : null,
      running_hours: runningHours,
      active,
    });
  }

  return records;
}

async function seed() {
  console.log('Starting seed...');

  // 1. Insert teams
  const { data: teamData, error: teamErr } = await supabase
    .from('teams')
    .insert(teams)
    .select();
  if (teamErr) { console.error('Teams insert error:', teamErr); return; }
  console.log(`Inserted ${teamData.length} teams`);

  // 2. Insert resources
  const resources: any[] = [];
  resourceTemplates.forEach((t, idx) => {
    const service = pick(services[t.type] || ['Unknown']);
    const isTagged = !t.tagIssues;
    const tags = isTagged
      ? { team: teams[t.teamIdx].name, env: t.env, owner: teams[t.teamIdx].owner, project: `${teams[t.teamIdx].name}-main` }
      : {};

    resources.push({
      resource_name: `${t.type}-${t.teamIdx}-${idx}-${service.split(' ')[0]}`.toLowerCase(),
      resource_type: t.type,
      team_id: teamData[t.teamIdx].id,
      environment: t.env,
      region: pick(regions),
      provider: 'AWS',
      service,
      monthly_cost: t.cost,
      tags,
      is_tagged: isTagged,
    });
  });

  const { data: resourceData, error: resErr } = await supabase
    .from('cloud_resources')
    .insert(resources)
    .select();
  if (resErr) { console.error('Resources insert error:', resErr); return; }
  console.log(`Inserted ${resourceData.length} resources`);

  // 3. Insert 90 days of daily usage
  const endDate = new Date('2026-09-30');
  const DAYS = 90;
  const allUsage: any[] = [];

  resourceData.forEach((res: any, idx: number) => {
    const template = resourceTemplates[idx];
    const dailyRecords = generateDailyData(template, DAYS, endDate);
    dailyRecords.forEach((rec) => {
      allUsage.push({ ...rec, resource_id: res.id });
    });
  });

  // Insert in batches of 500
  for (let i = 0; i < allUsage.length; i += 500) {
    const batch = allUsage.slice(i, i + 500);
    const { error } = await supabase.from('daily_usage').insert(batch);
    if (error) { console.error(`Usage batch ${i} error:`, error); return; }
  }
  console.log(`Inserted ${allUsage.length} daily usage records`);

  // 4. Insert budgets (current month: October 2026, using September actuals)
  const months = ['2026-08', '2026-09', '2026-10'];
  const budgets: any[] = [];
  teamData.forEach((team: any) => {
    months.forEach((month) => {
      const budgetAmt = team.monthly_budget;
      // Actual spend varies - some teams over budget
      const variance = month === '2026-10' ? 0 : (rand() - 0.4) * 0.3;
      const actual = Math.round(budgetAmt * (1 + variance));
      const forecast = month === '2026-10'
        ? Math.round(budgetAmt * (1 + (rand() - 0.3) * 0.25))
        : actual;
      budgets.push({
        team_id: team.id,
        month,
        budget_amount: budgetAmt,
        actual_spend: actual,
        forecasted_spend: forecast,
      });
    });
  });

  const { error: budgetErr } = await supabase.from('budgets').insert(budgets);
  if (budgetErr) { console.error('Budgets insert error:', budgetErr); return; }
  console.log(`Inserted ${budgets.length} budget records`);

  // 5. Insert savings plans
  const savingsPlans = [
    { plan_name: 'Platform RI - Compute 1yr', provider: 'AWS', commitment_type: 'Reserved Instance', term_months: 12, monthly_commitment: 12000, start_date: '2026-01-01', end_date: '2026-12-31', coverage_resources: 5, discount_percent: 31 },
    { plan_name: 'ML/AI Savings Plan 3yr', provider: 'AWS', commitment_type: 'Compute Savings Plan', term_months: 36, monthly_commitment: 18000, start_date: '2025-06-01', end_date: '2028-05-31', coverage_resources: 4, discount_percent: 54 },
    { plan_name: 'Data RI - Database 1yr', provider: 'AWS', commitment_type: 'Reserved Instance', term_months: 12, monthly_commitment: 8000, start_date: '2026-03-01', end_date: '2027-02-28', coverage_resources: 3, discount_percent: 28 },
    { plan_name: 'Payments Savings Plan 1yr', provider: 'AWS', commitment_type: 'Compute Savings Plan', term_months: 12, monthly_commitment: 4000, start_date: '2026-01-01', end_date: '2026-12-31', coverage_resources: 2, discount_percent: 22 },
  ];

  const { error: planErr } = await supabase.from('savings_plans').insert(savingsPlans);
  if (planErr) { console.error('Savings plans insert error:', planErr); return; }
  console.log(`Inserted ${savingsPlans.length} savings plans`);

  console.log('Seed complete!');
}

seed().catch(console.error);
