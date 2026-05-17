// tests/api/circles-no-bypass.spec.js
// Phase 1 Lane L3 — TDD-red spec: gate bypass attempt on every leaky BE path.
// Any 2xx where >= 400 is expected = leak confirmed (bug evidence, not a test failure
// in the traditional sense — the spec is intentionally RED to surface P0-#255).
//
// Skills applied (mandatory cite):
//   api-testing.md:783-848  "Data seeding via service-role" — seed lifecycle='editing'
//     precondition without going through the gate; also seeds step_scores for T-BYPASS-4.
//   api-testing.md:1023-1166 "Error response testing" — assert 4xx guard; 2xx = bug.
//   crud-testing.md "Standard CRUD" — bypass attempt = invalid state transition.
//
// IL-3 TDD: tests written BEFORE production guard is added. All four paths are
// expected to return >= 400 (not yet implemented). Current behaviour is 200 → RED.
//
// Cleanup: api-cleanup.fixture.js auto-deletes sessions after each test.
//
// E2E real-data discipline:
//   - No stub timestamps
//   - No mock of own API/DB
//   - No prod URL + real account (uses e2e@first-principle.test on localhost:4000)

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// ── Service-role client — api-testing.md:783-848 "Data seeding via service-role" ──
// Used to: (a) set lifecycle='editing' without calling /gate, and
//          (b) seed step_scores without calling /evaluate-step.
// This tests that the BE itself enforces the guard — not just the FE flow.
const adminDb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const QUESTION_ID = 'circles_001';
const DRILL_STEP  = 'C1';

// Minimal valid step_score shape (matches isValidEvaluatorResult guard in evaluate-step-handler.js)
function makeStepScore(stepKey) {
  return {
    totalScore: 70,
    highlight: `${stepKey} highlight`,
    improvement: `${stepKey} improvement`,
    dimensions: [
      { name: 'A', score: 3 }, { name: 'B', score: 4 },
      { name: 'C', score: 3 }, { name: 'D', score: 3 },
    ],
    coachVersion: {
      context: `${stepKey} context`,
      perField: [{ field: 'field1', demo: `${stepKey} demo` }],
      reasoning: `${stepKey} reasoning`,
    },
  };
}

const ALL_STEPS = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];

// ── helpers ───────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getE2eToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create draft session (lifecycle='created' initially).
 * Per api-testing.md:783-848: seed everything except what is under test.
 */
async function createDraftSession(request, cleanupTracker) {
  const headers = await authHeaders();
  const res = await request.post(`${BASE_URL}/api/circles-sessions/draft`, {
    headers,
    data: { question_id: QUESTION_ID, mode: 'drill', drill_step: DRILL_STEP },
  });
  // Per api-testing.md:1023-1166: assert status before body
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBeTruthy();
  cleanupTracker.track('circles', body.id);
  return body;
}

/**
 * Set session lifecycle='editing' via service-role.
 * api-testing.md:783-848: "Seed via service-role to bypass the action under test."
 * We set lifecycle='editing' (gate started but NOT completed/passed) to simulate
 * a user who began the framework but never called /gate successfully.
 */
async function setLifecycleEditing(sessionId) {
  const { error } = await adminDb
    .from('circles_sessions')
    .update({ lifecycle: 'editing' })
    .eq('id', sessionId);
  if (error) throw new Error(`setLifecycleEditing failed: ${error.message}`);
}

/**
 * Seed all 7 step_scores via service-role (for T-BYPASS-4).
 * Simulates a hypothetical state where step_scores exist but gate was never passed.
 */
async function seedAllStepScores(sessionId) {
  const scores = {};
  for (const step of ALL_STEPS) scores[step] = makeStepScore(step);
  const { error } = await adminDb
    .from('circles_sessions')
    .update({ step_scores: scores })
    .eq('id', sessionId);
  if (error) throw new Error(`seedAllStepScores failed: ${error.message}`);
}

// ── setup ────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ── specs ────────────────────────────────────────────────────────────────────

test.describe('CIRCLES gate bypass attempts — must be rejected', () => {

  // ── T-BYPASS-1: POST /evaluate-step without prior gate pass ───────────────
  //
  // Source: audit/bug6-bypass-path-enumeration-2026-05-17.md §3 LEAK-1
  // Guard expected: route should check lifecycle === 'gated' before evaluating.
  // Current code (circles-sessions.js:253-282): no lifecycle check — MISSING GUARD.
  //
  // api-testing.md:1023-1166: assert 4xx; 2xx = bug evidence.
  // TDD-red: this test FAILS (returns 200 or 500) until the guard is added.
  test('T-BYPASS-1: POST /evaluate-step on editing session → must be 403 (LEAK-1)', async ({ request, cleanupTracker }) => {
    // Seed: draft session → set lifecycle='editing' (no gate pass)
    const session = await createDraftSession(request, cleanupTracker);
    await setLifecycleEditing(session.id);

    // Verify precondition via GET
    const headers = await authHeaders();
    const getRes = await request.get(`${BASE_URL}/api/circles-sessions/${session.id}`, { headers });
    const loaded = await getRes.json();
    expect(loaded.lifecycle).toBe('editing'); // confirm precondition

    // Bypass attempt: POST /evaluate-step without gate
    // api-testing.md:1023-1166 pattern: assert status first
    const evalRes = await request.post(
      `${BASE_URL}/api/circles-sessions/${session.id}/evaluate-step`,
      { headers, data: {} }
    );

    const status = evalRes.status();
    const body = await evalRes.json().catch(() => ({}));

    // Guard should reject with 403 gate_required.
    if (status === 200) {
      // BUG CONFIRMED: evaluate-step accepted without gate pass
      console.error('[T-BYPASS-1] BUG: evaluate-step returned 200 with lifecycle=editing (no gate). body:', JSON.stringify(body).slice(0, 200));
    }
    expect(
      status,
      `T-BYPASS-1 LEAK: /evaluate-step returned ${status} without prior gate pass. Expected 403. Body: ${JSON.stringify(body)}`
    ).toBe(403);
    expect(body).toMatchObject({ error: 'gate_required' });
  });

  // ── T-BYPASS-2: POST /message without prior gate pass ────────────────────
  //
  // Source: audit/bug6-bypass-path-enumeration-2026-05-17.md §3 LEAK-2
  // Guard expected: route should check lifecycle === 'gated' before streaming.
  // Current code (circles-sessions.js:202-250): no lifecycle check — MISSING GUARD.
  //
  // NOTE: /message is SSE (text/event-stream). We send a POST and check the
  // initial HTTP response status code — if the guard is absent the server returns
  // 200 with text/event-stream header before streaming anything.
  // Per api-testing.md:1023-1166: a guard must reject at the HTTP status level.
  test('T-BYPASS-2: POST /message on editing session → must be 403 (LEAK-2)', async ({ request, cleanupTracker }) => {
    const session = await createDraftSession(request, cleanupTracker);
    await setLifecycleEditing(session.id);

    const headers = await authHeaders();

    // Bypass attempt: POST /message without gate
    const msgRes = await request.post(
      `${BASE_URL}/api/circles-sessions/${session.id}/message`,
      {
        headers,
        data: { userMessage: '這是測試訊息，請回應' },
      }
    );

    const status = msgRes.status();

    if (status === 200) {
      console.error('[T-BYPASS-2] BUG: /message returned 200 with lifecycle=editing (no gate).');
    }

    expect(
      status,
      `T-BYPASS-2 LEAK: /message returned ${status} without prior gate pass. Expected 403.`
    ).toBe(403);
    const body2 = await msgRes.json().catch(() => ({}));
    expect(body2).toMatchObject({ error: 'gate_required' });
  });

  // ── T-BYPASS-3: PATCH /progress with currentPhase=2 without gate pass ────
  //
  // Source: audit/bug6-bypass-path-enumeration-2026-05-17.md §3 LEAK-3
  // Guard expected: PATCH /progress should reject currentPhase > 1 if lifecycle != 'gated'.
  // Current code (circles-sessions.js:312): `if (currentPhase !== undefined) patch.current_phase = currentPhase`
  // — no lifecycle prerequisite check.
  //
  // This is a data integrity bypass: even if BE correctly gates /message and /evaluate-step,
  // PATCH /progress can write current_phase=2/3 which the FE reads on reload
  // to show the wrong phase UI, bypassing the visible gate.
  test('T-BYPASS-3: PATCH /progress currentPhase=2 on editing session → must be 403 (LEAK-3)', async ({ request, cleanupTracker }) => {
    const session = await createDraftSession(request, cleanupTracker);
    await setLifecycleEditing(session.id);

    const headers = await authHeaders();

    // Bypass attempt: set currentPhase=2 directly via PATCH /progress
    const patchRes = await request.patch(
      `${BASE_URL}/api/circles-sessions/${session.id}/progress`,
      {
        headers,
        data: { currentPhase: 2 },
      }
    );

    const status = patchRes.status();
    const body = await patchRes.json().catch(() => ({}));

    if (status === 200) {
      // Also verify the DB was actually written — confirm the bypass is real
      const getRes = await request.get(`${BASE_URL}/api/circles-sessions/${session.id}`, { headers });
      const loaded = await getRes.json();
      if (loaded.current_phase === 2) {
        console.error('[T-BYPASS-3] BUG: current_phase=2 written to DB with lifecycle=editing (no gate).');
      }
    }

    expect(
      status,
      `T-BYPASS-3 LEAK: PATCH /progress accepted currentPhase=2 with lifecycle=editing. Expected 403. Body: ${JSON.stringify(body)}`
    ).toBe(403);
    expect(body).toMatchObject({ error: 'gate_required_for_phase_advance' });
  });

  // ── T-BYPASS-4: POST /final-report with seeded step_scores, no gate pass ──
  //
  // Source: audit/bug6-bypass-path-enumeration-2026-05-17.md §3 LEAK-4
  // Guard expected: /final-report should check lifecycle === 'gated' or 'completed'
  //   in addition to step_scores count >= 7.
  // Current code (circles-sessions.js:397-399): only checks step_scores count.
  //
  // Scenario: attacker seeds step_scores via LEAK-1 or service-role, then calls
  // /final-report without ever passing /gate.
  test('T-BYPASS-4: POST /final-report with seeded scores, editing lifecycle → must be 403 (LEAK-4)', async ({ request, cleanupTracker }) => {
    // Seed: draft session + editing lifecycle + all 7 step_scores (no gate)
    const session = await createDraftSession(request, cleanupTracker);
    await setLifecycleEditing(session.id);
    await seedAllStepScores(session.id);

    const headers = await authHeaders();

    // Verify precondition: step_scores exist, lifecycle=editing
    const getRes = await request.get(`${BASE_URL}/api/circles-sessions/${session.id}`, { headers });
    const loaded = await getRes.json();
    expect(loaded.lifecycle).toBe('editing');
    expect(loaded.step_scores).toBeTruthy();
    expect(Object.keys(loaded.step_scores).length).toBe(7);

    // Bypass attempt: POST /final-report without gate pass
    const finalRes = await request.post(
      `${BASE_URL}/api/circles-sessions/${session.id}/final-report`,
      { headers, data: {} }
    );

    const status = finalRes.status();

    if (status === 200) {
      console.error('[T-BYPASS-4] BUG: /final-report returned 200 with lifecycle=editing (no gate). step_scores were seeded but gate never passed.');
    }

    const body4 = await finalRes.json().catch(() => ({}));
    expect(
      status,
      `T-BYPASS-4 LEAK: /final-report returned ${status} without prior gate pass. Expected 403. Body: ${JSON.stringify(body4)}`
    ).toBe(403);
    expect(body4).toMatchObject({ error: 'gate_required' });
  });

  // ── T-BYPASS-5 (control): POST /final-report without step_scores + editing lifecycle → 403 ──
  //
  // L5 fix (P0-#255): lifecycle guard fires BEFORE incomplete_steps guard.
  // With lifecycle='editing' and no step_scores, the 403 gate_required fires first.
  // The incomplete_steps guard remains intact for sessions with lifecycle='gated'/'completed'
  // but fewer than 7 step_scores — that path is protected by the prior gate requirement.
  // Per crud-testing.md "Standard CRUD": always include a passing control alongside
  // the bypass attempt tests to confirm the fixture setup is correct.
  test('T-BYPASS-5 (control): lifecycle gate fires before incomplete_steps → 403', async ({ request, cleanupTracker }) => {
    const session = await createDraftSession(request, cleanupTracker);
    await setLifecycleEditing(session.id);
    // No step_scores seeded — lifecycle guard fires first (before incomplete_steps)

    const headers = await authHeaders();
    const finalRes = await request.post(
      `${BASE_URL}/api/circles-sessions/${session.id}/final-report`,
      { headers, data: {} }
    );

    // L5: lifecycle guard fires first → 403 gate_required (lifecycle='editing')
    expect(finalRes.status()).toBe(403);
    const body = await finalRes.json();
    expect(body).toMatchObject({ error: 'gate_required' });
  });

});
