#!/usr/bin/env node
/**
 * audit-nsm-conversion-funnel.js — C-T2 read-only analytics
 *
 * Queries nsm_sessions via service-role to build a full conversion funnel.
 * NO mutations. Read-only.
 *
 * Run: node scripts/audit-nsm-conversion-funnel.js
 */
'use strict';

require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: false });

const db = require('../db/client');

async function fetchAll(query, pageSize = 1000) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function median(arr) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function minutesDiff(a, b) {
  return Math.abs(new Date(b) - new Date(a)) / 60000;
}

function isNonEmpty(v) {
  if (!v) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'object') {
    return Object.values(v).some((x) => typeof x === 'string' && x.trim().length > 0);
  }
  return false;
}

(async () => {
  console.log('C-T2 NSM Conversion Funnel Audit — ' + new Date().toISOString());
  console.log('='.repeat(70));

  // Fetch all sessions with needed columns
  const allRows = await fetchAll(
    db.from('nsm_sessions').select(
      'id, user_id, guest_id, lifecycle, status, user_nsm, user_breakdown, scores_json, created_at, updated_at, question_id, progress_json, user_explanation, user_business_link'
    )
  );

  const total = allRows.length;
  console.log(`\nTotal nsm_sessions: ${total}`);
  const snapshot_ts = new Date().toISOString();

  // (a) Lifecycle distribution
  const lcCounts = {};
  for (const r of allRows) {
    const lc = r.lifecycle || '(null)';
    lcCounts[lc] = (lcCounts[lc] || 0) + 1;
  }
  console.log('\n(a) Lifecycle distribution:');
  for (const [k, v] of Object.entries(lcCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v} (${(v / total * 100).toFixed(2)}%)`);
  }

  // (b) Per-step completion
  // step1 = any question was selected (all rows count since question_id is required)
  // step2 = user_nsm has meaningful content (the NSM definition)
  // step3 = user_breakdown has meaningful content (breakdown: reach/depth/frequency)
  // step4 = scores_json exists (evaluation completed → that means gated+evaluated happened)
  const step1Count = total; // all rows selected a question
  const step2Count = allRows.filter(r => isNonEmpty(r.user_nsm)).length;
  const step3Count = allRows.filter(r => isNonEmpty(r.user_breakdown)).length;
  const step4Count = allRows.filter(r => r.scores_json && Object.keys(r.scores_json).length > 0).length;
  const gatedCount = (lcCounts['gated'] || 0);
  const completedCount = (lcCounts['completed'] || 0);
  const editingCount = (lcCounts['editing'] || 0);

  console.log('\n(b) Per-step completion (by user data present):');
  console.log(`  Step 1 — question selected:          ${step1Count} (${(step1Count/total*100).toFixed(1)}%)`);
  console.log(`  Step 2 — NSM definition filled:      ${step2Count} (${(step2Count/total*100).toFixed(1)}%)`);
  console.log(`  Step 3 — breakdown filled:           ${step3Count} (${(step3Count/total*100).toFixed(1)}%)`);
  console.log(`  Step 4 — evaluation completed:       ${step4Count} (${(step4Count/total*100).toFixed(1)}%)`);
  console.log(`  lifecycle=gated:                     ${gatedCount} (${(gatedCount/total*100).toFixed(3)}%)`);
  console.log(`  lifecycle=completed:                 ${completedCount} (${(completedCount/total*100).toFixed(3)}%)`);
  console.log(`  lifecycle=editing:                   ${editingCount} (${(editingCount/total*100).toFixed(1)}%)`);

  // (c) Drop funnel — step transitions
  const hasStep2 = allRows.filter(r => isNonEmpty(r.user_nsm));
  const hasStep3 = allRows.filter(r => isNonEmpty(r.user_breakdown));
  const hasStep4 = allRows.filter(r => r.scores_json && Object.keys(r.scores_json).length > 0);

  const dropAtStep2 = total - step2Count;
  const dropStep2to3 = step2Count - step3Count;
  const dropStep3to4 = step3Count - step4Count;

  console.log('\n(c) Drop funnel:');
  console.log(`  Step 1→2 drop (never typed NSM def): ${dropAtStep2} (${(dropAtStep2/total*100).toFixed(1)}% of all)`);
  console.log(`  Step 2→3 drop (after NSM, no breakdown): ${dropStep2to3} (${step2Count > 0 ? (dropStep2to3/step2Count*100).toFixed(1) : 'n/a'}% of step2 starters)`);
  console.log(`  Step 3→4 drop (after breakdown, no eval): ${dropStep3to4} (${step3Count > 0 ? (dropStep3to4/step3Count*100).toFixed(1) : 'n/a'}% of step3 completers)`);
  console.log(`  Step 4→gated drop (eval done, not gated): ${step4Count - gatedCount} (${step4Count > 0 ? ((step4Count-gatedCount)/step4Count*100).toFixed(1) : 'n/a'}% of eval completers)`);

  // (d) Time-to-drop analysis for lifecycle='created' + 'editing' sessions
  const stuckSessions = allRows.filter(r => r.lifecycle === 'created' || r.lifecycle === 'editing');
  const timeDiffs = stuckSessions
    .filter(r => r.created_at && r.updated_at)
    .map(r => minutesDiff(r.created_at, r.updated_at));

  const under1min = timeDiffs.filter(t => t < 1).length;
  const under5min = timeDiffs.filter(t => t < 5).length;
  const under30min = timeDiffs.filter(t => t < 30).length;

  console.log('\n(d) Time-to-drop for stuck sessions (created or editing):');
  console.log(`  Sample size: ${timeDiffs.length} sessions with both timestamps`);
  if (timeDiffs.length > 0) {
    console.log(`  Median time (created_at→updated_at): ${median(timeDiffs).toFixed(1)} min`);
    console.log(`  < 1 min (bounced immediately):  ${under1min} (${(under1min/timeDiffs.length*100).toFixed(1)}%)`);
    console.log(`  < 5 min:  ${under5min} (${(under5min/timeDiffs.length*100).toFixed(1)}%)`);
    console.log(`  < 30 min: ${under30min} (${(under30min/timeDiffs.length*100).toFixed(1)}%)`);
    const max = Math.max(...timeDiffs);
    const min = Math.min(...timeDiffs);
    console.log(`  Range: ${min.toFixed(1)} – ${max.toFixed(1)} min`);
  }

  // (e) Recent vs historical — last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentRows = allRows.filter(r => r.created_at >= sevenDaysAgo);
  const historicalRows = allRows.filter(r => r.created_at < sevenDaysAgo);

  const recentStep2 = recentRows.filter(r => isNonEmpty(r.user_nsm)).length;
  const historicalStep2 = historicalRows.filter(r => isNonEmpty(r.user_nsm)).length;
  const recentStep4 = recentRows.filter(r => r.scores_json && Object.keys(r.scores_json).length > 0).length;
  const historicalStep4 = historicalRows.filter(r => r.scores_json && Object.keys(r.scores_json).length > 0).length;

  console.log('\n(e) Recent (last 7d) vs historical:');
  console.log(`  Last 7 days: ${recentRows.length} sessions`);
  console.log(`    Step 2 rate: ${recentRows.length > 0 ? (recentStep2/recentRows.length*100).toFixed(1) : 'n/a'}% (${recentStep2}/${recentRows.length})`);
  console.log(`    Step 4 rate: ${recentRows.length > 0 ? (recentStep4/recentRows.length*100).toFixed(1) : 'n/a'}% (${recentStep4}/${recentRows.length})`);
  console.log(`  Historical: ${historicalRows.length} sessions`);
  console.log(`    Step 2 rate: ${historicalRows.length > 0 ? (historicalStep2/historicalRows.length*100).toFixed(1) : 'n/a'}% (${historicalStep2}/${historicalRows.length})`);
  console.log(`    Step 4 rate: ${historicalRows.length > 0 ? (historicalStep4/historicalRows.length*100).toFixed(1) : 'n/a'}% (${historicalStep4}/${historicalRows.length})`);

  // (f) User-level analysis
  const userIds = new Set(allRows.filter(r => r.user_id).map(r => r.user_id));
  const guestIds = new Set(allRows.filter(r => r.guest_id).map(r => r.guest_id));
  const usersWithStep4 = new Set(
    allRows.filter(r => r.user_id && r.scores_json && Object.keys(r.scores_json).length > 0).map(r => r.user_id)
  );
  const guestsWithStep4 = new Set(
    allRows.filter(r => r.guest_id && r.scores_json && Object.keys(r.scores_json).length > 0).map(r => r.guest_id)
  );

  console.log('\n(f) User-level:');
  console.log(`  Distinct authenticated users: ${userIds.size}`);
  console.log(`  Distinct guest IDs: ${guestIds.size}`);
  console.log(`  Auth users who completed ≥1 evaluation: ${usersWithStep4.size} (${userIds.size > 0 ? (usersWithStep4.size/userIds.size*100).toFixed(1) : 'n/a'}%)`);
  console.log(`  Guests who completed ≥1 evaluation: ${guestsWithStep4.size} (${guestIds.size > 0 ? (guestsWithStep4.size/guestIds.size*100).toFixed(1) : 'n/a'}%)`);

  // (g) Error breadcrumb columns
  const sampleRow = allRows[0];
  const knownCols = Object.keys(sampleRow);
  const errorCols = knownCols.filter(c => c.includes('error') || c.includes('retry') || c.includes('last_') || c.includes('attempt'));

  console.log('\n(g) Error breadcrumb columns:');
  if (errorCols.length === 0) {
    console.log('  None found — columns: ' + knownCols.join(', '));
  } else {
    for (const col of errorCols) {
      const nonNull = allRows.filter(r => r[col] != null).length;
      console.log(`  ${col}: ${nonNull} non-null values`);
    }
  }

  // Progress_json analysis — what do stuck sessions have in progress_json?
  const withProgress = allRows.filter(r => r.progress_json && Object.keys(r.progress_json).length > 0);
  console.log(`\n  progress_json non-empty: ${withProgress.length} rows`);
  if (withProgress.length > 0) {
    const progressKeys = {};
    for (const r of withProgress) {
      for (const k of Object.keys(r.progress_json)) {
        progressKeys[k] = (progressKeys[k] || 0) + 1;
      }
    }
    console.log('  progress_json keys seen:', JSON.stringify(progressKeys));
    // Sample values
    const sample = withProgress.slice(0, 2);
    for (const r of sample) {
      console.log(`    Sample row ${r.id.slice(0, 8)}: lifecycle=${r.lifecycle} progress_json=${JSON.stringify(r.progress_json).slice(0, 200)}`);
    }
  }

  // Additional: peek at sessions that have NSM def but NO breakdown (biggest drop)
  console.log('\n--- Step 2→3 drop samples (NSM def but no breakdown) ---');
  const dropSamples = allRows
    .filter(r => isNonEmpty(r.user_nsm) && !isNonEmpty(r.user_breakdown))
    .slice(0, 5);
  for (const r of dropSamples) {
    const nsm = r.user_nsm ? (typeof r.user_nsm === 'string' ? r.user_nsm : JSON.stringify(r.user_nsm)).slice(0, 60) : '';
    console.log(`  ${r.id.slice(0, 8)} lc=${r.lifecycle} | user_nsm: ${nsm}...`);
  }

  // Summary for tracker
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY FOR TRACKER (copy to audit/e2e-master-tracker.md §2):');
  console.log(`Snapshot taken: ${snapshot_ts}`);
  console.log(`Total rows: ${total}`);
  console.log(`Lifecycle: created=${lcCounts['created']||0} / editing=${lcCounts['editing']||0} / gated=${lcCounts['gated']||0} / completed=${lcCounts['completed']||0}`);
  console.log(`Step funnel: S1=${total} → S2=${step2Count} (${(step2Count/total*100).toFixed(1)}%) → S3=${step3Count} (${(step3Count/total*100).toFixed(1)}%) → S4=${step4Count} (${(step4Count/total*100).toFixed(1)}%)`);
  console.log(`Biggest drop: S1→S2 (${dropAtStep2} users, ${(dropAtStep2/total*100).toFixed(1)}%) — never typed anything`);
  console.log(`Time-to-drop median: ${timeDiffs.length > 0 ? median(timeDiffs).toFixed(1) : 'n/a'} min`);
  console.log(`Recent 7d: ${recentRows.length} sessions, S2 rate ${recentRows.length > 0 ? (recentStep2/recentRows.length*100).toFixed(1) : 'n/a'}%`);

})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
