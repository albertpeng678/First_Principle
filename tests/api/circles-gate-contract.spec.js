// tests/api/circles-gate-contract.spec.js
// Stage 1A Task 8 — API contract specs for /api/circles-sessions/:id/gate
//
// Testing trophy: API layer (60%) — no browser, Playwright request context.
// 6 specs covering: garbage / thin / quality inputs + response shape (items array
// + item fields) + 401 without auth token.
//
// Usage:
//   REAL_ACCESS_TOKEN=<jwt> npx playwright test --config tests/e2e/playwright.config.js --project=api-contract
//
// Without REAL_ACCESS_TOKEN: 5 token-gated specs skip gracefully; 401 spec runs always.

const { test, expect } = require('@playwright/test');
const factory = require('../factories/circles-phase1.factory');
const { assertNotProdWithRealAccount } = require('../helpers/env-guard');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKEN    = process.env.REAL_ACCESS_TOKEN;

// Spotify / circles_001 question — minimal fields needed by the route.
// The route reads session.question_json + session.drill_step from DB, so we just
// need question_json stored correctly on session creation.
const QUESTION_ID = 'circles_001';
const QUESTION_JSON = {
  id: 'circles_001',
  company: 'Spotify',
  problem_statement: '設計一個新功能，提升用戶在 Spotify 上的 Podcast 體驗，並增加用戶的黏著度。',
  common_wrong_directions: ['忽略用戶的內容偏好', '只專注於界面設計', '忽視音質和下載速度'],
};

// ---------------------------------------------------------------------------
// Helper: create a drill-mode circles session, return its id.
// Step: 'C1' so the gate reviews frameworkDraft.C1 fields.
// ---------------------------------------------------------------------------
async function createSession(request, token) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const res = await request.post(`${BASE_URL}/api/circles-sessions`, {
    headers,
    data: {
      questionId: QUESTION_ID,
      questionJson: QUESTION_JSON,
      mode: 'drill',
      drillStep: 'C1',
    },
  });
  // Accept both 200 and 201; route returns 200 with { sessionId }.
  if (res.status() >= 300) {
    throw new Error(`createSession failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.sessionId;
}

// ---------------------------------------------------------------------------
// Helper: call the gate endpoint.
// frameworkDraft: { I: {...4 fields}, C1: {...4 fields} } from factory.
// token: null → no Authorization header (for 401 test).
// ---------------------------------------------------------------------------
async function callGate(request, sessionId, frameworkDraft, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request.post(`${BASE_URL}/api/circles-sessions/${sessionId}/gate`, {
    headers,
    data: { frameworkDraft },
  });
}

// ---------------------------------------------------------------------------
// beforeAll: env-guard — refuse hitting prod with a real account.
// If TEST_EMAIL is unset, treat as test email (no prod block risk).
// ---------------------------------------------------------------------------
test.beforeAll(async () => {
  const email = process.env.TEST_EMAIL || 'e2e@first-principle.test';
  assertNotProdWithRealAccount({ baseUrl: BASE_URL, email });
});

// ---------------------------------------------------------------------------
// 6 specs
// ---------------------------------------------------------------------------
test.describe('POST /api/circles-sessions/:id/gate — contract', () => {

  // ── Spec 1 ──────────────────────────────────────────────────────────────
  test('garbage input → overallStatus=error', async ({ request }) => {
    test.skip(!TOKEN, 'REAL_ACCESS_TOKEN not provided — skip integration spec');
    const sessionId = await createSession(request, TOKEN);
    const res = await callGate(request, sessionId, factory.garbage(), TOKEN);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('overallStatus');
    expect(body.overallStatus).toBe('error');
  });

  // ── Spec 2 ──────────────────────────────────────────────────────────────
  test('thin input → overallStatus=warn or error', async ({ request }) => {
    test.skip(!TOKEN, 'REAL_ACCESS_TOKEN not provided — skip integration spec');
    const sessionId = await createSession(request, TOKEN);
    const res = await callGate(request, sessionId, factory.thin(), TOKEN);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('overallStatus');
    expect(['warn', 'error']).toContain(body.overallStatus);
  });

  // ── Spec 3 ──────────────────────────────────────────────────────────────
  test('quality input → overallStatus=ok', async ({ request }) => {
    test.skip(!TOKEN, 'REAL_ACCESS_TOKEN not provided — skip integration spec');
    const sessionId = await createSession(request, TOKEN);
    const res = await callGate(request, sessionId, factory.quality(), TOKEN);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('overallStatus');
    expect(body.overallStatus).toBe('ok');
  });

  // ── Spec 4 ──────────────────────────────────────────────────────────────
  test('response shape — items array present', async ({ request }) => {
    test.skip(!TOKEN, 'REAL_ACCESS_TOKEN not provided — skip integration spec');
    const sessionId = await createSession(request, TOKEN);
    const res = await callGate(request, sessionId, factory.quality(), TOKEN);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
  });

  // ── Spec 5 ──────────────────────────────────────────────────────────────
  // Response shape: each item has { field, status } with status ∈ {ok,warn,error}.
  // Route returns items from circles-gate.js prompt which uses `field` (not `box`).
  test('items shape — each item has field + status', async ({ request }) => {
    test.skip(!TOKEN, 'REAL_ACCESS_TOKEN not provided — skip integration spec');
    const sessionId = await createSession(request, TOKEN);
    const res = await callGate(request, sessionId, factory.quality(), TOKEN);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    for (const item of body.items) {
      expect(item).toHaveProperty('field');
      expect(item).toHaveProperty('status');
      expect(['ok', 'warn', 'error']).toContain(item.status);
    }
  });

  // ── Spec 6 — always runs, no token needed ────────────────────────────────
  // We use a placeholder session id (UUID format) — auth check fires before
  // the DB lookup, so we get 401 regardless of whether the session exists.
  test('401 without auth token', async ({ request }) => {
    const placeholderSessionId = '00000000-0000-0000-0000-000000000001';
    const res = await callGate(request, placeholderSessionId, factory.quality(), null);
    expect(res.status()).toBe(401);
  });
});
