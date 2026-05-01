#!/usr/bin/env node
'use strict';

/**
 * audit-stale-sessions.js
 *
 * Read-only DB sweep listing CIRCLES sessions whose `question_json.problem_statement`
 * differs from the current `circles_plan/circles_database.json`. No data mutation.
 *
 * Usage:
 *   node -r dotenv/config scripts/audit-stale-sessions.js
 *
 * Output: TSV to stdout with columns:
 *   session_id  user_id_or_guest  question_id  status  snapshot_first30  current_first30
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const QUESTIONS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'circles_plan', 'circles_database.json'), 'utf8')
);
const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

function normalize(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

async function fetchAll(table, ownerCol) {
  const { data, error } = await supabase
    .from(table)
    .select(`id, ${ownerCol}, question_id, question_json, status`)
    .limit(5000);
  if (error) throw error;
  return data;
}

async function main() {
  const auth = await fetchAll('circles_sessions', 'user_id');
  const guest = await fetchAll('guest_circles_sessions', 'guest_id');
  const rows = auth.map(r => ({ ...r, owner: r.user_id, kind: 'auth' }))
    .concat(guest.map(r => ({ ...r, owner: r.guest_id, kind: 'guest' })));

  console.log(['session_id', 'kind', 'owner', 'question_id', 'status', 'snapshot', 'current'].join('\t'));
  let staleCount = 0;
  rows.forEach(r => {
    const current = QUESTION_BY_ID[r.question_id];
    const snapshotPS = r.question_json && r.question_json.problem_statement;
    const currentPS = current && current.problem_statement;
    if (normalize(snapshotPS) !== normalize(currentPS)) {
      staleCount++;
      console.log([
        r.id, r.kind, r.owner, r.question_id, r.status,
        normalize(snapshotPS).slice(0, 30),
        normalize(currentPS).slice(0, 30)
      ].join('\t'));
    }
  });
  console.error('\n[audit] total sessions: ' + rows.length + ' | stale: ' + staleCount);
}

main().catch(err => { console.error(err); process.exit(1); });
