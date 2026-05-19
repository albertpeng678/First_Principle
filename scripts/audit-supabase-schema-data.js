#!/usr/bin/env node
/**
 * audit-supabase-schema-data.js — D-2 pre-implementation schema + data audit.
 *
 * READ-ONLY. NO writes. Service-role REST API via Supabase JS client.
 *
 * Audits:
 *   §1 nsm_sessions + circles_sessions schema (column keys via sample)
 *   §2 user_nsm / user_breakdown shape distribution (50 rows)
 *   §3 Lifecycle integrity (500 rows)
 *   §4 CIRCLES drift (same shape check)
 *   §5 localStorage ↔ backend shape (no DB call — informational, looked up in source)
 *
 * Run: node scripts/audit-supabase-schema-data.js
 */
'use strict';

require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: false });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function classifyJsonbShape(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') {
    if (v === '' || v.trim() === '') return 'emptyStr';
    return 'string(legacy?)';
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 0) return 'emptyObj';
    // Look for content
    const hasContent = keys.some((k) => {
      const val = v[k];
      return val !== null && val !== undefined && val !== '' &&
        (typeof val !== 'string' || val.trim().length > 0);
    });
    if (!hasContent) return 'emptyKeysOnly';
    return `obj[keys=${keys.length}, hasContent]`;
  }
  return `other(${typeof v})`;
}

function isEmptyJsonb(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '' || v === '{}';
  if (typeof v === 'object') {
    if (Object.keys(v).length === 0) return true;
    const hasContent = Object.values(v).some((x) => {
      if (x === null || x === undefined || x === '') return false;
      if (typeof x === 'string' && x.trim() === '') return false;
      return true;
    });
    return !hasContent;
  }
  return true;
}

async function main() {
  console.log('=== Supabase schema + data audit (D-2 pre-impl) ===');
  console.log('Snapshot:', new Date().toISOString());
  console.log('');

  // ---- §1 Schema via sample row ---------------------------------------
  console.log('## §1 SCHEMA — sampling 3 rows from each table');
  console.log('');

  const nsmSample = await db.from('nsm_sessions').select('*').limit(3);
  if (nsmSample.error) {
    console.error('nsm_sessions sample error:', nsmSample.error.message);
  } else {
    const keys = Object.keys(nsmSample.data?.[0] || {});
    console.log('### nsm_sessions columns (' + keys.length + ' cols):');
    for (const k of keys) {
      const v = nsmSample.data[0][k];
      const typeStr = v === null ? 'null'
        : Array.isArray(v) ? 'array'
        : typeof v === 'object' ? 'object(jsonb?)'
        : typeof v;
      const preview = v === null ? '(null)'
        : typeof v === 'object' ? JSON.stringify(v).slice(0, 80)
        : String(v).slice(0, 80);
      console.log('  - ' + k.padEnd(30) + ' :: ' + typeStr.padEnd(20) + ' = ' + preview);
    }
  }

  console.log('');
  const csSample = await db.from('circles_sessions').select('*').limit(3);
  if (csSample.error) {
    console.error('circles_sessions sample error:', csSample.error.message);
  } else {
    const keys = Object.keys(csSample.data?.[0] || {});
    console.log('### circles_sessions columns (' + keys.length + ' cols):');
    for (const k of keys) {
      const v = csSample.data[0][k];
      const typeStr = v === null ? 'null'
        : Array.isArray(v) ? 'array'
        : typeof v === 'object' ? 'object(jsonb?)'
        : typeof v;
      const preview = v === null ? '(null)'
        : typeof v === 'object' ? JSON.stringify(v).slice(0, 80)
        : String(v).slice(0, 80);
      console.log('  - ' + k.padEnd(30) + ' :: ' + typeStr.padEnd(20) + ' = ' + preview);
    }
  }

  // ---- §2 user_nsm / user_breakdown shape (50 rows) -------------------
  console.log('');
  console.log('## §2 user_nsm / user_breakdown / progress_json shape distribution');
  console.log('');

  const shapeRows = await db
    .from('nsm_sessions')
    .select('id, user_nsm, user_breakdown, progress_json, scores_json, lifecycle, question_id, created_at, updated_at')
    .limit(50)
    .order('created_at', { ascending: false });

  if (shapeRows.error) {
    console.error('shape query error:', shapeRows.error.message);
  } else {
    const cats = {
      user_nsm: {},
      user_breakdown: {},
      progress_json: {},
      scores_json: {},
    };
    for (const r of shapeRows.data || []) {
      for (const col of Object.keys(cats)) {
        const s = classifyJsonbShape(r[col]);
        cats[col][s] = (cats[col][s] || 0) + 1;
      }
    }
    for (const col of Object.keys(cats)) {
      console.log('### ' + col + ' shapes (n=' + (shapeRows.data || []).length + '):');
      for (const [k, v] of Object.entries(cats[col]).sort((a, b) => b[1] - a[1])) {
        console.log('  ' + k.padEnd(30) + ' ' + v);
      }
    }

    // sample non-empty user_nsm
    const sampleFilled = (shapeRows.data || []).find(
      (r) => !isEmptyJsonb(r.user_nsm)
    );
    console.log('');
    console.log('### Sample row with non-empty user_nsm:');
    if (sampleFilled) {
      console.log(JSON.stringify({
        id: sampleFilled.id.slice(0, 8),
        lifecycle: sampleFilled.lifecycle,
        question_id: sampleFilled.question_id,
        user_nsm: sampleFilled.user_nsm,
        user_breakdown: sampleFilled.user_breakdown,
        progress_json: sampleFilled.progress_json,
        scores_json_keys: sampleFilled.scores_json ? Object.keys(sampleFilled.scores_json) : null,
        created_at: sampleFilled.created_at,
        updated_at: sampleFilled.updated_at,
      }, null, 2));
    } else {
      console.log('  (none in this sample of 50 — all user_nsm empty)');
    }
  }

  // ---- §3 Lifecycle integrity (500 rows) ------------------------------
  console.log('');
  console.log('## §3 Lifecycle integrity (500 rows)');
  console.log('');

  const intRows = await db
    .from('nsm_sessions')
    .select('id, lifecycle, user_nsm, user_breakdown, progress_json, scores_json, created_at, updated_at, question_id')
    .limit(500)
    .order('created_at', { ascending: false });

  if (intRows.error) {
    console.error('integrity query error:', intRows.error.message);
  } else {
    const bad = {
      gated_empty_user_nsm: 0,
      gated_empty_breakdown: 0,
      gated_no_scores: 0,
      completed_no_scores: 0,
      created_with_scores: 0,
      created_with_user_nsm: 0,
      created_with_progress_evaluating: 0,
      editing_no_user_nsm: 0,
      editing_with_scores: 0,
      same_ts_created_updated: 0,  // never modified after eager-insert
      orphaned_evaluating_flag: 0,  // progress_json.evaluating=true but lifecycle≠gated
    };
    const lcCounts = {};
    const stepDist = { step1Only: 0, step2OnTrack: 0, step3OnTrack: 0, step4Done: 0 };
    let staleEvaluatingExamples = [];
    for (const r of intRows.data || []) {
      lcCounts[r.lifecycle] = (lcCounts[r.lifecycle] || 0) + 1;
      const nsmEmpty = isEmptyJsonb(r.user_nsm);
      const bdEmpty = isEmptyJsonb(r.user_breakdown);
      const hasScore = r.scores_json && Object.keys(r.scores_json).length > 0;
      const evaluating = r.progress_json && r.progress_json.evaluating === true;
      const sameTs = r.created_at === r.updated_at;

      if (r.lifecycle === 'gated') {
        if (nsmEmpty) bad.gated_empty_user_nsm++;
        if (bdEmpty) bad.gated_empty_breakdown++;
        if (!hasScore) bad.gated_no_scores++;
      }
      if (r.lifecycle === 'completed') {
        if (!hasScore) bad.completed_no_scores++;
      }
      if (r.lifecycle === 'created') {
        if (hasScore) bad.created_with_scores++;
        if (!nsmEmpty) bad.created_with_user_nsm++;
        if (evaluating) bad.created_with_progress_evaluating++;
      }
      if (r.lifecycle === 'editing') {
        if (nsmEmpty) bad.editing_no_user_nsm++;
        if (hasScore) bad.editing_with_scores++;
      }
      if (sameTs) bad.same_ts_created_updated++;

      // Stale evaluating flag (any lifecycle but flag stuck)
      if (evaluating && r.lifecycle !== 'gated' && r.lifecycle !== 'completed') {
        bad.orphaned_evaluating_flag++;
        if (staleEvaluatingExamples.length < 3) {
          staleEvaluatingExamples.push({
            id: r.id.slice(0, 8),
            lifecycle: r.lifecycle,
            progress_json: r.progress_json,
            updated_at: r.updated_at,
          });
        }
      }

      // Step distribution
      if (nsmEmpty) stepDist.step1Only++;
      else if (bdEmpty) stepDist.step2OnTrack++;
      else if (!hasScore) stepDist.step3OnTrack++;
      else stepDist.step4Done++;
    }
    console.log('### Lifecycle counts (500 rows):');
    for (const [k, v] of Object.entries(lcCounts).sort((a, b) => b[1] - a[1])) {
      console.log('  ' + k.padEnd(15) + ' ' + v);
    }
    console.log('');
    console.log('### Step progression distribution (500 rows):');
    console.log('  step1Only (no user_nsm)   : ' + stepDist.step1Only);
    console.log('  step2 (user_nsm, no bd)   : ' + stepDist.step2OnTrack);
    console.log('  step3 (bd, no scores)     : ' + stepDist.step3OnTrack);
    console.log('  step4Done (has scores)    : ' + stepDist.step4Done);
    console.log('');
    console.log('### Bad-state counts (500 rows):');
    for (const [k, v] of Object.entries(bad)) {
      console.log('  ' + k.padEnd(40) + ' ' + v);
    }
    if (staleEvaluatingExamples.length > 0) {
      console.log('');
      console.log('### Stale evaluating-flag examples:');
      console.log(JSON.stringify(staleEvaluatingExamples, null, 2));
    }
  }

  // ---- §4 CIRCLES drift (compare schema + shape) ----------------------
  console.log('');
  console.log('## §4 CIRCLES drift — circles_sessions shape (50 rows)');
  console.log('');

  const csRows = await db
    .from('circles_sessions')
    .select('*')
    .limit(50)
    .order('created_at', { ascending: false });

  if (csRows.error) {
    console.error('circles shape error:', csRows.error.message);
  } else {
    const data = csRows.data || [];
    const csKeys = Object.keys(data[0] || {});
    console.log('### Columns (' + csKeys.length + '): ' + csKeys.join(', '));
    // analyze step_drafts shape if present, plus lifecycle
    const lcCounts = {};
    const draftShapes = {};
    const progressShapes = {};
    for (const r of data) {
      lcCounts[r.lifecycle || '(missing)'] = (lcCounts[r.lifecycle || '(missing)'] || 0) + 1;
      if ('step_drafts' in r) {
        const s = classifyJsonbShape(r.step_drafts);
        draftShapes[s] = (draftShapes[s] || 0) + 1;
      }
      if ('progress_json' in r) {
        const s = classifyJsonbShape(r.progress_json);
        progressShapes[s] = (progressShapes[s] || 0) + 1;
      }
    }
    console.log('### lifecycle counts (50 sample):');
    for (const [k, v] of Object.entries(lcCounts)) {
      console.log('  ' + k.padEnd(15) + ' ' + v);
    }
    if (Object.keys(draftShapes).length > 0) {
      console.log('### step_drafts shapes:');
      for (const [k, v] of Object.entries(draftShapes)) console.log('  ' + k.padEnd(30) + ' ' + v);
    }
    if (Object.keys(progressShapes).length > 0) {
      console.log('### progress_json shapes:');
      for (const [k, v] of Object.entries(progressShapes)) console.log('  ' + k.padEnd(30) + ' ' + v);
    }
  }

  // ---- §4b cross-table schema diff ------------------------------------
  console.log('');
  console.log('## §4b cross-table column drift (nsm vs circles)');
  console.log('');
  const nsmKeys = new Set(Object.keys(nsmSample.data?.[0] || {}));
  const csKeys = new Set(Object.keys(csRows.data?.[0] || {}));
  const onlyNsm = [...nsmKeys].filter((k) => !csKeys.has(k));
  const onlyCs = [...csKeys].filter((k) => !nsmKeys.has(k));
  const both = [...nsmKeys].filter((k) => csKeys.has(k));
  console.log('Shared (' + both.length + '): ' + both.join(', '));
  console.log('Only on nsm_sessions: ' + onlyNsm.join(', '));
  console.log('Only on circles_sessions: ' + onlyCs.join(', '));

  // ---- summary --------------------------------------------------------
  console.log('');
  console.log('=== DONE ===');
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
