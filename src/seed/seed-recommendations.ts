// Seed recommendations: runs the recommendation engine against seeded data
// Run with: npx tsx src/seed/seed-recommendations.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { generateRecommendations } from '../lib/recommendationEngine';

const envFile = readFileSync('.env', 'utf-8');
const envVars: Record<string, string> = {};
envFile.split('\n').forEach((line) => {
  const [key, ...valParts] = line.split('=');
  if (key && valParts.length) envVars[key.trim()] = valParts.join('=').trim();
});
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

async function seed() {
  console.log('Fetching data for recommendation engine...');

  const { data: resources } = await supabase.from('cloud_resources').select('*');
  const { data: teams } = await supabase.from('teams').select('*');
  const { data: budgets } = await supabase.from('budgets').select('*');
  const { data: existingRecs } = await supabase.from('recommendations').select('id');

  if (existingRecs && existingRecs.length > 0) {
    console.log(`Recommendations already exist (${existingRecs.length}). Clearing...`);
    await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('recommendations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  console.log('Fetching daily usage (paginated)...');
  const allUsage: any[] = [];
  let offset = 0;
  while (true) {
    const { data: batch, error: batchErr } = await supabase
      .from('daily_usage')
      .select('*')
      .range(offset, offset + 999);
    if (batchErr) { console.error('Usage fetch error:', batchErr); break; }
    if (!batch || batch.length === 0) break;
    allUsage.push(...batch);
    if (batch.length < 1000) break;
    offset += 1000;
  }
  const usage = allUsage;
  console.log(`Fetched ${usage.length} usage records`);
  if (!resources || !teams || !budgets || !usage.length) {
    console.error('Failed to fetch data');
    return;
  }

  console.log(`Generating recommendations from ${resources.length} resources, ${usage.length} usage records...`);
  const recs = generateRecommendations(resources, usage, teams, budgets);
  console.log(`Generated ${recs.length} recommendations`);

  // Insert recommendations
  for (const rec of recs) {
    const { error } = await supabase.from('recommendations').insert({
      ...rec,
      status: 'generated',
    });
    if (error) {
      console.error('Insert error for rec:', rec.title, error);
    }
  }

  // Add audit logs for generation
  const { data: insertedRecs } = await supabase.from('recommendations').select('id, owner, title');
  if (insertedRecs) {
    const logs = insertedRecs.map((r: any) => ({
      recommendation_id: r.id,
      actor: 'System (Recommendation Engine)',
      action: 'Recommendation generated',
      old_status: null,
      new_status: 'generated',
      notes: 'Automatically detected by the recommendation engine during analysis run.',
    }));
    for (let i = 0; i < logs.length; i += 500) {
      await supabase.from('audit_logs').insert(logs.slice(i, i + 500));
    }
  }

  // Simulate some workflow progress: randomly advance some recommendations
  if (insertedRecs) {
    const statuses: string[] = ['under_review', 'accepted', 'rejected', 'deferred', 'exception_requested', 'scheduled', 'implemented', 'verified', 'not_realized'];
    const actors = ['Alice Chen', 'Bob Martinez', 'Carol Johnson', 'David Kim', 'Emma Wilson', 'Frank Lee'];

    for (const rec of insertedRecs) {
      const rand = Math.random();
      let targetStatus = 'generated';

      if (rand < 0.15) targetStatus = 'under_review';
      else if (rand < 0.30) targetStatus = 'accepted';
      else if (rand < 0.38) targetStatus = 'rejected';
      else if (rand < 0.45) targetStatus = 'deferred';
      else if (rand < 0.50) targetStatus = 'exception_requested';
      else if (rand < 0.58) targetStatus = 'scheduled';
      else if (rand < 0.72) targetStatus = 'implemented';
      else if (rand < 0.85) targetStatus = 'verified';
      else if (rand < 0.90) targetStatus = 'not_realized';

      if (targetStatus === 'generated') continue;

      const actor = actors[Math.floor(Math.random() * actors.length)];
      const updates: Record<string, any> = {
        status: targetStatus,
        updated_at: new Date().toISOString(),
      };

      if (targetStatus === 'implemented') {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 30);
        updates.implemented_at = pastDate.toISOString();
        updates.measurement_start = pastDate.toISOString();
        updates.measurement_end = new Date().toISOString();
      }

      if (targetStatus === 'verified' || targetStatus === 'not_realized') {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 35);
        updates.implemented_at = pastDate.toISOString();
        updates.measurement_start = pastDate.toISOString();
        updates.measurement_end = new Date().toISOString();

        const { data: fullRec } = await supabase
          .from('recommendations')
          .select('estimated_monthly_savings')
          .eq('id', rec.id)
          .maybeSingle();
        const estimated = fullRec?.estimated_monthly_savings || 0;
        const factor = targetStatus === 'verified' ? (0.7 + Math.random() * 0.4) : (0.3 + Math.random() * 0.3);
        updates.measured_savings = Math.round(estimated * factor * 100) / 100;
      }

      await supabase.from('recommendations').update(updates).eq('id', rec.id);

      // Add audit log for the status change
      await supabase.from('audit_logs').insert({
        recommendation_id: rec.id,
        actor,
        action: `Status changed from generated to ${targetStatus}`,
        old_status: 'generated',
        new_status: targetStatus,
        notes: getWorkflowNote(targetStatus),
      });
    }
  }

  console.log('Recommendation seeding complete!');
}

function getWorkflowNote(status: string): string {
  const notes: Record<string, string> = {
    under_review: 'Owner is reviewing the recommendation details and assessing impact.',
    accepted: 'Owner approved the recommendation and scheduled it for implementation.',
    rejected: 'Owner rejected — workload requirements do not allow this optimization.',
    deferred: 'Deferred to next quarter due to competing priorities.',
    exception_requested: 'Owner requested an exception due to compliance requirements.',
    scheduled: 'Change scheduled for the next maintenance window.',
    implemented: 'Change has been implemented. Measurement window started.',
    verified: 'Savings verified through post-implementation cost measurement.',
    not_realized: 'Expected savings did not materialize — workload increased after change.',
  };
  return notes[status] || '';
}

seed().catch(console.error);
