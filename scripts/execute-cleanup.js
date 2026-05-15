#!/usr/bin/env node
/**
 * Destructive cleanup driven by audit/data-pollution-report-2026-05-16.md.
 * Reads confirmed rows (lines whose checkbox is `[x]`) and DELETEs / PATCHes.
 *
 * Usage:
 *   --dry-run            : print curl commands without executing
 *   (no flag, default)   : prompt stdin "yes I confirm <N> deletions" then run
 *
 * Env: BASE_URL, REAL_ACCESS_TOKEN, USER_REAL_EMAIL (from .env.test)
 */
require('dotenv').config({ path: '.env.test' });
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const { assertActingOnBehalfOfPollutionTarget } = require('../tests/helpers/env-guard');

const REPORT_PATH  = path.join(__dirname, '..', 'audit', 'data-pollution-report-2026-05-16.md');
const RECEIPT_PATH = path.join(__dirname, '..', 'audit', 'data-pollution-executed-2026-05-16.md');
const BASE_URL     = (process.env.BASE_URL || '').replace(/\/$/, '');
const TOKEN        = process.env.REAL_ACCESS_TOKEN;

function parseConfirmedRows(md) {
  // Rows look like: | sessionId | kind | created_at | match field | sample (60 char) | confirm? |
  const rows = [];
  let currentList = null;
  for (const line of md.split('\n')) {
    if (/^## DELETE list/.test(line))      { currentList = 'DELETE_ROW';   continue; }
    if (/^## CLEAR-FIELD list/.test(line)) { currentList = 'CLEAR_FIELDS'; continue; }
    if (/^## /.test(line))                 { currentList = null;            continue; }
    if (!currentList) continue;
    if (!line.startsWith('|')) continue;
    if (/^\|---/.test(line))              continue; // separator
    if (/^\| sessionId/.test(line))       continue; // header

    const cells = line.split('|').map((c) => c.trim());
    // cells: ['', sessionId, kind, created_at, field, sample, confirm, '']
    if (cells.length < 7) continue;
    const confirmCell = cells[6];
    if (!/\[x\]/i.test(confirmCell)) continue; // skip unchecked rows

    rows.push({
      sessionId:  cells[1],
      kind:       cells[2],
      created_at: cells[3],
      field_path: cells[4],
      action:     currentList,
    });
  }
  return rows;
}

async function execDelete(row) {
  const url = `${BASE_URL}/api/${row.kind}-sessions/${row.sessionId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  return { status: res.status };
}

async function execClear(row) {
  const url  = `${BASE_URL}/api/${row.kind}-sessions/${row.sessionId}/progress`;
  const body = buildClearPatch(row.kind, row.field_path);
  const res  = await fetch(url, {
    method:  'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status };
}

function buildClearPatch(kind, field_path) {
  // Map field_path back to the PATCH-accepted camelCase shape used by FE.
  if (kind === 'nsm') {
    if (field_path === 'user_nsm')            return { userNsm: '' };
    if (field_path === 'user_explanation')    return { userExplanation: '' };
    if (field_path === 'user_business_link')  return { userBusinessLink: '' };
    const m = field_path.match(/^user_breakdown\.(reach|depth|frequency|impact)$/);
    if (m) return { userBreakdown: { [m[1]]: '' } };
    throw new Error(`unsupported nsm clear path: ${field_path}`);
  }

  // circles —
  //   framework_draft.STEP.FIELD  → { frameworkDraft: { STEP: { FIELD: '' } } }
  //   step_drafts.STEP.FIELD      → { stepDrafts: { STEP: { FIELD: '' } } }
  //   phase2_conclusion_draft     → { phase2ConclusionDraft: '' }
  //   phase2_chat_history[N]      → not supported per-message; use DELETE_ROW
  const fdm = field_path.match(/^framework_draft\.([^.]+)\.(.+)$/);
  if (fdm) return { frameworkDraft: { [fdm[1]]: { [fdm[2]]: '' } } };

  const sdm = field_path.match(/^step_drafts\.([^.]+)\.(.+)$/);
  if (sdm) return { stepDrafts: { [sdm[1]]: { [sdm[2]]: '' } } };

  if (field_path === 'phase2_conclusion_draft') return { phase2ConclusionDraft: '' };

  if (/^phase2_chat_history\[/.test(field_path)) {
    throw new Error(
      `phase2_chat_history clearing not supported per-message; suggest DELETE_ROW instead`
    );
  }

  throw new Error(`unsupported circles clear path: ${field_path}`);
}

(async () => {
  if (!BASE_URL || !TOKEN) {
    console.error('Required env: BASE_URL + REAL_ACCESS_TOKEN. Set in .env.test or via shell.');
    process.exit(1);
  }

  // Pre-flight guard — required even in --dry-run for safety symmetry.
  // dotenv.config() does NOT override shell-set env vars, so USER_REAL_EMAIL
  // from the shell takes precedence over .env.test.
  assertActingOnBehalfOfPollutionTarget(process.env.USER_REAL_EMAIL);

  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`Report not found at ${REPORT_PATH}. Run scan-pollution.js first.`);
    process.exit(1);
  }

  const md   = fs.readFileSync(REPORT_PATH, 'utf8');
  const rows = parseConfirmedRows(md);
  if (rows.length === 0) {
    console.log('No confirmed rows (no [x] checkbox found). Nothing to do.');
    process.exit(0);
  }

  const dryRun = process.argv.includes('--dry-run');

  console.log(`\nConfirmed rows: ${rows.length}`);
  console.log(`  DELETE_ROW:   ${rows.filter((r) => r.action === 'DELETE_ROW').length}`);
  console.log(`  CLEAR_FIELDS: ${rows.filter((r) => r.action === 'CLEAR_FIELDS').length}`);

  if (dryRun) {
    console.log('\n--- DRY RUN (no execution) ---');
    for (const r of rows) {
      if (r.action === 'DELETE_ROW') {
        console.log(
          `curl -X DELETE "${BASE_URL}/api/${r.kind}-sessions/${r.sessionId}" -H "Authorization: Bearer <token>"`
        );
      } else {
        try {
          const body = buildClearPatch(r.kind, r.field_path);
          console.log(
            `curl -X PATCH  "${BASE_URL}/api/${r.kind}-sessions/${r.sessionId}/progress"` +
            ` -d '${JSON.stringify(body)}' -H "Authorization: Bearer <token>"`
          );
        } catch (e) {
          console.log(`# WARN: ${e.message}`);
        }
      }
    }
    process.exit(0);
  }

  // Confirmation prompt
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const expected = `yes I confirm ${rows.length} deletions`;
  const answer   = await new Promise((resolve) => rl.question(`\nType exactly:  ${expected}\n> `, resolve));
  rl.close();
  if (answer.trim() !== expected) {
    console.error('Confirmation phrase did not match. Aborting.');
    process.exit(1);
  }

  // Execute — sequential, no retry per spec
  const receipt = [
    `# Cleanup Executed — 2026-05-16`,
    ``,
    `| sessionId | kind | action | path | status |`,
    `|---|---|---|---|---|`,
  ];
  for (const r of rows) {
    try {
      const result = r.action === 'DELETE_ROW' ? await execDelete(r) : await execClear(r);
      const tag =
        result.status === 200 ? '200_ok' :
        result.status === 404 ? 'already_gone' :
        `failed_${result.status}`;
      receipt.push(`| ${r.sessionId} | ${r.kind} | ${r.action} | ${r.field_path} | ${tag} |`);
      console.log(`  ${tag.padEnd(14)} ${r.action} ${r.kind}/${r.sessionId}`);
    } catch (e) {
      const tag = `error:${e.message.slice(0, 40)}`;
      receipt.push(`| ${r.sessionId} | ${r.kind} | ${r.action} | ${r.field_path} | ${tag} |`);
      console.log(`  ERROR          ${r.action} ${r.kind}/${r.sessionId}: ${e.message}`);
    }
  }
  fs.writeFileSync(RECEIPT_PATH, receipt.join('\n') + '\n');
  console.log(`\nReceipt: ${RECEIPT_PATH}`);
})();
