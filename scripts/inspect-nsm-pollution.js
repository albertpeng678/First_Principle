#!/usr/bin/env node
/**
 * inspect-nsm-pollution.js — dump full row for 4 NSM polluted sessions
 * so director can decide DELETE-all vs CLEAR-FIELD-only.
 *
 * Read-only. No mutations.
 *
 * Run:  REAL_ACCESS_TOKEN=<token> node scripts/inspect-nsm-pollution.js
 */
require('dotenv').config({ path: '.env.test', override: false });
const { fetchSessionDetail } = require('./scan-pollution');

const NSM_IDS = [
  'c4de5423-31f5-4275-a076-a2e4e7ffc5a2',
  'dc328ed8-e6a9-4e89-9f82-79e06e9fa5e7',
  'bc285221-4fc6-4090-a5c6-12801031845d',
  'fb367fe0-4d37-414c-be12-4b0363653fd6',
];

(async () => {
  const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
  const TOKEN    = process.env.REAL_ACCESS_TOKEN;
  if (!BASE_URL || !TOKEN) {
    console.error('Need BASE_URL (.env.test) + REAL_ACCESS_TOKEN (env)');
    process.exit(1);
  }
  for (const id of NSM_IDS) {
    const row = await fetchSessionDetail(BASE_URL, TOKEN, 'nsm', id);
    const summary = {
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      step: row.step,
      question_id: row.question_id,
      title: row.title,
      user_nsm: row.user_nsm,
      user_breakdown: row.user_breakdown,
      user_step2: row.user_step2,
      user_step3: row.user_step3,
      user_step4: row.user_step4,
      analysis_keys: row.analysis ? Object.keys(row.analysis) : null,
    };
    console.log(`\n=== ${id} ===`);
    console.log(JSON.stringify(summary, null, 2));
  }
})().catch((e) => { console.error(e); process.exit(1); });
