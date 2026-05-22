#!/usr/bin/env node
/**
 * P0-SCHEMA-2 NSM dedupe DRY-RUN — READ ONLY
 * ------------------------------------------------------------
 * Background:
 *   nsm_sessions has duplicate (user_id, question_id) groups under
 *   lifecycle='created'. One user has 368 duplicate rows for nsm_001.
 *   We want to keep the latest non-empty user_nsm per group.
 *
 * Keep rule (priority order):
 *   1. Prefer rows where user_nsm IS NOT NULL AND user_nsm.nsm is a
 *      non-empty string (after trim).
 *   2. Among the preferred bucket, max(updated_at) wins.
 *   3. Tiebreak: max(created_at), then max(id) for determinism.
 *
 * Equivalent SQL the real migration would run (DO NOT EXECUTE HERE):
 *
 *   -- FIX (round-2 quiz Q1): PARTITION BY COALESCE(user_id::text, guest_id)
 *   -- so that null-user (guest path) rows do NOT collapse across distinct
 *   -- guest_id owners. The previous PARTITION BY (user_id, question_id) would
 *   -- have over-collapsed thousands of legitimately distinct guest sessions.
 *
 *   -- Step 1: tag keepers
 *   WITH ranked AS (
 *     SELECT id, user_id, guest_id, question_id, lifecycle,
 *            (user_nsm IS NOT NULL
 *               AND COALESCE(TRIM(user_nsm->>'nsm'), '') <> '') AS has_content,
 *            ROW_NUMBER() OVER (
 *              PARTITION BY COALESCE(user_id::text, 'g:' || guest_id::text), question_id
 *              ORDER BY
 *                (user_nsm IS NOT NULL
 *                  AND COALESCE(TRIM(user_nsm->>'nsm'), '') <> '') DESC,
 *                updated_at DESC NULLS LAST,
 *                created_at DESC NULLS LAST,
 *                id DESC
 *            ) AS rn
 *     FROM nsm_sessions
 *     WHERE lifecycle = 'created'
 *       AND (user_id IS NOT NULL OR guest_id IS NOT NULL)  -- skip true orphans
 *   )
 *   DELETE FROM nsm_sessions
 *   WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
 *
 * THIS SCRIPT PERFORMS ZERO WRITES. SELECT-only via PostgREST.
 */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
});
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function hasContent(row) {
  const u = row.user_nsm;
  if (!u || typeof u !== 'object') return false;
  const v = u.nsm;
  return typeof v === 'string' && v.trim().length > 0;
}

function pickKeeper(rows) {
  // Sort by rule: content first, then updated_at desc, created_at desc, id desc.
  const sorted = [...rows].sort((a, b) => {
    const ac = hasContent(a) ? 1 : 0;
    const bc = hasContent(b) ? 1 : 0;
    if (ac !== bc) return bc - ac;
    const au = a.updated_at || '';
    const bu = b.updated_at || '';
    if (au !== bu) return bu.localeCompare(au);
    const acr = a.created_at || '';
    const bcr = b.created_at || '';
    if (acr !== bcr) return bcr.localeCompare(acr);
    return String(b.id).localeCompare(String(a.id));
  });
  return { keep: sorted[0], drop: sorted.slice(1) };
}

async function fetchAllCreated() {
  // page through all lifecycle='created' rows
  // FIX (round-2 quiz Q1): include guest_id so null user_id rows do NOT
  // collapse together (each guest_id is a distinct owner).
  const PAGE = 1000;
  let from = 0;
  const out = [];
  for (;;) {
    const { data, error } = await sb
      .from('nsm_sessions')
      .select('id,user_id,guest_id,question_id,lifecycle,user_nsm,created_at,updated_at')
      .eq('lifecycle', 'created')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

(async () => {
  console.log('NSM dedupe DRY-RUN — lifecycle=created');
  console.log('SUPABASE_URL:', SUPABASE_URL);
  console.log('MODE: READ-ONLY (no DELETE/UPDATE/INSERT)\n');

  const rows = await fetchAllCreated();
  console.log(`Total lifecycle='created' rows scanned: ${rows.length}`);

  // group by (owner, question_id) — owner = user_id OR g:guest_id
  // FIX (round-2 quiz Q1): previously `${r.user_id}::${r.question_id}` collapsed
  // every guest row (user_id=null) per question into one bucket — over-deletion
  // disaster. Now namespace by 'u:' / 'g:' / 'orphan:' so distinct owners stay separate.
  const groups = new Map();
  let orphanCount = 0;
  for (const r of rows) {
    let owner;
    if (r.user_id) owner = `u:${r.user_id}`;
    else if (r.guest_id) owner = `g:${r.guest_id}`;
    else { owner = `orphan:${r.id}`; orphanCount++; }
    const k = `${owner}::${r.question_id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  if (orphanCount > 0) console.log(`WARN: ${orphanCount} rows have neither user_id nor guest_id — bucketed by row id (single-row groups, no dedupe)`);

  const dupGroups = [];
  let totalDelete = 0;
  let allEmptyGroups = 0;
  const allNonEmptyMulti = [];

  for (const [k, grp] of groups) {
    if (grp.length < 2) continue;
    const { keep, drop } = pickKeeper(grp);
    const contentful = grp.filter(hasContent).length;
    dupGroups.push({ key: k, size: grp.length, keep, drop, contentful });
    totalDelete += drop.length;
    if (contentful === 0) allEmptyGroups += 1;
    if (contentful === grp.length && grp.length >= 2) {
      allNonEmptyMulti.push({ key: k, size: grp.length, ids: grp.map((r) => r.id) });
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total duplicate groups (size>=2): ${dupGroups.length}`);
  console.log(`Total rows that WOULD be deleted: ${totalDelete}`);
  console.log(`Groups where ALL rows have empty user_nsm: ${allEmptyGroups}`);
  console.log(`  -> keep rule for these: max(updated_at), then created_at, then id (newest wins)`);
  console.log(`Groups where ALL rows have non-empty user_nsm (manual review): ${allNonEmptyMulti.length}`);

  const worst = [...dupGroups].sort((a, b) => b.size - a.size).slice(0, 5);
  console.log(`\n=== TOP 5 WORST GROUPS ===`);
  worst.forEach((g, i) => {
    const [owner, qid] = g.key.split('::');
    console.log(`\n#${i + 1} owner=${owner} question=${qid}`);
    console.log(`   size=${g.size} contentful=${g.contentful} drop=${g.drop.length}`);
    console.log(`   KEEP id=${g.keep.id} updated_at=${g.keep.updated_at} has_content=${hasContent(g.keep)}`);
    const sampleDrop = g.drop.slice(0, 3);
    sampleDrop.forEach((d) => {
      console.log(`   DROP id=${d.id} updated_at=${d.updated_at} has_content=${hasContent(d)}`);
    });
    if (g.drop.length > 3) console.log(`   ... +${g.drop.length - 3} more dropped`);
  });

  if (allNonEmptyMulti.length > 0) {
    console.log(`\n=== ALL-NON-EMPTY GROUPS (manual review needed) ===`);
    allNonEmptyMulti.slice(0, 20).forEach((g) => {
      const [owner, qid] = g.key.split('::');
      console.log(`   owner=${owner} q=${qid} size=${g.size} ids=${g.ids.join(',')}`);
    });
    if (allNonEmptyMulti.length > 20) {
      console.log(`   ... +${allNonEmptyMulti.length - 20} more`);
    }
  }

  console.log('\nDONE — no writes performed.');
})().catch((e) => {
  console.error('ERROR:', e.message || e);
  process.exit(1);
});
