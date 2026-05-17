// tests/api/circles-evaluate-step-contract.spec.js
// Real API contract tests for POST /:id/evaluate-step — F-N-009.
//
// Skills applied:
//   api-testing.md §Error Response Testing (lines 1023-1166) — 401 + 404
//   api-testing.md §Schema Validation Option B manual checks (lines 964-1021)
//   when-to-mock.md Pitfall 11 carve-out — OpenAI is third-party; server-to-OpenAI
//     cannot be intercepted via request.route(). Per lifecycle-circles.spec.js
//     precedent, real OpenAI is used with test.slow() + quality input.
//   when-to-mock.md decision matrix — NEVER mock own API/DB
//
// Closes F-N-009: circles-evaluator.test.js HOLLOW (jest.mock entire OpenAI SDK).
// This spec hits the real Express route + real Supabase test DB.
//
// Cleanup: api-cleanup.fixture.js tracks session ids + DELETE after each test.

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// ── Service-role client — api-testing.md:783-848 "Data seeding via service-role" ──
// Used to seed lifecycle='gated' without calling /gate (which is not under test here).
const adminDb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Real question from circles_database.json (Spotify)
const QUESTION_ID = 'circles_001';
const DRILL_STEP  = 'C1';

// Substantive C1 draft — passes hasSubstantiveContent; same shape as
// lifecycle-circles.spec.js so OpenAI reliably produces a full evaluation.
const SUBSTANTIVE_DRAFT = {
  C1: {
    問題範圍: '我們的目標是提升 Spotify Podcast 功能的週活躍留存率，特別針對 18-35 歲通勤族群',
    影響對象: '目前每週使用 Spotify 至少一次但 Podcast 使用率低的 MAU，約 4000 萬人',
    核心衝突: '用戶知道 Podcast 存在但不清楚如何找到符合通勤時間的節目，發現路徑體驗差',
    目標結果: '週 Podcast 活躍率從 15% 提升至 25%，DAU/MAU 比從 0.3 到 0.45',
  },
};

// ── helpers ────────────────────────────────────────────────────────────────────

/**
 * Set lifecycle='gated' via service-role.
 * L5 fix (P0-#255): /evaluate-step now requires lifecycle='gated' or 'completed'.
 * Seed via service-role to bypass /gate (which is not under test here).
 */
async function setLifecycleGated(sessionId) {
  const { error } = await adminDb
    .from('circles_sessions')
    .update({ lifecycle: 'gated' })
    .eq('id', sessionId);
  if (error) throw new Error(`setLifecycleGated failed: ${error.message}`);
}

async function authHeaders() {
  const token = await getE2eToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create a draft session via POST /draft + promote to gated state so
 * evaluate-step is reachable (session needs drill_step + framework_draft set).
 * Returns the session id.
 */
async function seedEvaluatableSession(request, cleanupTracker) {
  const headers = await authHeaders();

  // 1. Create draft
  const draftRes = await request.post(`${BASE_URL}/api/circles-sessions/draft`, {
    headers,
    data: { question_id: QUESTION_ID, mode: 'drill', drill_step: DRILL_STEP },
  });
  expect(draftRes.status()).toBe(200);
  const session = await draftRes.json();
  expect(session.id).toBeTruthy();
  cleanupTracker.track('circles', session.id);

  // 2. Patch framework_draft so the evaluator has content to score
  const patchRes = await request.patch(
    `${BASE_URL}/api/circles-sessions/${session.id}/progress`,
    { headers, data: { frameworkDraft: SUBSTANTIVE_DRAFT } },
  );
  expect(patchRes.status()).toBe(200);

  // 3. L5 fix (P0-#255): set lifecycle='gated' so the lifecycle guard passes.
  // evaluate-step requires lifecycle in ['gated','completed'] — seed via service-role
  // to bypass /gate (gate is not under test here).
  await setLifecycleGated(session.id);

  return session.id;
}

// ── setup ──────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ── specs ──────────────────────────────────────────────────────────────────────

test.describe('POST /api/circles-sessions/:id/evaluate-step — contract (F-N-009)', () => {

  // Test 1 — 401 without auth
  // api-testing.md line 1053-1062: "401 — missing authentication"
  test('401 without auth token', async ({ request }) => {
    // Use a plausible UUID — auth check fires before DB lookup
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await request.post(
      `${BASE_URL}/api/circles-sessions/${fakeId}/evaluate-step`,
      {
        headers: { 'Content-Type': 'application/json' },
        // No Authorization header — requireAuth must reject
      },
    );
    // Per middleware/auth.js line 5: returns 401 { error: 'unauthorized' }
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized|invalid_token/i);
  });

  // Test 2 — 404 for non-existent session
  // The evaluate-step route has no req.body validation (it reads everything
  // from the DB session row). The first guard after auth is the DB lookup:
  //   if (error || !session) return res.status(404).json({ error: 'not_found' })
  // routes/circles-sessions.js line 260.
  // Testing with a non-existent session id is the correct "missing resource"
  // guard for this route (there is no 400 path on this endpoint).
  test('404 for non-existent session id', async ({ request }) => {
    const headers = await authHeaders();
    const nonExistentId = '00000000-0000-0000-0000-000000000002';
    const res = await request.post(
      `${BASE_URL}/api/circles-sessions/${nonExistentId}/evaluate-step`,
      { headers },
    );
    // Per routes/circles-sessions.js line 260: 404 { error: 'not_found' }
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not_found/i);
  });

  // Test 3 — 200 + response shape (real OpenAI)
  // when-to-mock.md Pitfall 11 carve-out: OpenAI is a third-party paid service.
  // Server-to-OpenAI calls cannot be intercepted via request.route() (that only
  // works for browser→server traffic). Per lifecycle-circles.spec.js precedent,
  // we use real OpenAI with test.slow() and a substantive input that reliably
  // returns a full evaluation.
  //
  // Shape contract per prompts/circles-evaluator.js lines 89-106:
  //   dimensions: Array<{ name: string, score: 1-5, comment: string }>
  //   totalScore: number
  //   highlight: string
  //   improvement: string
  //   coachVersion: {
  //     context: string,
  //     perField: Array<{ field: string, demo: string }>,
  //     reasoning: string,
  //   }
  test('200 + evaluator response shape (real OpenAI)', async ({ request, cleanupTracker }) => {
    test.slow(); // real OpenAI call — allow extra time

    const sessionId = await seedEvaluatableSession(request, cleanupTracker);
    const headers = await authHeaders();

    const res = await request.post(
      `${BASE_URL}/api/circles-sessions/${sessionId}/evaluate-step`,
      { headers },
    );

    // Route-level: 200 on success (evaluate-step-handler.js line 100 → res.json(result))
    expect(res.status()).toBe(200);

    const body = await res.json();

    // ── dimensions array ──
    expect(Array.isArray(body.dimensions)).toBe(true);
    expect(body.dimensions.length).toBeGreaterThan(0);
    for (const dim of body.dimensions) {
      expect(typeof dim.name).toBe('string');
      expect(typeof dim.score).toBe('number');
      expect(dim.score).toBeGreaterThanOrEqual(1);
      expect(dim.score).toBeLessThanOrEqual(5);
      expect(typeof dim.comment).toBe('string');
    }

    // ── totalScore ──
    expect(typeof body.totalScore).toBe('number');
    expect(body.totalScore).toBeGreaterThanOrEqual(0);

    // ── highlight + improvement ──
    expect(typeof body.highlight).toBe('string');
    expect(body.highlight.length).toBeGreaterThan(0);
    expect(typeof body.improvement).toBe('string');
    expect(body.improvement.length).toBeGreaterThan(0);

    // ── coachVersion (structured object — M3 guard in evaluate-step-handler.js line 46-54) ──
    expect(body.coachVersion).toBeDefined();
    expect(typeof body.coachVersion).toBe('object');
    expect(Array.isArray(body.coachVersion)).toBe(false);

    expect(typeof body.coachVersion.context).toBe('string');
    expect(body.coachVersion.context.length).toBeGreaterThan(0);

    expect(Array.isArray(body.coachVersion.perField)).toBe(true);
    expect(body.coachVersion.perField.length).toBeGreaterThan(0);
    for (const pf of body.coachVersion.perField) {
      expect(typeof pf.field).toBe('string');
      expect(typeof pf.demo).toBe('string');
    }

    expect(typeof body.coachVersion.reasoning).toBe('string');
    expect(body.coachVersion.reasoning.length).toBeGreaterThan(0);

    // ── step_scores persisted to DB (round-trip verification) ──
    // evaluate-step-handler.js line 85: updatedScores persisted; current_phase set to 3.
    const getRes = await request.get(
      `${BASE_URL}/api/circles-sessions/${sessionId}`,
      { headers },
    );
    expect(getRes.status()).toBe(200);
    const updated = await getRes.json();
    expect(updated.step_scores).toBeDefined();
    expect(updated.step_scores[DRILL_STEP]).toBeDefined();
    // DB-persisted score must match what the route returned
    expect(updated.step_scores[DRILL_STEP].totalScore).toBe(body.totalScore);
  });

});
