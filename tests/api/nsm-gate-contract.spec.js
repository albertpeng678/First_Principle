// tests/api/nsm-gate-contract.spec.js
// N-01 — API contract test for POST /api/nsm-sessions/:id/gate
//
// Mirrors circles-gate-contract.spec.js for NSM.
// Testing trophy: API layer (60%) — no browser, Playwright request context.
// 3 specs: 401 without auth / 400 missing required fields / 200 response shape.
//
// Response shape per prompts/nsm-gate.js reviewNSMGate():
//   { items: [4 × { criterion, status, feedback, suggestion }],
//     canProceed: boolean,
//     overallStatus: "ok" | "warn" | "error" }
//
// Skills applied:
//   api-testing.md lines 903-1021 (schema validation) + 1023-1166 (error responses)
//   per when-to-mock.md: page.route() cannot intercept server-side OpenAI calls
//   (api-testing.md config comment: "Gate/evaluate tests need page.route() for
//   client browser; server-side HTTP to api.openai.com is NOT interceptable").
//   REAL_ACCESS_TOKEN guard (mirrors circles-gate-contract.spec.js pattern).
//
// Usage:
//   REAL_ACCESS_TOKEN=<jwt> npx playwright test \
//     --config tests/e2e/playwright.config.js --project=api-contract \
//     tests/api/nsm-gate-contract.spec.js
//
// Without REAL_ACCESS_TOKEN: 2 token-gated specs skip; 401 spec runs always.

const { test, expect } = require('@playwright/test');
const { assertNotProdWithRealAccount } = require('../helpers/env-guard');
const { getE2eToken } = require('./helpers/auth');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

// API tests hit Express on :4000, not FE on :3000. BASE_URL env is FE port — ignore.
const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// NSM question used to seed the test session.
// Matches the nsm_001 question shape from lifecycle-nsm.spec.js.
const QUESTION_ID = 'nsm_001';
const QUESTION_JSON = {
  id: 'nsm_001',
  company: 'Spotify',
  industry: '串流媒體',
  problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
  product_context: 'Spotify 是全球最大的音樂串流平台，月活躍用戶超過 5 億，Podcast 是近年重要增長引擎',
};

// Substantive NSM + rationale — passes the nsm-gate.js quality bar reliably.
// Specific user behaviour + quantification + clear business link.
const GOOD_NSM =
  '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';
const GOOD_RATIONALE =
  '此指標直接反映核心使用行為，且與廣告收入正相關：Podcast 廣告 CPM 是音樂的 3-5 倍；週頻率符合 Podcast 聆聽習慣，避免 day-of-week 偏差';

// 4 criterion names per nsm-gate.js CRITERIA_GUIDE (order-locked).
const EXPECTED_CRITERIA = [
  'NSM定義清晰度',
  '與業務目標的連結',
  '可測量性',
  '非虛榮指標',
];

// ---------------------------------------------------------------------------
// Helper: POST /api/nsm-sessions to seed a real session; return sessionId.
// ---------------------------------------------------------------------------
async function createSession(request, token) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const res = await request.post(`${BASE_URL}/api/nsm-sessions`, {
    headers,
    data: { questionId: QUESTION_ID, questionJson: QUESTION_JSON },
  });
  if (res.status() >= 300) {
    throw new Error(`createSession failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.sessionId;
}

// ---------------------------------------------------------------------------
// Helper: DELETE /api/nsm-sessions/:id for post-test cleanup.
// Tolerates 404 (already deleted or never created).
// ---------------------------------------------------------------------------
async function deleteSession(request, sessionId, token) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  await request.delete(`${BASE_URL}/api/nsm-sessions/${sessionId}`, { headers });
}

// ---------------------------------------------------------------------------
// Helper: call the gate endpoint.
// token: null → omits Authorization header (for 401 test).
// ---------------------------------------------------------------------------
async function callGate(request, sessionId, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request.post(`${BASE_URL}/api/nsm-sessions/${sessionId}/gate`, {
    headers,
    data: body,
  });
}

// ---------------------------------------------------------------------------
// beforeAll: env-guard — refuse hitting prod with a real account.
// ---------------------------------------------------------------------------
test.beforeAll(async () => {
  const email = process.env.TEST_EMAIL || 'e2e@first-principle.test';
  assertNotProdWithRealAccount({ baseUrl: BASE_URL, email });
});

// ---------------------------------------------------------------------------
// 3 specs
// ---------------------------------------------------------------------------
test.describe('POST /api/nsm-sessions/:id/gate — contract', () => {

  // ── Test 1 — always runs, no token needed ──────────────────────────────────
  // Auth check fires before the DB lookup, so we get 401 regardless of whether
  // the session exists. Placeholder session id (UUID format) avoids a real DB hit.
  test('401 without auth token', async ({ request }) => {
    const placeholderSessionId = '00000000-0000-0000-0000-000000000002';
    const res = await callGate(
      request,
      placeholderSessionId,
      { nsm: GOOD_NSM, rationale: GOOD_RATIONALE },
      null, // no token
    );
    expect(res.status()).toBe(401);
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────
  // 400 when required body fields are missing.
  // Route guard (lines 131-134 routes/nsm-sessions.js): both nsm + rationale
  // must be non-empty strings. No OpenAI call is made — pure sync validation.
  test('400 when required body fields are missing', async ({ request }) => {
    const token = await getE2eToken();
    let sessionId;
    try {
      sessionId = await createSession(request, token);

      // Missing rationale field entirely
      const res = await callGate(request, sessionId, { nsm: GOOD_NSM }, token);
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body).toHaveProperty('error');
    } finally {
      if (sessionId) await deleteSession(request, sessionId, token);
    }
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────
  // 200 + full response shape:
  //   canProceed (boolean), overallStatus (ok|warn|error),
  //   items (array of 4) with { criterion, status, feedback } per nsm-gate.js.
  // Calls real OpenAI (server-to-server; page.route cannot intercept).
  // Per when-to-mock.md + api/playwright.config.js comment — accept real call here.
  test('200 + response shape: canProceed + overallStatus + 4-item criteria array', async ({ request }) => {
    test.slow(); // real OpenAI call, ~3-8 s
    const token = await getE2eToken();
    let sessionId;
    try {
      sessionId = await createSession(request, token);

      const res = await callGate(
        request,
        sessionId,
        { nsm: GOOD_NSM, rationale: GOOD_RATIONALE },
        token,
      );
      expect(res.status()).toBe(200);

      const body = await res.json();

      // Top-level shape
      expect(typeof body.canProceed).toBe('boolean');
      expect(['ok', 'warn', 'error']).toContain(body.overallStatus);

      // items array: exactly 4 per nsm-gate.js schema validation
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items).toHaveLength(4);

      // Per-item shape: { criterion, status, feedback, suggestion }
      for (const item of body.items) {
        expect(typeof item.criterion).toBe('string');
        expect(['ok', 'warn', 'error']).toContain(item.status);
        expect(typeof item.feedback).toBe('string');
        // suggestion is null when status=ok, string otherwise (both are valid)
        const suggestionValid =
          item.suggestion === null || typeof item.suggestion === 'string';
        expect(suggestionValid).toBe(true);
      }

      // Criterion names must match the 4 locked names (order-consistent per spec)
      const returnedCriteria = body.items.map((it) => it.criterion);
      for (const name of EXPECTED_CRITERIA) {
        expect(returnedCriteria).toContain(name);
      }
    } finally {
      if (sessionId) await deleteSession(request, sessionId, token);
    }
  });
});
