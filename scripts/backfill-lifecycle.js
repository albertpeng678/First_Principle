#!/usr/bin/env node
// scripts/backfill-lifecycle.js
// Computes lifecycle for every pre-existing row in circles_sessions + nsm_sessions
// based on existing columns (status, gate_result, framework_draft, etc.).
//
// Usage:
//   node scripts/backfill-lifecycle.js --dry      # print counts only
//   node scripts/backfill-lifecycle.js --apply    # write the updates
//
// Idempotent: re-run is safe (the rule reads existing lifecycle and respects 'completed').

const { hasSubstantiveContent } = require('../lib/session-lifecycle');

function classify(row, kind) {
  if (!row || typeof row !== 'object') return 'created';

  // Terminal first
  if (row.status === 'completed' || row.lifecycle === 'completed') return 'completed';
  if (kind === 'nsm' && row.scores_json) return 'completed';

  // Gated
  if (kind === 'circles' && row.gate_result && row.gate_result.ok === true) return 'gated';
  if (kind === 'nsm' && row.progress_json && row.progress_json.gateResult && row.progress_json.gateResult.ok === true) {
    return 'gated';
  }

  // Editing — fold the row shape into a virtual patch body, then re-use helper
  if (kind === 'circles') {
    const virtual = {
      frameworkDraft: row.framework_draft || {},
      stepDrafts: row.step_drafts || {},
      phase2ConclusionDraft: (row.progress_json && row.progress_json.phase2ConclusionDraft) || '',
    };
    if (hasSubstantiveContent(virtual, 'circles', 'patch')) return 'editing';
  } else {
    const virtual = {
      userNsm: row.user_nsm,
      userBreakdown: row.user_breakdown,
      userExplanation: row.user_explanation,
      userBusinessLink: row.user_business_link,
    };
    if (hasSubstantiveContent(virtual, 'nsm', 'patch')) return 'editing';
  }

  return 'created';
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dry = process.argv.includes('--dry') || !apply;

  // Late require so unit tests don't need supabase env vars.
  require('dotenv').config();
  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const summary = {
    circles: { completed: 0, gated: 0, editing: 0, created: 0 },
    nsm:     { completed: 0, gated: 0, editing: 0, created: 0 },
  };

  for (const kind of ['circles', 'nsm']) {
    const table = kind === 'circles' ? 'circles_sessions' : 'nsm_sessions';
    const { data, error } = await db.from(table).select('*');
    if (error) throw error;
    for (const row of data) {
      const next = classify(row, kind);
      summary[kind][next]++;
      if (apply && row.lifecycle !== next) {
        const { error: uErr } = await db.from(table).update({ lifecycle: next }).eq('id', row.id);
        if (uErr) throw uErr;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ mode: dry ? 'dry' : 'apply', summary }, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[backfill-lifecycle] error:', e);
    process.exit(1);
  });
}

module.exports = { classify };
