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
require('dotenv').config({ path: '.env.test' });
const fs   = require('fs');
const path = require('path');

const POLLUTION_PATTERNS = [
  /^(e2e-r\d+-)/,
  /^(dual-(r-)?uat-)/,
  /^(test-stub-)/,
  /^(smoke-)/,
  /^[a-zA-Z0-9_-]+-178\d{6,}-f\d/,
];

function isPolluted(s) {
  if (typeof s !== 'string' || s.length === 0) return false;
  return POLLUTION_PATTERNS.some((re) => re.test(s));
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
  const res = await fetch(`${baseUrl}/api/${kind}-sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /api/${kind}-sessions failed: ${res.status}`);
  return res.json();
}

function classifySession(session, kind) {
  const fields = extractStrings(session, kind);
  const polluted = fields.filter((f) => isPolluted(f.value));
  if (polluted.length === 0) return null;
  const allFieldsPolluted = polluted.length === fields.length;
  return {
    sessionId: session.id,
    kind,
    created_at: session.created_at,
    polluted,
    suggested_action: allFieldsPolluted ? 'DELETE_ROW' : 'CLEAR_FIELDS',
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

module.exports = { isPolluted, extractStrings, classifySession, renderReport };

if (require.main === module) {
  (async () => {
    const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
    const TOKEN    = process.env.REAL_ACCESS_TOKEN;
    if (!BASE_URL || !TOKEN) {
      console.error('Required env: BASE_URL + REAL_ACCESS_TOKEN (paste your access_token after logging in via the app).');
      process.exit(1);
    }
    try {
      const circlesRaw = await fetchSessions(BASE_URL, TOKEN, 'circles');
      const nsmRaw     = await fetchSessions(BASE_URL, TOKEN, 'nsm');
      const circles    = circlesRaw.map((s) => classifySession(s, 'circles')).filter(Boolean);
      const nsm        = nsmRaw.map((s) => classifySession(s, 'nsm')).filter(Boolean);

      const out = renderReport(circles, nsm);
      const outPath = path.join(__dirname, '..', 'audit', 'data-pollution-report-2026-05-16.md');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, out);
      console.log(`Report: ${outPath}`);
      console.log(`Polluted: ${circles.length + nsm.length} (${nsm.length} nsm, ${circles.length} circles)`);
    } catch (e) {
      console.error(`SCAN FAILED: ${e.message}`);
      process.exit(1);
    }
  })();
}
