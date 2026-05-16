#!/usr/bin/env node
/**
 * audit-all-sessions.js — read-only inventory of ALL sessions for current user.
 *
 * Classifies each into:
 *   - POLLUTED         : matches test stub patterns (isPolluted from scan-pollution)
 *   - EMPTY_STUB       : no real user content + no analysis (zombie skeleton)
 *   - INCOMPLETE_OLD   : >7d old + never reached final analysis
 *   - ACTIVE           : has real content (keep)
 *
 * Outputs:
 *   - audit/all-sessions-inventory-2026-05-16.md
 *   - console summary
 *
 * Read-only. No mutations. Use execute-cleanup.js with confirmed `[x]` rows to act.
 *
 * Run: REAL_ACCESS_TOKEN=<token> node scripts/audit-all-sessions.js
 */
require('dotenv').config();
require('dotenv').config({ path: '.env.test', override: false });

const fs   = require('fs');
const path = require('path');
const { fetchSessions, fetchSessionDetail, isPolluted, extractStrings } = require('./scan-pollution');

const OUT_PATH = path.join(__dirname, '..', 'audit', 'all-sessions-inventory-2026-05-16.md');

function daysOld(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function classify(detail, kind) {
  const fields = extractStrings(detail, kind);
  const polluted = fields.filter((f) => isPolluted(f.value));
  if (polluted.length > 0) {
    return { tag: 'POLLUTED', reason: `${polluted.length} stub field(s): ${polluted.map((p) => p.path).join(', ')}` };
  }
  const realContent = fields.filter((f) => f.value && f.value.trim().length > 0);
  const hasAnalysis = detail.analysis && Object.keys(detail.analysis).length > 0;
  if (realContent.length === 0 && !hasAnalysis) {
    return { tag: 'EMPTY_STUB', reason: 'no user content + no analysis' };
  }
  const age = daysOld(detail.created_at);
  if (!hasAnalysis && age > 7) {
    return { tag: 'INCOMPLETE_OLD', reason: `${age}d old, no analysis, only partial content` };
  }
  return { tag: 'ACTIVE', reason: `${realContent.length} field(s) with content` };
}

(async () => {
  const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
  const TOKEN    = process.env.REAL_ACCESS_TOKEN;
  if (!BASE_URL || !TOKEN) {
    console.error('Need BASE_URL (.env.test) + REAL_ACCESS_TOKEN (env)');
    process.exit(1);
  }

  const results = { circles: [], nsm: [] };

  for (const kind of ['circles', 'nsm']) {
    console.error(`Fetching ${kind} list...`);
    const list = await fetchSessions(BASE_URL, TOKEN, kind);
    console.error(`  → ${list.length} ${kind} sessions`);
    for (const s of list) {
      const detail = await fetchSessionDetail(BASE_URL, TOKEN, kind, s.id);
      const cls = classify(detail, kind);
      results[kind].push({
        id: detail.id,
        created_at: detail.created_at,
        question_id: detail.question_id || null,
        title: (detail.title || '').slice(0, 30),
        tag: cls.tag,
        reason: cls.reason,
      });
    }
  }

  const tally = (arr) => arr.reduce((m, r) => { m[r.tag] = (m[r.tag] || 0) + 1; return m; }, {});
  const tCircles = tally(results.circles);
  const tNsm     = tally(results.nsm);

  console.log('');
  console.log('=== Summary ===');
  console.log('CIRCLES:', tCircles);
  console.log('NSM    :', tNsm);

  const md = [];
  md.push(`# All Sessions Inventory — 2026-05-16`);
  md.push('');
  md.push(`**Scope:** every session for ${process.env.USER_REAL_EMAIL || '<unknown>'}, classified for cleanup.`);
  md.push('');
  md.push(`**CIRCLES tally:** ${JSON.stringify(tCircles)}`);
  md.push(`**NSM tally:**     ${JSON.stringify(tNsm)}`);
  md.push('');

  for (const kind of ['circles', 'nsm']) {
    for (const tag of ['POLLUTED', 'EMPTY_STUB', 'INCOMPLETE_OLD', 'ACTIVE']) {
      const rows = results[kind].filter((r) => r.tag === tag);
      if (rows.length === 0) continue;
      md.push(`## ${kind} — ${tag} (${rows.length})`);
      md.push('');
      md.push('| sessionId | created_at | q_id | title | reason | confirm? |');
      md.push('|---|---|---|---|---|---|');
      for (const r of rows) {
        const confirm = (tag === 'ACTIVE') ? 'N/A (keep)' : '[ ]';
        md.push(`| ${r.id} | ${r.created_at} | ${r.question_id || '-'} | ${r.title || '-'} | ${r.reason} | ${confirm} |`);
      }
      md.push('');
    }
  }

  fs.writeFileSync(OUT_PATH, md.join('\n') + '\n');
  console.log(`\nReport: ${OUT_PATH}`);
})().catch((e) => { console.error(e); process.exit(1); });
