// tests/api/nsm-no-bypass.spec.js
// Phase 1 Lane L18 — TDD-red spec: NSM gate bypass attempt on every leaky BE path.
// Mirror of circles-no-bypass.spec.js (L3 + L5) for NSM side.
// Any 2xx where >= 400 is expected = leak confirmed (bug evidence).
//
// Skills applied (mandatory cite):
//   api-testing.md:783-848  "Data seeding via service-role" — seed lifecycle='editing'/'gated'
//     precondition without going through the gate.
//   api-testing.md:1023-1166 "Error response testing" — assert 4xx guard; 2xx = bug.
//   crud-testing.md "Standard CRUD" — bypass attempt = invalid state transition.
//
// IL-3 TDD: tests written BEFORE production guard is added. Bypass paths are
// expected to return >= 400 (not yet implemented). Current behaviour is 200 → RED.
//
// Cleanup:
//   - Auth sessions: api-cleanup.fixture.js auto-deletes via DELETE /api/nsm-sessions/:id
//   - Guest sessions: service-role adminDb delete (guest cleanup outside fixture scope)
//
// E2E real-data discipline (three_iron_laws):
//   - No stub timestamps
//   - No mock of own API/DB
//   - No prod URL + real account (uses e2e@first-principle.test on localhost:4000)
//
// Leak inventory (audit/nsm-bypass-path-enumeration-2026-05-17.md §3):
//   LEAK-NSM-1: POST /api/nsm-sessions/:id/evaluate — no lifecycle guard (auth)
//   LEAK-NSM-2: POST /api/guest/nsm-sessions/:id/evaluate — no lifecycle guard (guest)

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// ── Service-role client — api-testing.md:783-848 "Data seeding via service-role" ──
// Used to: (a) set lifecycle='editing'/'gated' without calling /gate,
//          (b) delete guest sessions after test (guest route not in auth cleanup fixture).
// This tests that the BE itself enforces the guard — not just the FE flow.
const adminDb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Minimal valid NSM question (mirrors lifecycle-nsm.spec.js)
const QUESTION_ID = 'nsm_001';
const QUESTION_JSON = {
  id: 'nsm_001',
  problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
  product_context: 'Spotify 是全球最大的音樂串流平台，月活躍用戶超過 5 億，Podcast 是近年重要增長引擎',
};

// Substantive evaluate body — valid shape for evaluateNSM
const SUBSTANTIVE_NSM = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';
const SUBSTANTIVE_BREAKDOWN = {
  reach:     '每週至少訪問 Spotify 的用戶，約 3.5 億，其中 Podcast 觸及率目前 40%，即 1.4 億人',
  depth:     '播放超過 5 分鐘代表有意圖的消費行為，而非意外點擊',
  frequency: '週活躍而非月活躍，符合 Podcast 聆聽習慣，同時避免 day-of-week 偏差',
  impact:    '與廣告收入直接相關：Podcast 廣告 CPM 是音樂的 3-5 倍，提升此指標直接增加變現效率',
};

// ── helpers ───────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getE2eToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create auth NSM session (lifecycle='created').
 * Per api-testing.md:783-848: seed everything except what is under test.
 */
async function createAuthNsmSession(request, cleanupTracker) {
  const headers = await authHeaders();
  const res = await request.post(`${BASE_URL}/api/nsm-sessions`, {
    headers,
    data: { questionId: QUESTION_ID, questionJson: QUESTION_JSON },
  });
  // Per api-testing.md:1023-1166: assert status before body
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.sessionId).toBeTruthy();
  cleanupTracker.track('nsm', body.sessionId);
  return body.sessionId;
}

/**
 * Create guest NSM session (lifecycle='created').
 * Returns { sessionId, guestId } — guestId needed for subsequent calls + cleanup.
 */
async function createGuestNsmSession(request) {
  const guestId = randomUUID();
  const res = await request.post(`${BASE_URL}/api/guest/nsm-sessions`, {
    headers: { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' },
    data: { questionId: QUESTION_ID, questionJson: QUESTION_JSON },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.sessionId).toBeTruthy();
  return { sessionId: body.sessionId, guestId };
}

/**
 * Set auth NSM session lifecycle via service-role.
 * api-testing.md:783-848: "Seed via service-role to bypass the action under test."
 */
async function setNsmLifecycle(sessionId, lifecycle) {
  const { error } = await adminDb
    .from('nsm_sessions')
    .update({ lifecycle })
    .eq('id', sessionId);
  if (error) throw new Error(`setNsmLifecycle('${lifecycle}') failed: ${error.message}`);
}

/**
 * Delete NSM session via service-role (used for guest sessions which auth cleanup fixture cannot reach).
 */
async function deleteNsmSession(sessionId) {
  const { error } = await adminDb
    .from('nsm_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) {
    console.warn(`[nsm-no-bypass] service-role delete ${sessionId} failed: ${error.message}`);
  }
}

// ── setup ────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ── specs ────────────────────────────────────────────────────────────────────

test.describe('NSM gate bypass attempts — must be rejected', () => {

  // ── T-NSM-BYPASS-1: POST /evaluate with lifecycle='editing' — auth ─────────
  //
  // Source: audit/nsm-bypass-path-enumeration-2026-05-17.md §3 LEAK-NSM-1
  // Guard expected: route should check lifecycle in ['gated','completed'] before evaluating.
  // Current code (nsm-sessions.js:99-107): no lifecycle check — MISSING GUARD.
  // Root cause: lib/session-lifecycle.js:98 — 'analysis_done' immediately returns 'completed'
  //   regardless of prior lifecycle state.
  //
  // api-testing.md:1023-1166: assert 4xx; 2xx = bug evidence.
  // TDD-red: this test is expected RED (returns 200 or 500) until the guard is added.
  test('T-NSM-BYPASS-1: POST /evaluate on editing session → must be 403 (LEAK-NSM-1)', async ({ request, cleanupTracker }) => {
    // Seed: create auth session (lifecycle='created') → promote to 'editing' via service-role
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    await setNsmLifecycle(sessionId, 'editing');

    // Verify precondition via GET
    const headers = await authHeaders();
    const getRes = await request.get(`${BASE_URL}/api/nsm-sessions/${sessionId}`, { headers });
    expect(getRes.status()).toBe(200);
    const loaded = await getRes.json();
    expect(loaded.lifecycle).toBe('editing'); // confirm precondition

    // Bypass attempt: POST /evaluate without gate pass
    // api-testing.md:1023-1166 pattern: assert status first
    const evalRes = await request.post(
      `${BASE_URL}/api/nsm-sessions/${sessionId}/evaluate`,
      {
        headers,
        data: { userNsm: SUBSTANTIVE_NSM, userBreakdown: SUBSTANTIVE_BREAKDOWN },
      }
    );

    const status = evalRes.status();
    const body = await evalRes.json().catch(() => ({}));

    if (status === 200) {
      // BUG CONFIRMED: /evaluate accepted without gate pass, lifecycle promoted to 'completed'
      console.error('[T-NSM-BYPASS-1] BUG: /evaluate returned 200 with lifecycle=editing (no gate). body:', JSON.stringify(body).slice(0, 200));
    }

    expect(
      status,
      `T-NSM-BYPASS-1 LEAK: POST /evaluate returned ${status} with lifecycle=editing (no prior gate). Expected 403. Body: ${JSON.stringify(body)}`
    ).toBe(403);
    expect(body).toMatchObject({ error: 'gate_required' });
  });

  // ── T-NSM-BYPASS-2: POST /evaluate with lifecycle='created' — auth ─────────
  //
  // Source: audit/nsm-bypass-path-enumeration-2026-05-17.md §3 LEAK-NSM-1
  // Variant: lifecycle='created' (user never started editing) — even more egregious bypass.
  // computeLifecycle('analysis_done') returns 'completed' from any prior state (line 98).
  //
  // TDD-red: expected RED until guard is added.
  test('T-NSM-BYPASS-2: POST /evaluate on created session → must be 403 (LEAK-NSM-1 variant)', async ({ request, cleanupTracker }) => {
    // Session stays at lifecycle='created' — no service-role promotion needed
    const sessionId = await createAuthNsmSession(request, cleanupTracker);

    // Verify precondition
    const headers = await authHeaders();
    const getRes = await request.get(`${BASE_URL}/api/nsm-sessions/${sessionId}`, { headers });
    const loaded = await getRes.json();
    expect(loaded.lifecycle).toBe('created'); // confirm precondition

    // Bypass attempt: POST /evaluate on created session (never went through gate)
    const evalRes = await request.post(
      `${BASE_URL}/api/nsm-sessions/${sessionId}/evaluate`,
      {
        headers,
        data: { userNsm: SUBSTANTIVE_NSM, userBreakdown: SUBSTANTIVE_BREAKDOWN },
      }
    );

    const status = evalRes.status();
    const body = await evalRes.json().catch(() => ({}));

    if (status === 200) {
      console.error('[T-NSM-BYPASS-2] BUG: /evaluate returned 200 with lifecycle=created (no gate). body:', JSON.stringify(body).slice(0, 200));
    }

    expect(
      status,
      `T-NSM-BYPASS-2 LEAK: POST /evaluate returned ${status} with lifecycle=created (no prior gate). Expected 403. Body: ${JSON.stringify(body)}`
    ).toBe(403);
    expect(body).toMatchObject({ error: 'gate_required' });
  });

  // ── T-NSM-BYPASS-3: POST /evaluate with lifecycle='editing' — guest ────────
  //
  // Source: audit/nsm-bypass-path-enumeration-2026-05-17.md §3 LEAK-NSM-2
  // Guard expected: guest variant has identical missing guard as auth variant.
  // Current code (guest-nsm-sessions.js:89-119): no lifecycle check.
  //
  // Cleanup: service-role delete (guest sessions use x-guest-id, not auth; outside cleanup fixture scope).
  // TDD-red: expected RED until guard is added.
  test('T-NSM-BYPASS-3: POST /guest/evaluate on editing session → must be 403 (LEAK-NSM-2)', async ({ request }) => {
    // Create guest session + set lifecycle='editing' via service-role
    const { sessionId, guestId } = await createGuestNsmSession(request);
    try {
      await setNsmLifecycle(sessionId, 'editing');

      // Verify precondition via GET
      const guestHeaders = { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' };
      const getRes = await request.get(`${BASE_URL}/api/guest/nsm-sessions/${sessionId}`, { headers: guestHeaders });
      expect(getRes.status()).toBe(200);
      const loaded = await getRes.json();
      expect(loaded.lifecycle).toBe('editing'); // confirm precondition

      // Bypass attempt: POST /evaluate without gate pass (guest)
      const evalRes = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/evaluate`,
        {
          headers: guestHeaders,
          data: { userNsm: SUBSTANTIVE_NSM, userBreakdown: SUBSTANTIVE_BREAKDOWN },
        }
      );

      const status = evalRes.status();
      const body = await evalRes.json().catch(() => ({}));

      if (status === 200) {
        console.error('[T-NSM-BYPASS-3] BUG: guest /evaluate returned 200 with lifecycle=editing (no gate). body:', JSON.stringify(body).slice(0, 200));
      }

      expect(
        status,
        `T-NSM-BYPASS-3 LEAK: POST /guest/evaluate returned ${status} with lifecycle=editing (no prior gate). Expected 403. Body: ${JSON.stringify(body)}`
      ).toBe(403);
      expect(body).toMatchObject({ error: 'gate_required' });
    } finally {
      // Guest session cleanup via service-role (auth fixture cannot reach guest route)
      await deleteNsmSession(sessionId);
    }
  });

  // ── T-NSM-CONTROL-1 (control): lifecycle='gated' → /evaluate must pass ─────
  //
  // Control test (api-testing.md "Standard CRUD — bypass attempt pattern"):
  // Always include a passing control alongside bypass tests to confirm fixture works.
  // A session with lifecycle='gated' (seeded via service-role) calling /evaluate
  // should NOT receive 403 — should receive 200 (or 500 if OpenAI call fails,
  // but not a lifecycle-gate rejection).
  //
  // Note: This test calls real OpenAI (server-to-server; cannot be mocked via page.route).
  // test.slow() applied per when-to-mock.md §Real Service Strategies.
  test('T-NSM-CONTROL-1 (control): POST /evaluate with lifecycle=gated → NOT 403', async ({ request, cleanupTracker }) => {
    test.slow(); // calls real OpenAI
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    // Seed lifecycle='gated' via service-role — simulates a gate-passed session
    await setNsmLifecycle(sessionId, 'gated');

    // Verify precondition
    const headers = await authHeaders();
    const getRes = await request.get(`${BASE_URL}/api/nsm-sessions/${sessionId}`, { headers });
    const loaded = await getRes.json();
    expect(loaded.lifecycle).toBe('gated'); // confirm precondition

    // Happy-path evaluate: must NOT be rejected by a lifecycle guard
    const evalRes = await request.post(
      `${BASE_URL}/api/nsm-sessions/${sessionId}/evaluate`,
      {
        headers,
        data: { userNsm: SUBSTANTIVE_NSM, userBreakdown: SUBSTANTIVE_BREAKDOWN },
      }
    );

    const status = evalRes.status();

    // Guard must allow gated sessions through.
    // Accept 200 (success) or 500 (OpenAI error) — both mean the lifecycle guard passed.
    // Reject only 403 (gate_required) as that would mean the control is broken.
    expect(
      status,
      `T-NSM-CONTROL-1: /evaluate with lifecycle=gated returned ${status} — if 403, lifecycle guard is too strict`
    ).not.toBe(403);

    // Confirm: if 200, lifecycle should now be 'completed'
    if (status === 200) {
      const afterEval = await request.get(`${BASE_URL}/api/nsm-sessions/${sessionId}`, { headers });
      const afterBody = await afterEval.json();
      expect(afterBody.lifecycle).toBe('completed');
    }
  });

});
