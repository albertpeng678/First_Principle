// tests/api/nsm-context-hints-progress-coverage.spec.js
// Phase 1 Lane L26 — NSM /context + /hints + PATCH /progress comprehensive bypass audit.
// Extends L18 coverage: L18 focused on /evaluate (LEAK-NSM-1/2); L18 audit explicitly
// marked /context, /hints, /progress as "low-risk" without reproduce specs.
// This file confirms each is either safe-by-design or surfaces a hidden bypass.
//
// Skills applied (mandatory cite):
//   api-testing.md:783-848  "Data seeding via service-role" — seed lifecycle preconditions.
//   api-testing.md:1023-1166 "Error response testing" — assert expected status per state.
//   crud-testing.md "Standard CRUD" — parametrize by endpoint × lifecycle state.
//
// Karpathy guidelines applied:
//   Think Before: endpoints fully classified before tests written (see audit §1).
//   Simplicity First: parameterized by state within describe blocks, not test proliferation.
//   Surgical Changes: new spec + audit doc ONLY — no production code touched.
//   Goal-Driven: clear verdict per endpoint (safe / leak found).
//
// Classification (audit/L26-nsm-context-hints-progress-coverage-2026-05-17.md §1):
//   /context     — By-design open (no DB mutation; read-only AI call)
//   /hints       — By-design open (STANDING RULE: hints always available)
//   PATCH /progress — No lifecycle-bypass risk after L19 /evaluate guard:
//                     currentStep/gateResult writes to progress_json only;
//                     lifecycle monotone; cannot promote to 'gated' via PATCH.
//
// E2E real-data discipline (three_iron_laws):
//   - No stub timestamps
//   - No mock of own API/DB
//   - No prod URL + real account (uses e2e@first-principle.test on localhost:4000)
//
// Cross-ref: audit/nsm-bypass-path-enumeration-2026-05-17.md §3 (L18 original classification)
//            routes/nsm-sessions.js:193-205 (/context), 271-288 (/hints), 209-268 (PATCH /progress)
//            routes/guest-nsm-sessions.js:157-169 (/context), 240-257 (/hints), 176-237 (PATCH /progress)

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// ── Service-role client — api-testing.md:783-848 "Data seeding via service-role" ──
// Used to: (a) set lifecycle without calling /gate,
//          (b) read lifecycle after PATCH to verify no unexpected mutation,
//          (c) delete guest sessions post-test.
const adminDb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Minimal valid NSM question (mirrors nsm-no-bypass.spec.js / lifecycle-nsm.spec.js)
const QUESTION_ID = 'nsm_001';
const QUESTION_JSON = {
  id: 'nsm_001',
  problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
  product_context: 'Spotify 是全球最大的音樂串流平台，月活躍用戶超過 5 億，Podcast 是近年重要增長引擎',
};

// Substantive NSM content for /hints requests
const SUBSTANTIVE_NSM = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';

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
 * api-testing.md:783-848: seed everything except what is under test.
 */
async function createAuthNsmSession(request, cleanupTracker) {
  const headers = await authHeaders();
  const res = await request.post(`${BASE_URL}/api/nsm-sessions`, {
    headers,
    data: { questionId: QUESTION_ID, questionJson: QUESTION_JSON },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.sessionId).toBeTruthy();
  cleanupTracker.track('nsm', body.sessionId);
  return body.sessionId;
}

/**
 * Create guest NSM session (lifecycle='created').
 * Returns { sessionId, guestId }.
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
 * Set NSM session lifecycle via service-role (bypass-free precondition seed).
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
 * Read lifecycle of NSM session via service-role.
 * Used to verify PATCH /progress does not unexpectedly mutate lifecycle.
 */
async function getNsmLifecycle(sessionId) {
  const { data, error } = await adminDb
    .from('nsm_sessions')
    .select('lifecycle, progress_json')
    .eq('id', sessionId)
    .single();
  if (error) throw new Error(`getNsmLifecycle(${sessionId}) failed: ${error.message}`);
  return data;
}

/**
 * Delete NSM session via service-role (for guest sessions outside auth cleanup fixture).
 */
async function deleteNsmSession(sessionId) {
  const { error } = await adminDb
    .from('nsm_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) {
    console.warn(`[L26] service-role delete ${sessionId} failed: ${error.message}`);
  }
}

// ── setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ═══════════════════════════════════════════════════════════════════════════════
// §A — POST /context coverage (auth + guest × 2 lifecycle states)
//
// Handler analysis:
//   nsm-sessions.js:193-205 — fetches question_json, calls generateNSMContext(), no DB write.
//   guest-nsm-sessions.js:157-169 — identical pattern.
//
// Security classification: BY-DESIGN OPEN.
//   - No DB state mutation of any kind.
//   - OpenAI call generates context for any valid session (expected behaviour).
//   - Having 'created'/'editing' lifecycle should not block context generation.
//   - L18 audit correctly marked "Low risk — read-only AI call, no DB state mutation."
//
// Tests:
//   TC-CTX-1: /context with lifecycle='created' → 200 (by-design open)
//   TC-CTX-2: /context with lifecycle='editing' → 200 (by-design open)
//   TC-CTX-3: /context with lifecycle='completed' → 200 (by-design open even post-completion)
//   TC-CTX-4: guest /context with lifecycle='created' → 200 (guest variant)
//   TC-CTX-5: /context lifecycle does NOT mutate after call
//   TC-CTX-6: /context with wrong owner → 404 (ownership guard works)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('POST /context — by-design open in all lifecycle states', () => {

  // TC-CTX-1: /context with lifecycle='created' → must return 200
  // Confirms context generation is available before user starts editing.
  // nsm-sessions.js:193-205 — no lifecycle gate; only ownership check.
  test('TC-CTX-1: POST /context with lifecycle=created → 200 (auth)', async ({ request, cleanupTracker }) => {
    test.slow(); // calls real OpenAI (server-to-server)
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    // Session stays at lifecycle='created' — no service-role promotion

    const headers = await authHeaders();
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/${sessionId}/context`, { headers });

    const status = res.status();
    const body = await res.json().catch(() => ({}));

    // By-design open: any 2xx is correct; 403 would mean an unexpected guard
    expect(
      status,
      `TC-CTX-1: /context with lifecycle=created returned ${status} — expected 200. Body: ${JSON.stringify(body)}`
    ).toBe(200);
    // Response should contain context-shaped content (not an error object)
    expect(body).not.toMatchObject({ error: expect.any(String) });
  });

  // TC-CTX-2: /context with lifecycle='editing' → must return 200
  // Confirms context is available mid-editing (typical use: user opens hint panel while editing).
  // nsm-sessions.js:193-205 — no lifecycle gate.
  test('TC-CTX-2: POST /context with lifecycle=editing → 200 (auth)', async ({ request, cleanupTracker }) => {
    test.slow(); // calls real OpenAI (server-to-server)
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    await setNsmLifecycle(sessionId, 'editing');

    const headers = await authHeaders();
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/${sessionId}/context`, { headers });

    const status = res.status();
    const body = await res.json().catch(() => ({}));

    expect(
      status,
      `TC-CTX-2: /context with lifecycle=editing returned ${status} — expected 200. Body: ${JSON.stringify(body)}`
    ).toBe(200);
    expect(body).not.toMatchObject({ error: expect.any(String) });
  });

  // TC-CTX-3: /context with lifecycle='completed' → must return 200
  // Confirms context remains available post-evaluation (e.g. user reviews context after score).
  // nsm-sessions.js:193-205 — no lifecycle gate.
  test('TC-CTX-3: POST /context with lifecycle=completed → 200 (auth)', async ({ request, cleanupTracker }) => {
    test.slow(); // calls real OpenAI (server-to-server)
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    await setNsmLifecycle(sessionId, 'completed');

    const headers = await authHeaders();
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/${sessionId}/context`, { headers });

    const status = res.status();
    const body = await res.json().catch(() => ({}));

    expect(
      status,
      `TC-CTX-3: /context with lifecycle=completed returned ${status} — expected 200. Body: ${JSON.stringify(body)}`
    ).toBe(200);
    expect(body).not.toMatchObject({ error: expect.any(String) });
  });

  // TC-CTX-4: guest /context with lifecycle='created' → 200
  // guest-nsm-sessions.js:157-169 — same pattern as auth variant.
  test('TC-CTX-4: POST /guest/context with lifecycle=created → 200 (guest)', async ({ request }) => {
    test.slow(); // calls real OpenAI (server-to-server)
    const { sessionId, guestId } = await createGuestNsmSession(request);
    try {
      const guestHeaders = { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' };
      const res = await request.post(`${BASE_URL}/api/guest/nsm-sessions/${sessionId}/context`, {
        headers: guestHeaders,
      });

      const status = res.status();
      const body = await res.json().catch(() => ({}));

      expect(
        status,
        `TC-CTX-4: guest /context with lifecycle=created returned ${status} — expected 200. Body: ${JSON.stringify(body)}`
      ).toBe(200);
      expect(body).not.toMatchObject({ error: expect.any(String) });
    } finally {
      await deleteNsmSession(sessionId);
    }
  });

  // TC-CTX-5: /context does NOT mutate session lifecycle (read-only confirmation)
  // Verifies L18 audit claim "no DB state mutation" by reading lifecycle before/after.
  // nsm-sessions.js:193-205 — no DB write in handler; only res.json(context).
  test('TC-CTX-5: POST /context does NOT mutate session lifecycle', async ({ request, cleanupTracker }) => {
    test.slow(); // calls real OpenAI (server-to-server)
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    await setNsmLifecycle(sessionId, 'editing');

    const before = await getNsmLifecycle(sessionId);
    expect(before.lifecycle).toBe('editing'); // precondition confirmed

    const headers = await authHeaders();
    await request.post(`${BASE_URL}/api/nsm-sessions/${sessionId}/context`, { headers });

    const after = await getNsmLifecycle(sessionId);
    expect(
      after.lifecycle,
      `TC-CTX-5: lifecycle mutated after /context: before=editing, after=${after.lifecycle}`
    ).toBe('editing'); // lifecycle must be unchanged
  });

  // TC-CTX-6: /context with wrong owner → 404 (ownership guard in place)
  // nsm-sessions.js:198 — .eq('user_id', req.user.id) ensures row ownership.
  // This tests the ownership guard still works for /context (not a bypass concern,
  // but confirms the ONLY guard in place — ownership, not lifecycle — functions correctly).
  // Note: cannot test with a different real user; use a random UUID as session ID instead
  // (row won't exist for this user → same 404 result as ownership mismatch).
  test('TC-CTX-6: POST /context on non-existent session → 404', async ({ request }) => {
    const headers = await authHeaders();
    const fakeId = randomUUID();
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/${fakeId}/context`, { headers });

    expect(
      res.status(),
      `TC-CTX-6: /context on non-existent session returned ${res.status()} — expected 404`
    ).toBe(404);
    const body = await res.json().catch(() => ({}));
    expect(body).toMatchObject({ error: 'not_found' });
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// §B — POST /hints coverage (auth + guest × 2 lifecycle states)
//
// Handler analysis:
//   nsm-sessions.js:271-288 — fetches question_json, calls generateNSMHints(), no DB write.
//   guest-nsm-sessions.js:240-257 — identical pattern.
//
// Security classification: BY-DESIGN OPEN (STANDING RULE).
//   - Memory feedback_lock_state_hint_example_always_available.md:
//     "Lock state 仍可看提示/範例 — STANDING RULE: 已評分 locked 只鎖 form 編輯+移除 submit，
//      「提示」+「範例答案」button 永遠可用 / cross-mockup 通用"
//   - L18 audit: "By design — hint is always available (STANDING RULE: Lock state hint/example always available)"
//   - No DB mutation: handler only reads question_json + calls OpenAI.
//
// Tests:
//   TC-HNT-1: /hints with lifecycle='created' → 200 (by-design open)
//   TC-HNT-2: /hints with lifecycle='completed' → 200 (available even after evaluation)
//   TC-HNT-3: guest /hints with lifecycle='editing' → 200 (guest variant)
//   TC-HNT-4: /hints does NOT mutate session lifecycle (read-only confirmation)
//   TC-HNT-5: /hints with wrong session ID → 404 (ownership guard)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('POST /hints — by-design open in all lifecycle states (STANDING RULE)', () => {

  // TC-HNT-1: /hints with lifecycle='created' → 200
  // STANDING RULE: hints always available. lifecycle='created' must not block hint generation.
  // nsm-sessions.js:271-288 — no lifecycle check; only .eq('user_id', req.user.id).
  test('TC-HNT-1: POST /hints with lifecycle=created → 200 (auth)', async ({ request, cleanupTracker }) => {
    test.slow(); // calls real OpenAI (server-to-server)
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    // Stays at lifecycle='created'

    const headers = await authHeaders();
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/${sessionId}/hints`, {
      headers,
      data: { userNsm: '' }, // empty userNsm is valid (handler coalesces to '')
    });

    const status = res.status();
    const body = await res.json().catch(() => ({}));

    expect(
      status,
      `TC-HNT-1: /hints with lifecycle=created returned ${status} — expected 200. Body: ${JSON.stringify(body)}`
    ).toBe(200);
    expect(body).not.toMatchObject({ error: expect.any(String) });
  });

  // TC-HNT-2: /hints with lifecycle='completed' → 200
  // STANDING RULE: hints must remain available after evaluation (locked state).
  // nsm-sessions.js:271-288 — no lifecycle check at all.
  test('TC-HNT-2: POST /hints with lifecycle=completed → 200 (auth)', async ({ request, cleanupTracker }) => {
    test.slow(); // calls real OpenAI (server-to-server)
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    await setNsmLifecycle(sessionId, 'completed');

    const headers = await authHeaders();
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/${sessionId}/hints`, {
      headers,
      data: { userNsm: SUBSTANTIVE_NSM },
    });

    const status = res.status();
    const body = await res.json().catch(() => ({}));

    expect(
      status,
      `TC-HNT-2: /hints with lifecycle=completed returned ${status} — expected 200. Body: ${JSON.stringify(body)}`
    ).toBe(200);
    expect(body).not.toMatchObject({ error: expect.any(String) });
  });

  // TC-HNT-3: guest /hints with lifecycle='editing' → 200
  // guest-nsm-sessions.js:240-257 — same pattern as auth; no lifecycle gate.
  test('TC-HNT-3: POST /guest/hints with lifecycle=editing → 200 (guest)', async ({ request }) => {
    test.slow(); // calls real OpenAI (server-to-server)
    const { sessionId, guestId } = await createGuestNsmSession(request);
    try {
      await setNsmLifecycle(sessionId, 'editing');

      const guestHeaders = { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' };
      const res = await request.post(`${BASE_URL}/api/guest/nsm-sessions/${sessionId}/hints`, {
        headers: guestHeaders,
        data: { userNsm: SUBSTANTIVE_NSM },
      });

      const status = res.status();
      const body = await res.json().catch(() => ({}));

      expect(
        status,
        `TC-HNT-3: guest /hints with lifecycle=editing returned ${status} — expected 200. Body: ${JSON.stringify(body)}`
      ).toBe(200);
      expect(body).not.toMatchObject({ error: expect.any(String) });
    } finally {
      await deleteNsmSession(sessionId);
    }
  });

  // TC-HNT-4: /hints does NOT mutate session lifecycle (read-only confirmation)
  // Verifies L18 audit claim "no DB state mutation" for /hints endpoint.
  // nsm-sessions.js:271-288 — no DB write in handler; only res.json(hints).
  test('TC-HNT-4: POST /hints does NOT mutate session lifecycle', async ({ request, cleanupTracker }) => {
    test.slow(); // calls real OpenAI (server-to-server)
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    await setNsmLifecycle(sessionId, 'editing');

    const before = await getNsmLifecycle(sessionId);
    expect(before.lifecycle).toBe('editing'); // precondition

    const headers = await authHeaders();
    await request.post(`${BASE_URL}/api/nsm-sessions/${sessionId}/hints`, {
      headers,
      data: { userNsm: SUBSTANTIVE_NSM },
    });

    const after = await getNsmLifecycle(sessionId);
    expect(
      after.lifecycle,
      `TC-HNT-4: lifecycle mutated after /hints: before=editing, after=${after.lifecycle}`
    ).toBe('editing');
  });

  // TC-HNT-5: /hints on non-existent session → 404 (ownership guard)
  // nsm-sessions.js:276-279 — .single() + ownership check returns null → 404.
  test('TC-HNT-5: POST /hints on non-existent session → 404', async ({ request }) => {
    const headers = await authHeaders();
    const fakeId = randomUUID();
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/${fakeId}/hints`, {
      headers,
      data: { userNsm: '' },
    });

    expect(
      res.status(),
      `TC-HNT-5: /hints on non-existent session returned ${res.status()} — expected 404`
    ).toBe(404);
    const body = await res.json().catch(() => ({}));
    expect(body).toMatchObject({ error: 'not_found' });
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// §C — PATCH /progress coverage (auth + guest × multiple state transitions)
//
// Handler analysis:
//   nsm-sessions.js:209-268 — accepts currentStep, userNsm, userBreakdown, gateResult,
//     reportTab, progress, userExplanation, userBusinessLink.
//   guest-nsm-sessions.js:176-237 — mirrors auth variant.
//
// Security classification: NO LIFECYCLE-BYPASS RISK (after L19 /evaluate guard).
//   Key reasoning:
//   1. lifecycle is deleted from req.body (line 211/178) — FE cannot set it.
//   2. computeLifecycle() with route='patch' can only advance created→editing
//      (if substantive content provided) — cannot set 'gated' or 'completed'.
//   3. gateResult written to progress_json is cosmetic UI state (step restoration).
//      It does NOT promote lifecycle to 'gated'.
//   4. currentStep can be written to progress_json without gate — data integrity
//      concern only (FE step indicator). After L19 fix, /evaluate requires
//      lifecycle in ['gated','completed'], so currentStep spoofing cannot unlock evaluate.
//   5. The medium-risk classification in L18 was: "currentStep can be advanced without gate
//      (data integrity, not state bypass)." L19 evaluate guard closes that vector.
//
// Tests:
//   TC-PRG-1: PATCH /progress with userNsm + userBreakdown → lifecycle promoted created→editing
//   TC-PRG-2: PATCH /progress cannot write lifecycle (stripped server-side)
//   TC-PRG-3: PATCH /progress cannot promote lifecycle to 'gated' via gateResult payload
//   TC-PRG-4: PATCH /progress currentStep write does NOT promote lifecycle past 'editing'
//   TC-PRG-5: PATCH /progress on completed session → lifecycle stays 'completed' (monotone)
//   TC-PRG-6: guest PATCH /progress with currentStep=3 → does NOT bypass lifecycle
//   TC-PRG-7: PATCH /progress on non-existent session → 404
//   TC-PRG-8: PATCH /progress with empty body → 400 (nothing_to_update guard)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('PATCH /progress — no lifecycle-bypass risk (by-design safe)', () => {

  // TC-PRG-1: PATCH /progress with substantive content → lifecycle created→editing
  // Verifies the normal editing promotion path works as specified.
  // nsm-sessions.js:248 — computeLifecycle(prior, body, 'nsm', 'patch') → 'editing'
  // when prior='created' and body contains substantive userNsm/userBreakdown.
  test('TC-PRG-1: PATCH /progress with userNsm → lifecycle advances created→editing', async ({ request, cleanupTracker }) => {
    const sessionId = await createAuthNsmSession(request, cleanupTracker);

    const before = await getNsmLifecycle(sessionId);
    expect(before.lifecycle).toBe('created'); // precondition

    const headers = await authHeaders();
    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${sessionId}/progress`, {
      headers,
      data: { userNsm: SUBSTANTIVE_NSM },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });

    const after = await getNsmLifecycle(sessionId);
    expect(
      after.lifecycle,
      `TC-PRG-1: lifecycle should advance to 'editing' after substantive userNsm PATCH`
    ).toBe('editing');
  });

  // TC-PRG-2: PATCH /progress cannot set lifecycle directly — stripped server-side
  // nsm-sessions.js:211 — `delete req.body.lifecycle;` prevents FE from setting lifecycle.
  // Attempt to set lifecycle='gated' via body — must be ignored; lifecycle stays at prior.
  test('TC-PRG-2: PATCH /progress with lifecycle=gated in body → lifecycle NOT promoted to gated', async ({ request, cleanupTracker }) => {
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    await setNsmLifecycle(sessionId, 'editing'); // precondition: editing

    const headers = await authHeaders();
    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${sessionId}/progress`, {
      headers,
      data: {
        lifecycle: 'gated',  // <-- should be stripped by server (nsm-sessions.js:211)
        currentStep: 2,
      },
    });

    // Should succeed (currentStep written to progress_json)
    expect(res.status()).toBe(200);

    // But lifecycle must NOT be 'gated' — server stripped the FE-supplied lifecycle
    const after = await getNsmLifecycle(sessionId);
    expect(
      after.lifecycle,
      `TC-PRG-2: lifecycle should NOT be 'gated' — must stay 'editing' after FE lifecycle injection attempt`
    ).toBe('editing');
  });

  // TC-PRG-3: PATCH /progress with gateResult payload → lifecycle NOT promoted to 'gated'
  // gateResult is a cosmetic UI field written to progress_json for step restoration.
  // nsm-sessions.js:244 — `merged.gateResult = gateResult` writes to progress_json only.
  // computeLifecycle with route='patch' only goes created→editing; cannot set 'gated'.
  // This is the most important test: confirm gateResult is cosmetic, not a state machine input.
  test('TC-PRG-3: PATCH /progress with gateResult payload → lifecycle NOT promoted to gated', async ({ request, cleanupTracker }) => {
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    // Session at lifecycle='editing' (not gated)
    await setNsmLifecycle(sessionId, 'editing');

    const headers = await authHeaders();
    // Simulate what a malicious FE might send: gateResult with ok status
    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${sessionId}/progress`, {
      headers,
      data: {
        gateResult: {
          overallStatus: 'ok',
          canProceed: true,
          dimensions: {},
        },
        currentStep: 3, // attempt to jump to step 3 (post-gate UI state)
      },
    });

    expect(res.status()).toBe(200); // PATCH itself succeeds (cosmetic fields written)

    const after = await getNsmLifecycle(sessionId);
    // Lifecycle must stay 'editing' — gateResult in progress_json is UI-only, not state machine
    expect(
      after.lifecycle,
      `TC-PRG-3: lifecycle should remain 'editing' after gateResult injection. Got: ${after.lifecycle}`
    ).toBe('editing');

    // Confirm gateResult was written to progress_json (cosmetic write succeeded)
    expect(after.progress_json).toHaveProperty('gateResult');
    expect(after.progress_json.gateResult).toMatchObject({ overallStatus: 'ok' });

    // Confirm currentStep was written to progress_json (step UI state restored)
    expect(after.progress_json).toHaveProperty('currentStep', 3);
  });

  // TC-PRG-4: PATCH /progress with currentStep=3 does NOT advance lifecycle past 'editing'
  // After L19 fix: /evaluate checks lifecycle in ['gated','completed'].
  // Even if progress_json has currentStep=3, lifecycle remains 'editing',
  // so /evaluate would still be blocked (403) for this session.
  // This closes the vector identified in L18 as "medium risk."
  test('TC-PRG-4: PATCH /progress currentStep=3 → lifecycle stays editing (not gated)', async ({ request, cleanupTracker }) => {
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    await setNsmLifecycle(sessionId, 'editing');

    const headers = await authHeaders();
    await request.patch(`${BASE_URL}/api/nsm-sessions/${sessionId}/progress`, {
      headers,
      data: { currentStep: 3 },
    });

    const after = await getNsmLifecycle(sessionId);
    expect(
      after.lifecycle,
      `TC-PRG-4: lifecycle advanced beyond 'editing' after currentStep=3 PATCH. Got: ${after.lifecycle}`
    ).toBe('editing'); // must stay 'editing'

    // Verify /evaluate is still blocked (lifecycle != 'gated')
    // This confirms the L19 fix + PATCH /progress combination leaves no open vector
    const evalRes = await request.post(
      `${BASE_URL}/api/nsm-sessions/${sessionId}/evaluate`,
      {
        headers,
        data: {
          userNsm: SUBSTANTIVE_NSM,
          userBreakdown: {
            reach: 'r', depth: 'd', frequency: 'f', impact: 'i',
          },
        },
      }
    );
    expect(
      evalRes.status(),
      `TC-PRG-4 vector check: /evaluate should return 403 after currentStep=3 spoofing (lifecycle still 'editing')`
    ).toBe(403);
  });

  // TC-PRG-5: PATCH /progress on completed session → lifecycle stays 'completed' (monotone)
  // computeLifecycle:96 — if priorLc === 'completed', return 'completed' immediately.
  // Even substantive content patches do not demote lifecycle.
  test('TC-PRG-5: PATCH /progress on completed session → lifecycle stays completed (monotone)', async ({ request, cleanupTracker }) => {
    const sessionId = await createAuthNsmSession(request, cleanupTracker);
    await setNsmLifecycle(sessionId, 'completed');

    const headers = await authHeaders();
    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${sessionId}/progress`, {
      headers,
      data: {
        userNsm: SUBSTANTIVE_NSM,
        currentStep: 1, // attempt to "go back" in UI state
      },
    });

    expect(res.status()).toBe(200);

    const after = await getNsmLifecycle(sessionId);
    expect(
      after.lifecycle,
      `TC-PRG-5: lifecycle should stay 'completed' (monotone); got ${after.lifecycle}`
    ).toBe('completed'); // monotone — must not demote
  });

  // TC-PRG-6: guest PATCH /progress with currentStep=3 → does NOT advance lifecycle to gated
  // guest-nsm-sessions.js:176-237 — mirror of auth variant with same computeLifecycle.
  test('TC-PRG-6: guest PATCH /progress currentStep=3 → lifecycle stays editing (guest)', async ({ request }) => {
    const { sessionId, guestId } = await createGuestNsmSession(request);
    try {
      await setNsmLifecycle(sessionId, 'editing');

      const guestHeaders = { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' };
      const res = await request.patch(`${BASE_URL}/api/guest/nsm-sessions/${sessionId}/progress`, {
        headers: guestHeaders,
        data: { currentStep: 3 },
      });

      expect(res.status()).toBe(200);

      const after = await getNsmLifecycle(sessionId);
      expect(
        after.lifecycle,
        `TC-PRG-6: guest lifecycle advanced beyond 'editing' after currentStep=3 PATCH. Got: ${after.lifecycle}`
      ).toBe('editing');
    } finally {
      await deleteNsmSession(sessionId);
    }
  });

  // TC-PRG-7: PATCH /progress on non-existent session → 404
  // nsm-sessions.js:265 — `if (!data) return res.status(404).json({ error: 'not_found' })`.
  test('TC-PRG-7: PATCH /progress on non-existent session → 404', async ({ request }) => {
    const headers = await authHeaders();
    const fakeId = randomUUID();
    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${fakeId}/progress`, {
      headers,
      data: { currentStep: 1 },
    });

    expect(
      res.status(),
      `TC-PRG-7: /progress on non-existent session returned ${res.status()} — expected 404`
    ).toBe(404);
  });

  // TC-PRG-8: PATCH /progress with empty body → 400 (nothing_to_update guard)
  // nsm-sessions.js:251 — `if (Object.keys(patch).length === 0) return res.status(400)...`
  // Ensures the endpoint rejects vacuous updates that do nothing.
  test('TC-PRG-8: PATCH /progress with empty body → 400 nothing_to_update', async ({ request, cleanupTracker }) => {
    const sessionId = await createAuthNsmSession(request, cleanupTracker);

    const headers = await authHeaders();
    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${sessionId}/progress`, {
      headers,
      data: {}, // empty — nothing to update
    });

    expect(
      res.status(),
      `TC-PRG-8: /progress with empty body returned ${res.status()} — expected 400`
    ).toBe(400);
    const body = await res.json().catch(() => ({}));
    expect(body).toMatchObject({ error: 'nothing_to_update' });
  });

});
