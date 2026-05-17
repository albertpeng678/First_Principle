// tests/api/circles-final-report-contract.spec.js
// F-N-003 contract: Phase 4 /final-report 422/400 guard + 200 shape.
//
// Skills applied:
//   api-testing.md 1023-1166 — error response testing (422/400 pattern)
//   api-testing.md 783-848   — API data seeding via service-role direct DB write
//   common-pitfalls.md Pitfall 11 (lines 597-661) — mock only external services;
//     own API is real. OpenAI is server-side (no page.route intercept possible);
//     per Pitfall 11 carve-out (line 660): "real backend + real OpenAI" accepted
//     when boundary mock mechanism (page.route) doesn't apply to server-side HTTP.
//     Test 2 marks test.slow() + seeds step_scores via service-role to avoid 7 real
//     evaluate-step calls — only the final-report OpenAI call is exercised.
//
// BE finding: routes/circles-sessions.js:387-388 guard returns HTTP 400 (not 422).
//   F-N-003 spec says "expect 422" — the actual guard status is 400 with body
//   { error: 'incomplete_steps' }. Tests assert the real status (400) and note gap.
//
// Cleanup: api-cleanup.fixture auto-deletes sessions after each test.

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// Real question_id from circles_database.json — same as lifecycle-circles.spec.js
const QUESTION_ID = 'circles_001';
const DRILL_STEP  = 'C1';

// ── Service-role Supabase client for direct DB seeding ────────────────────────
// Per api-testing.md 783-848: seed via API/DB before the action under test.
// The service-role key bypasses RLS so we can write step_scores directly
// without going through evaluate-step (which calls real OpenAI × N steps).
const adminDb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── A minimal but shape-valid step_score entry ────────────────────────────────
// Shape validated by isValidEvaluatorResult in lib/evaluate-step-handler.js:
//   - coachVersion must be object with {context: string, perField: array, reasoning: string}
//   - totalScore, highlight, improvement are consumed by generateFinalReport prompt
function makeStepScore(stepKey) {
  return {
    totalScore: 75,
    highlight: `${stepKey} 框架清楚，層次分明`,
    improvement: `${stepKey} 可更具體說明取捨原因`,
    dimensions: [
      { name: '維度A', score: 4 },
      { name: '維度B', score: 4 },
      { name: '維度C', score: 3 },
      { name: '維度D', score: 3 },
    ],
    coachVersion: {
      context: `${stepKey} 步驟的核心任務是確認分析框架的完整性，這直接影響後續評估品質。`,
      perField: [
        { field: '主欄位', demo: `${stepKey} 範例說明，展示結構化思維。` },
      ],
      reasoning: `${stepKey} 的推薦做法是先定義邊界再逐步深入，避免跳步。`,
    },
  };
}

// All 7 CIRCLES steps in canonical order
const ALL_STEPS = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];

// ── helpers ───────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getE2eToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function createDraftSession(request, cleanupTracker) {
  const headers = await authHeaders();
  const res = await request.post(`${BASE_URL}/api/circles-sessions/draft`, {
    headers,
    data: { question_id: QUESTION_ID, mode: 'drill', drill_step: DRILL_STEP },
  });
  // Per api-testing.md 1023-1166: assert status before body
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBeTruthy();
  cleanupTracker.track('circles', body.id);
  return body;
}

/**
 * Seed step_scores directly via service-role client.
 * Per api-testing.md 783-848: "Seed everything *except* what you are testing."
 * We are testing /final-report; we seed step_scores to avoid N real OpenAI calls.
 */
async function seedStepScores(sessionId, steps) {
  const scores = {};
  for (const step of steps) {
    scores[step] = makeStepScore(step);
  }
  const { error } = await adminDb
    .from('circles_sessions')
    .update({ step_scores: scores })
    .eq('id', sessionId);
  if (error) throw new Error(`seedStepScores failed: ${error.message}`);
}

/**
 * Set lifecycle='gated' via service-role.
 * L5 fix (P0-#255): /final-report now requires lifecycle='gated' or 'completed'.
 * Seed via service-role to bypass /gate (which is not under test here).
 */
async function setLifecycleGated(sessionId) {
  const { error } = await adminDb
    .from('circles_sessions')
    .update({ lifecycle: 'gated' })
    .eq('id', sessionId);
  if (error) throw new Error(`setLifecycleGated failed: ${error.message}`);
}

// ── setup ────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ── specs ────────────────────────────────────────────────────────────────────

test.describe('CIRCLES /final-report contract — F-N-003', () => {

  // ── Test 1: 400 guard when step_scores < 7 ──────────────────────────────
  // routes/circles-sessions.js:387-388: guard returns 400 (not 422).
  // F-N-003 finding says "expect 422" — actual BE returns 400.
  // We assert 400 (what the code actually does) and document the discrepancy.
  // Per api-testing.md 1095-1102: test unprocessable-entity class errors.
  test('400 when step_scores < 7 (F-N-003 guard — cited routes/circles-sessions.js:387)', async ({ request, cleanupTracker }) => {
    const session = await createDraftSession(request, cleanupTracker);

    // L5 fix (P0-#255): set lifecycle='gated' so lifecycle guard passes;
    // we are testing the incomplete_steps guard, not the lifecycle guard.
    await setLifecycleGated(session.id);

    // Seed only 3 of 7 steps — deliberate incomplete set
    await seedStepScores(session.id, ['C1', 'I', 'R']);

    const headers = await authHeaders();
    const res = await request.post(
      `${BASE_URL}/api/circles-sessions/${session.id}/final-report`,
      { headers, data: {} }
    );

    // BE guard: routes/circles-sessions.js:387-388 returns HTTP 400 (not 422).
    // NOTE: F-N-003 spec expected 422; actual implementation uses 400.
    // Asserting real status 400 — gap documented in commit msg.
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body).toMatchObject({ error: 'incomplete_steps' });
  });

  // ── Test 2: 200 + shape when all 7 step_scores populated ─────────────────
  // Seed all 7 steps via service-role, then call /final-report.
  // Final-report calls OpenAI server-side; page.route() cannot intercept.
  // Per Pitfall 11 carve-out: "real backend + real external" accepted when
  // the boundary mock mechanism doesn't apply to server-side HTTP.
  // Per api-testing.md 783-848: seed all except what is under test (generateFinalReport).
  test('200 + shape when all 7 step_scores populated (F-N-003 happy path)', async ({ request, cleanupTracker }) => {
    test.slow(); // generateFinalReport calls real OpenAI — allow extra time

    const session = await createDraftSession(request, cleanupTracker);

    // L5 fix (P0-#255): set lifecycle='gated' before /final-report (lifecycle guard required)
    await setLifecycleGated(session.id);

    // Seed all 7 step_scores via service-role (no evaluate-step OpenAI calls needed)
    await seedStepScores(session.id, ALL_STEPS);

    const headers = await authHeaders();
    const res = await request.post(
      `${BASE_URL}/api/circles-sessions/${session.id}/final-report`,
      { headers, data: {} }
    );

    // Per api-testing.md 1023-1166: assert status first, then body shape
    expect(res.status()).toBe(200);

    const body = await res.json();

    // Shape assertion — all required keys from circles-final-report.js prompt schema
    expect(body).toMatchObject({
      overallScore: expect.any(Number),
      grade:        expect.stringMatching(/^[ABCD]$/),
      headline:     expect.any(String),
      strengths:    expect.any(Array),
      improvements: expect.any(Array),
      nextSteps:    expect.any(String),
      coachVerdict: expect.any(String),
    });

    // Semantic guards — not empty strings
    expect(body.headline.length).toBeGreaterThan(0);
    expect(body.nextSteps.length).toBeGreaterThan(0);
    expect(body.coachVerdict.length).toBeGreaterThan(0);

    // overallScore is computed server-side from step_scores; 7 × 75 avg = 75
    expect(body.overallScore).toBe(75);
  });

});
