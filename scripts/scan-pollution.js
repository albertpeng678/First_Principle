#!/usr/bin/env node
/**
 * Read-only scan of user's real account for B7 pollution.
 * Reads:    BASE_URL, USER_REAL_EMAIL from .env.test (cleanup-only mode);
 *           access_token from env REAL_ACCESS_TOKEN (user pastes from browser).
 * Writes:   audit/data-pollution-report-2026-05-16.md
 * Exits 0:  scan complete (even if 0 polluted)
 * Exits 1:  network / auth / disk failure
 *
 * NOTE on list-endpoint field coverage:
 *   GET /api/circles-sessions returns: framework_draft (yes), phase2_chat_history (NO),
 *   phase2_conclusion_draft (NO) — those fields are only on GET /api/circles-sessions/:id.
 *   GET /api/nsm-sessions returns: user_nsm, user_breakdown (yes),
 *   user_explanation (NO), user_business_link (NO).
 *   extractStrings handles whatever fields are present and skips missing ones.
 *   For a deeper scan that includes phase2/explanation fields, use the /:id endpoint
 *   per-session — that is left for Step 6 coordination with the director.
 */
require('dotenv').config(); // load .env (USER_REAL_EMAIL, app secrets)
require('dotenv').config({ path: '.env.test', override: false }); // fill in BASE_URL etc.
const fs   = require('fs');
const path = require('path');

// Pollution detector — two complementary signals:
//
// 1) Known synthetic prefixes (cheap, explicit, no FP risk on user content).
// 2) Generalized "test-stub shape": the entire string is a chain of
//    lowercase-ascii / digit / `_` / `-` tokens that terminates in a 13-digit
//    unix-ms timestamp (optionally followed by `-fN` field-index marker, where
//    13 digits covers 2001-09 .. 2286-11). Examples:
//      repro-bug1-r5-1778906193039
//      e2e-r2-a6-depth-1778906193039
//      dual-uat-r2-c1-1778905724006-f3
//      stub_v2-1778822383000
//    Anchored to `^...$` and restricted to [a-z0-9_-], so Chinese / mixed-case
//    real content (e.g. "公司年營收 1789000000000", "User mentioned 178...")
//    cannot match — Chinese chars + spaces + uppercase all break the shape.
const POLLUTION_PATTERNS = [
  /^(e2e-r\d+-)/,
  /^(dual-(r-)?uat-)/,
  /^(test-stub-)/,
  /^(smoke-)/,
  /^(repro-)/,
  // Generalized shape: <lowercase-token>(-<lowercase-token>)*-<13-digit-ms>(-f\d+)?$
  // 13-digit unix-ms covers 2001-09-09 onward — any historic ts stub will match.
  /^[a-z0-9_]+(?:-[a-z0-9_]+)*-\d{13}(?:-f\d+)?$/,
];

function isPolluted(s) {
  if (typeof s !== 'string' || s.length === 0) return false;
  return POLLUTION_PATTERNS.some((re) => re.test(s));
}

// Recursive jsonb walker — emits {path, value} for every string leaf at any depth.
function walkStrings(value, prefix, out) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    out.push({ path: prefix, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkStrings(v, `${prefix}[${i}]`, out));
    return;
  }
  if (typeof value === 'object') {
    for (const k of Object.keys(value)) {
      walkStrings(value[k], `${prefix}.${k}`, out);
    }
  }
  // numbers/booleans/etc: skip
}

function extractStrings(session, kind) {
  if (!session || typeof session !== 'object') return [];
  const out = [];
  if (kind === 'circles') {
    if (session.framework_draft && typeof session.framework_draft === 'object') {
      for (const stepKey of Object.keys(session.framework_draft)) {
        const stepObj = session.framework_draft[stepKey];
        if (!stepObj || typeof stepObj !== 'object') continue;
        for (const fieldKey of Object.keys(stepObj)) {
          const v = stepObj[fieldKey];
          if (typeof v === 'string') {
            out.push({ path: `framework_draft.${stepKey}.${fieldKey}`, value: v });
          }
        }
      }
    }
    if (session.step_drafts && typeof session.step_drafts === 'object') {
      // step_drafts may be nested deeper than 2 levels (e.g. step_drafts.framework.I.排除對象)
      walkStrings(session.step_drafts, 'step_drafts', out);
    }
    if (Array.isArray(session.phase2_chat_history)) {
      session.phase2_chat_history.forEach((m, i) => {
        if (m && typeof m.text === 'string') {
          out.push({ path: `phase2_chat_history[${i}].text`, value: m.text });
        }
      });
    }
    if (typeof session.phase2_conclusion_draft === 'string') {
      out.push({ path: 'phase2_conclusion_draft', value: session.phase2_conclusion_draft });
    }
  } else if (kind === 'nsm') {
    if (typeof session.user_nsm === 'string') {
      out.push({ path: 'user_nsm', value: session.user_nsm });
    }
    if (session.user_breakdown && typeof session.user_breakdown === 'object') {
      for (const dim of ['reach', 'depth', 'frequency', 'impact']) {
        if (typeof session.user_breakdown[dim] === 'string') {
          out.push({ path: `user_breakdown.${dim}`, value: session.user_breakdown[dim] });
        }
      }
    }
    if (typeof session.user_explanation === 'string' && session.user_explanation) {
      out.push({ path: 'user_explanation', value: session.user_explanation });
    }
    if (typeof session.user_business_link === 'string' && session.user_business_link) {
      out.push({ path: 'user_business_link', value: session.user_business_link });
    }
  }
  return out;
}

async function fetchSessions(baseUrl, token, kind) {
  // BE default limit is 20; explicitly request max-50 to reduce pagination need.
  // (If user has >50 sessions, re-scan after each delete batch will surface the rest.)
  const res = await fetch(`${baseUrl}/api/${kind}-sessions?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /api/${kind}-sessions failed: ${res.status}`);
  return res.json();
}

async function fetchSessionDetail(baseUrl, token, kind, id) {
  const res = await fetch(`${baseUrl}/api/${kind}-sessions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /api/${kind}-sessions/${id} failed: ${res.status}`);
  return res.json();
}

function classifySession(session, kind) {
  const fields = extractStrings(session, kind);
  const polluted = fields.filter((f) => isPolluted(f.value));
  if (polluted.length === 0) return null;
  // "Real content" = non-empty + non-polluted. Empty strings are skeleton defaults
  // (BE inits user_nsm/etc to ''), so they don't count as user-typed answers.
  const realContent = fields.filter((f) => f.value && f.value.trim().length > 0 && !isPolluted(f.value));
  const noRealContent = realContent.length === 0;
  return {
    sessionId: session.id,
    kind,
    created_at: session.created_at,
    polluted,
    suggested_action: noRealContent ? 'DELETE_ROW' : 'CLEAR_FIELDS',
  };
}

function renderReport(circles, nsm) {
  const deletes = [];
  const clears  = [];
  for (const item of [...circles, ...nsm]) {
    if (item.suggested_action === 'DELETE_ROW') deletes.push(item);
    else clears.push(item);
  }

  const fmtRow = (it) => {
    const f = it.polluted[0];
    const sample = (f.value || '').slice(0, 60).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    return `| ${it.sessionId} | ${it.kind} | ${it.created_at} | ${f.path} | ${sample} | ☐ |`;
  };

  return [
    `# Data Pollution Report — 2026-05-16`,
    ``,
    `**Scanned:** ${process.env.USER_REAL_EMAIL || '<unknown>'} (real prod account)`,
    `**Patterns:** \`e2e-rN-\` / \`dual-uat-\` / \`*-178NNN-fN\` / \`test-stub-\` / \`smoke-\``,
    `**Result:** ${deletes.length + clears.length} polluted sessions found (${nsm.length} nsm + ${circles.length} circles)`,
    ``,
    `## DELETE list (whole row — created BY my UAT spec)`,
    ``,
    `| sessionId | kind | created_at | match field | sample (60 char) | confirm? |`,
    `|---|---|---|---|---|---|`,
    ...deletes.map(fmtRow),
    ``,
    `## CLEAR-FIELD list (legitimate session, single polluted field)`,
    ``,
    `| sessionId | kind | created_at | match field | sample (60 char) | confirm? |`,
    `|---|---|---|---|---|---|`,
    ...clears.map(fmtRow),
    ``,
    `## Curl preview (post-confirmation execution)`,
    ``,
    '```bash',
    `# DELETE rows`,
    ...deletes.map((it) => `curl -X DELETE "$BASE_URL/api/${it.kind}-sessions/${it.sessionId}" -H "Authorization: Bearer $TOKEN"`),
    ``,
    `# CLEAR fields (one example per row — execute-cleanup.js handles per-field PATCH)`,
    ...clears.map((it) => {
      const f = it.polluted[0];
      return `curl -X PATCH "$BASE_URL/api/${it.kind}-sessions/${it.sessionId}/progress" -H "Authorization: Bearer $TOKEN" -d '{"${f.path}": ""}'`;
    }),
    '```',
    ``,
  ].join('\n');
}

module.exports = { isPolluted, extractStrings, classifySession, renderReport, fetchSessions, fetchSessionDetail };

if (require.main === module) {
  (async () => {
    const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
    const TOKEN    = process.env.REAL_ACCESS_TOKEN;
    if (!BASE_URL || !TOKEN) {
      console.error('Required env: BASE_URL + REAL_ACCESS_TOKEN (paste your access_token after logging in via the app).');
      process.exit(1);
    }
    try {
      console.log(`Scanning ${BASE_URL} for pollution...`);

      console.log('  fetching circles session list...');
      const circlesList = await fetchSessions(BASE_URL, TOKEN, 'circles');
      console.log(`    ${circlesList.length} circles sessions`);

      console.log('  fetching circles session details (full fields)...');
      const circlesDetails = [];
      for (let i = 0; i < circlesList.length; i++) {
        const s = circlesList[i];
        const detail = await fetchSessionDetail(BASE_URL, TOKEN, 'circles', s.id);
        circlesDetails.push(detail);
        if ((i + 1) % 5 === 0 || i === circlesList.length - 1) {
          console.log(`    [${i + 1}/${circlesList.length}]`);
        }
      }

      console.log('  fetching nsm session list...');
      const nsmList = await fetchSessions(BASE_URL, TOKEN, 'nsm');
      console.log(`    ${nsmList.length} nsm sessions`);

      console.log('  fetching nsm session details (full fields)...');
      const nsmDetails = [];
      for (let i = 0; i < nsmList.length; i++) {
        const s = nsmList[i];
        const detail = await fetchSessionDetail(BASE_URL, TOKEN, 'nsm', s.id);
        nsmDetails.push(detail);
        if ((i + 1) % 5 === 0 || i === nsmList.length - 1) {
          console.log(`    [${i + 1}/${nsmList.length}]`);
        }
      }

      const circles = circlesDetails.map((s) => classifySession(s, 'circles')).filter(Boolean);
      const nsm     = nsmDetails.map((s) => classifySession(s, 'nsm')).filter(Boolean);

      const out = renderReport(circles, nsm);
      const outPath = path.join(__dirname, '..', 'audit', 'data-pollution-report-2026-05-16.md');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, out);
      console.log(`\nReport: ${outPath}`);
      console.log(`Polluted: ${circles.length + nsm.length} (${nsm.length} nsm, ${circles.length} circles)`);
      console.log(`Total scanned: ${circlesDetails.length + nsmDetails.length} sessions`);
    } catch (e) {
      console.error(`SCAN FAILED: ${e.message}`);
      process.exit(1);
    }
  })();
}
