/**
 * cleanup-empty-sessions.js — Cron cleanup for empty orphan circles_sessions
 *
 * Spec: docs/superpowers/specs/2026-04-28-circles-progress-save-design.md §9 (line 173)
 * SIT-2 Issue #14 / Fix Agent F.
 *
 * What it does:
 *   Deletes circles_sessions rows that are:
 *     - status = 'active'
 *     - created_at older than 24 hours ago
 *     - step_drafts is empty ({} or null)
 *     - framework_draft is empty ({} or null)
 *   These are "orphan" sessions left behind by the lazy-create flow when a
 *   user opens a question, triggers POST /draft, but never types anything
 *   meaningful. The session.js POSTs once per question-open, so abandoned
 *   browses can leave empty rows. This script is the safety-net cleanup.
 *
 * Safety:
 *   - The empty-check is performed CLIENT-SIDE in Node (Supabase REST cannot
 *     reliably express `jsonb = '{}'`). We fetch candidates, filter, then
 *     delete only the truly empty ones by id.
 *   - Supports `--dry-run` (logs candidates and would-delete count without
 *     issuing the DELETE).
 *
 * How to run:
 *   node scripts/cleanup-empty-sessions.js               # actually delete
 *   node scripts/cleanup-empty-sessions.js --dry-run     # log only
 *
 * When to run:
 *   Daily, via cron / scheduled job. Example crontab line (3am UTC):
 *     0 3 * * * cd /app && node scripts/cleanup-empty-sessions.js >> /var/log/circles-cleanup.log 2>&1
 *
 * Env vars required (read by db/client.js):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 1000;

function isEmptyJsonb(v) {
  if (v == null) return true;
  if (typeof v !== 'object') return false;
  return Object.keys(v).length === 0;
}

async function cleanupEmptySessions({ dryRun = false, cutoffMs = TWENTY_FOUR_HOURS_MS, db } = {}) {
  if (!db) {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    }
    db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }

  const cutoff = new Date(Date.now() - cutoffMs).toISOString();
  console.log(`[cleanup] mode=${dryRun ? 'DRY-RUN' : 'DELETE'} cutoff=${cutoff}`);

  const { data: candidates, error: selErr } = await db
    .from('circles_sessions')
    .select('id, step_drafts, framework_draft, created_at')
    .eq('status', 'active')
    .lt('created_at', cutoff)
    .limit(BATCH_LIMIT);

  if (selErr) throw selErr;

  console.log(`[cleanup] candidates fetched: ${candidates ? candidates.length : 0}`);

  const empty = (candidates || []).filter(
    s => isEmptyJsonb(s.step_drafts) && isEmptyJsonb(s.framework_draft)
  );

  if (empty.length === 0) {
    console.log('[cleanup] no empty orphan sessions to delete');
    return { candidates: candidates ? candidates.length : 0, deleted: 0, dryRun };
  }

  console.log(`[cleanup] empty orphans found: ${empty.length}`);
  if (dryRun) {
    for (const s of empty.slice(0, 20)) {
      console.log(`  would-delete id=${s.id} created_at=${s.created_at}`);
    }
    if (empty.length > 20) console.log(`  ...and ${empty.length - 20} more`);
    return { candidates: candidates.length, deleted: 0, wouldDelete: empty.length, dryRun };
  }

  const ids = empty.map(s => s.id);
  const { error: delErr } = await db.from('circles_sessions').delete().in('id', ids);
  if (delErr) throw delErr;

  console.log(`[cleanup] deleted ${ids.length} empty orphan sessions`);
  return { candidates: candidates.length, deleted: ids.length, dryRun };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  try {
    const result = await cleanupEmptySessions({ dryRun });
    console.log('[cleanup] done', JSON.stringify(result));
    process.exit(0);
  } catch (e) {
    console.error('[cleanup] FAILED:', e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { cleanupEmptySessions, isEmptyJsonb };
