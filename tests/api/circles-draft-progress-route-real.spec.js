// tests/api/circles-draft-progress-route-real.spec.js
//
// CIRCLES draft + progress route integration — real API layer test.
// Renamed from persist-retry-integration-real.spec.js per Review-3 audit:
// this file tests route correctness, not persistRetry wiring.
// These routes (POST /draft, PATCH /progress) are what window.persistRetry wraps
// in app.js (triggerSaveCycle ~line 3787, gateResult PATCH ~line 7519).
// Browser-side retry wiring + 503-503-200 proof: tests/e2e/persist-retry-browser-real.spec.js
//
// SCOPE RATIONALE (Phase 2 analysis)
// ─────────────────────────────────────────────────────────────────────────────
// persistRetry (public/lib/persistRetry.js) is a BROWSER-SIDE helper.
// It wraps window.apiFetch() calls inside public/app.js (triggerSaveCycle,
// submitFrameworkToGate). The retry math is fully covered by the pure unit
// test (tests/lib/persist-retry.test.js — 8 specs, KEEP per Trophy audit).
//
// INTEGRATION GAP — deterministic transient-failure simulation:
//   Supabase is called SERVER-SIDE from Express routes.
//   page.route() can only intercept browser-to-server calls, NOT server-to-Supabase.
//   Therefore we CANNOT force a 503-503-200 sequence at the Supabase layer
//   without either:
//     (a) a test-only fault-injector middleware in server.js (not yet built), or
//     (b) a dedicated Supabase proxy sidecar that counts calls (overkill).
//
//   RECOMMENDATION: add an Express middleware that reads
//   X-Test-Supabase-Fault-Count header and throws deliberately — only active
//   when NODE_ENV=test. That would make the exhaustion path deterministic.
//   Filed as future work; see report.
//
// WHAT THIS TEST DOES INSTEAD
// ─────────────────────────────────────────────────────────────────────────────
// Tests the REAL routes that persistRetry wraps, proving:
//   1. POST /api/circles-sessions/draft → session created (200)
//   2. PATCH /api/circles-sessions/:id/progress → draft persisted (200)
//   3. GET /api/circles-sessions/:id → confirms data round-trip to real Supabase DB
//
// This is the "happy path integration" approved by the task spec: real POST
// against /api/circles-sessions/draft → real PATCH /progress → GET round-trip.
// If these routes fail, persistRetry's retry loop has nothing useful to recover.
//
// Per when-to-mock.md decision matrix: NEVER mock own API/DB.
// Per api-testing.md §Chained API Calls: multi-step workflow, use returned IDs.
// Per Pitfall 11: no mock of own /api/* routes.
//
// Run:
//   npx playwright test --config tests/api/playwright.config.js \
//     tests/api/persist-retry-integration-real.spec.js

'use strict';

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// Real CIRCLES question_id from circles_database.json
const QUESTION_ID = 'circles_001';
const DRILL_STEP  = 'C1';

// Substantive draft — passes hasSubstantiveContent (non-stub)
// Same fixture used in lifecycle-circles.spec.js (verified green).
const SUBSTANTIVE_DRAFT = {
  C1: {
    問題範圍: '目標是提升 Spotify Podcast 功能的週活躍留存率，針對 18-35 歲通勤族',
    影響對象: '每週使用 Spotify 至少一次但 Podcast 使用率低的 MAU，約 4000 萬人',
    核心衝突: '用戶知道 Podcast 存在但發現路徑體驗差，不清楚如何找到適合節目',
    目標結果: '週 Podcast 活躍率從 15% 提升至 25%，DAU/MAU 比從 0.3 升至 0.45',
  },
};

// ── helpers ──────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getE2eToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ── setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async () => {
  // Warm up auth token cache once per file to avoid repeated auth round-trips.
  // Per api-testing.md §Request Fixtures: login via API before suite.
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ── specs ────────────────────────────────────────────────────────────────────

test.describe('CIRCLES draft + progress route integration — real API', () => {

  // ─── Test 1: Happy-path POST /draft → real session returned ────────────────
  //
  // Verifies the first route persistRetry wraps (ensureCirclesDraftSession →
  // POST /api/circles-sessions/draft). If this route is broken, persistRetry
  // has nothing to retry.
  //
  // Note: POST /draft is IDEMPOTENT — returns an existing active session if one
  // already exists for the same (question_id, mode, drill_step). This is by design
  // (Spec 2 § 3.1). We assert on the shape, not the specific lifecycle value.
  //
  // Per api-testing.md §JSON Response Assertions: assert status first, then body.
  test('POST /draft returns 200 with valid session shape (idempotent)', async ({ request, cleanupTracker }) => {
    const headers = await authHeaders();

    const res = await request.post(`${BASE_URL}/api/circles-sessions/draft`, {
      headers,
      data: { question_id: QUESTION_ID, mode: 'drill', drill_step: DRILL_STEP },
    });

    // Per api-testing.md §Anti-Patterns: always assert status first
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');

    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(typeof body.id).toBe('string');
    expect(body.question_id).toBe(QUESTION_ID);
    // Lifecycle is one of the valid states (route may return existing session)
    expect(['created', 'editing', 'gated', 'scored', 'completed']).toContain(body.lifecycle);

    // Register for cleanup — per api-testing.md §Anti-Patterns "Forget cleanup"
    // Note: if this is an existing session, cleanup may return 404 (acceptable)
    cleanupTracker.track('circles', body.id);
  });

  // ─── Test 2: Happy-path PATCH /progress + GET round-trip ──────────────────
  //
  // Verifies the main persistRetry call site: triggerSaveCycle →
  // PATCH /api/circles-sessions/:id/progress.
  // Proves the full persistence chain: POST draft → PATCH progress → GET verify.
  //
  // This is the critical integration path. If the PATCH persists correctly,
  // then persistRetry wrapping it is meaningful — the retry loop will
  // eventually deliver data that actually sticks in the DB.
  //
  // Uses a unique frameworkDraft value with a test-run timestamp to verify
  // the PATCH actually wrote new data (not just returning stale data).
  //
  // Per api-testing.md §Chained API Calls: multi-step workflow.
  // Per api-testing.md §Anti-Patterns: use unique identifiers (timestamps) for test data.
  test('PATCH /progress persists frameworkDraft — GET round-trip confirms write', async ({ request, cleanupTracker }) => {
    const headers = await authHeaders();

    // Step 1: obtain session via POST /draft (simulates ensureCirclesDraftSession)
    // Per api-testing.md §Chained API Calls: use returned ids, never hardcode.
    const draftRes = await request.post(`${BASE_URL}/api/circles-sessions/draft`, {
      headers,
      data: { question_id: QUESTION_ID, mode: 'drill', drill_step: DRILL_STEP },
    });
    expect(draftRes.status()).toBe(200);
    const session = await draftRes.json();
    cleanupTracker.track('circles', session.id);

    // Step 2: PATCH progress with a UNIQUE frameworkDraft value (timestamp-tagged)
    // so we can verify the PATCH wrote NEW data vs. returning stale content.
    // Simulates triggerSaveCycle → persistRetry(() => fetch(PATCH /progress)).
    const uniqueTag = `integration-test-${Date.now()}`;
    const draftWithTag = {
      C1: {
        問題範圍: `[${uniqueTag}] 提升 Spotify Podcast 週活躍留存率，針對 18-35 歲通勤族`,
        影響對象: '每週使用 Spotify 至少一次但 Podcast 使用率低的 MAU，約 4000 萬人',
        核心衝突: '用戶知道 Podcast 存在但發現路徑體驗差，不清楚如何找到適合節目',
        目標結果: '週 Podcast 活躍率從 15% 提升至 25%，DAU/MAU 從 0.3 升至 0.45',
      },
    };

    const patchRes = await request.patch(
      `${BASE_URL}/api/circles-sessions/${session.id}/progress`,
      {
        headers,
        data: {
          frameworkDraft: draftWithTag,
        },
      }
    );
    expect(patchRes.status()).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.ok).toBe(true);

    // Step 3: GET and verify — round-trip to real Supabase proves column was written
    // Per api-testing.md §JSON Response Assertions: deep assert on returned body.
    const getRes = await request.get(
      `${BASE_URL}/api/circles-sessions/${session.id}`,
      { headers }
    );
    expect(getRes.status()).toBe(200);
    const updated = await getRes.json();

    // framework_draft column must contain the unique-tagged value we just wrote.
    // This proves the PATCH actually hit Supabase, not just returned a mock.
    expect(updated.framework_draft).toMatchObject(draftWithTag);
    // Verify the unique tag survived the round-trip intact
    expect(updated.framework_draft.C1.問題範圍).toContain(uniqueTag);

    // Lifecycle monotone promotion: if session was 'created', it must now be
    // at least 'editing' (substantive frameworkDraft triggers promotion).
    // If session was already at a higher lifecycle, it stays there (monotone).
    expect(['editing', 'gated', 'scored', 'completed']).toContain(updated.lifecycle);
  });

});

// ── GAP DOCUMENTATION ────────────────────────────────────────────────────────
//
// DETERMINISTIC TRANSIENT-FAILURE SIMULATION — NOT POSSIBLE TODAY
// ────────────────────────────────────────────────────────────────
//
// The "503-503-200 recovery" and "503-503-503 exhaustion" scenarios described
// in the task require simulating transient Supabase failures at the server layer.
//
// Why Playwright page.route() cannot do this:
//   page.route() intercepts HTTP requests made FROM the BROWSER (renderer process).
//   When Express calls Supabase, that HTTP call is made by Node.js on the server.
//   The browser's network layer has no visibility into server-to-Supabase calls.
//   Therefore route.fulfill(503) would intercept the client→Express call, NOT
//   the Express→Supabase call. Intercepting client→Express is Pitfall 11 violation
//   (mocking own API) and would break the integration test premise.
//
// To enable deterministic retry simulation in the future, add:
//   server.js (test-only middleware, active only when TEST_FAULT_COUNT env is set):
//     app.use('/api/circles-sessions/:id/progress', (req, res, next) => {
//       const faults = parseInt(process.env.TEST_FAULT_COUNT || '0', 10);
//       if (faults > 0) {
//         process.env.TEST_FAULT_COUNT = String(faults - 1);
//         return res.status(503).json({ error: 'injected fault' });
//       }
//       next();
//     });
//   Then set TEST_FAULT_COUNT=2 before the test run to get 503-503-200 behavior.
//
// Until that fault injector exists, the retry math remains covered by the pure
// unit test (tests/lib/persist-retry.test.js), which uses jest fake timers to
// verify 503-503-200 recovery and 503×4 exhaustion deterministically.
