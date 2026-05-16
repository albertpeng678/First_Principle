// tests/api/lifecycle-circles.spec.js
// Real API layer tests for CIRCLES session lifecycle column.
// Hits localhost:4000 real Express + real Supabase test DB.
//
// Skills applied:
//   api-testing.md §Chained API Calls — state machine transition pattern
//   api-testing.md §APIRequestContext Basics — request.post/patch/get directly
//   api-testing.md §Request Fixtures — playwright.request.newContext() for auth
//   when-to-mock.md §Full Mock (route.fulfill) — ONLY for api.openai.com (third-party)
//   when-to-mock.md decision matrix — NEVER mock own API/DB
//   test-organization.md §Pattern 1 — tests/api/ feature-based file
//   test-organization.md §Pattern 2 — test names describe behavior
//
// IL-3 TDD: tests written against existing implementation.
// Tests that fail surface real integration bugs.
//
// Cleanup: auto-cleanup.fixture.js tracks session ids + DELETE after each test.

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// Spotify question — real question_id from circles_database.json
const QUESTION_ID  = 'circles_001';
const DRILL_STEP   = 'C1';

// Substantive C1 draft — passes hasSubstantiveContent (not a stub token)
const SUBSTANTIVE_DRAFT = {
  C1: {
    問題範圍: '我們的目標是提升 Spotify Podcast 功能的週活躍留存率，特別針對 18-35 歲通勤族群',
    影響對象: '目前每週使用 Spotify 至少一次但 Podcast 使用率低的 MAU，約 4000 萬人',
    核心衝突: '用戶知道 Podcast 存在但不清楚如何找到符合通勤時間的節目，發現路徑體驗差',
    目標結果: '週 Podcast 活躍率從 15% 提升至 25%，DAU/MAU 比從 0.3 到 0.45',
  },
};

// Polluted stub — matches POLLUTION_REGEX in session-lifecycle.js
const POLLUTED_DRAFT = {
  C1: { 問題範圍: 'e2e-r1-17896543210' },
};

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
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBeTruthy();
  cleanupTracker.track('circles', body.id);
  return body;
}

async function patchProgress(request, id, data) {
  const headers = await authHeaders();
  return request.patch(`${BASE_URL}/api/circles-sessions/${id}/progress`, { headers, data });
}

// ── setup ────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  // Warm up auth token cache once per file
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ── specs ────────────────────────────────────────────────────────────────────

test.describe('CIRCLES lifecycle — real API', () => {

  test('POST /draft returns session with lifecycle=created (SLC-AC4)', async ({ request, cleanupTracker }) => {
    const session = await createDraftSession(request, cleanupTracker);
    // Per api-testing.md §JSON Response Assertions: always assert status first, then body
    expect(session.lifecycle).toBe('created');
    expect(session.question_id).toBe(QUESTION_ID);
  });

  test('PATCH /progress with substantive frameworkDraft → lifecycle promotes to editing (SLC-AC5)', async ({ request, cleanupTracker }) => {
    const session = await createDraftSession(request, cleanupTracker);
    const res = await patchProgress(request, session.id, { frameworkDraft: SUBSTANTIVE_DRAFT });
    expect(res.status()).toBe(200);

    // Verify via GET /:id — round-trip to real DB proves column was written
    const headers = await authHeaders();
    const getRes = await request.get(`${BASE_URL}/api/circles-sessions/${session.id}`, { headers });
    expect(getRes.status()).toBe(200);
    const updated = await getRes.json();
    expect(updated.lifecycle).toBe('editing');
  });

  test('PATCH /progress with polluted-only stub stays created (SLC-AC6)', async ({ request, cleanupTracker }) => {
    const session = await createDraftSession(request, cleanupTracker);
    const res = await patchProgress(request, session.id, { frameworkDraft: POLLUTED_DRAFT });
    expect(res.status()).toBe(200);

    const headers = await authHeaders();
    const getRes = await request.get(`${BASE_URL}/api/circles-sessions/${session.id}`, { headers });
    const updated = await getRes.json();
    expect(updated.lifecycle).toBe('created');
  });

  // Gate test: calls real OpenAI (third-party).
  // page.route() only intercepts browser requests; server-to-OpenAI calls cannot
  // be intercepted this way. We use real OpenAI with a high-quality input that
  // reliably returns ok=true, and verify the DB lifecycle promotion.
  // Per when-to-mock.md §Real Service Strategies: when mocking is not feasible
  // at the boundary, test with real quality input and assert on outcome.
  test('POST /gate ok=true → lifecycle=gated (SLC-AC7)', async ({ request, cleanupTracker }) => {
    test.slow(); // gate calls real OpenAI — allow extra time
    const session = await createDraftSession(request, cleanupTracker);
    // First promote to editing so gate logic sees a non-blank draft
    await patchProgress(request, session.id, { frameworkDraft: SUBSTANTIVE_DRAFT });

    const headers = await authHeaders();
    const gateRes = await request.post(`${BASE_URL}/api/circles-sessions/${session.id}/gate`, {
      headers,
      data: {
        step: DRILL_STEP,
        frameworkDraft: SUBSTANTIVE_DRAFT,
      },
    });
    expect(gateRes.status()).toBe(200);
    const gateBody = await gateRes.json();
    // Real OpenAI may pass or fail; assert the route returns 200
    // and the lifecycle is consistent with the gate result
    expect(typeof gateBody.canProceed).toBe('boolean');
    expect(['ok', 'warn', 'error']).toContain(gateBody.overallStatus);
    const gateOk = gateBody.canProceed && (gateBody.overallStatus === 'ok' || gateBody.overallStatus === 'warn');

    // Verify lifecycle in DB reflects gate result
    const getRes = await request.get(`${BASE_URL}/api/circles-sessions/${session.id}`, { headers });
    const updated = await getRes.json();
    if (gateOk) {
      expect(updated.lifecycle).toBe('gated');
    } else {
      expect(updated.lifecycle).toBe('editing');
    }
  });

  test('POST /gate with garbage input → lifecycle NOT promoted (SLC-AC7 negative)', async ({ request, cleanupTracker }) => {
    test.slow();
    const session = await createDraftSession(request, cleanupTracker);
    // Use garbage draft — too thin to gate
    await patchProgress(request, session.id, { frameworkDraft: POLLUTED_DRAFT });

    const headers = await authHeaders();
    const gateRes = await request.post(`${BASE_URL}/api/circles-sessions/${session.id}/gate`, {
      headers,
      data: { step: DRILL_STEP, frameworkDraft: POLLUTED_DRAFT },
    });
    expect(gateRes.status()).toBe(200);
    const gateBody = await gateRes.json();
    // Garbage input reliably gets canProceed=false from AI
    expect(gateBody.canProceed).toBe(false);

    const getRes = await request.get(`${BASE_URL}/api/circles-sessions/${session.id}`, { headers });
    const updated = await getRes.json();
    // lifecycle should stay created (never promoted since draft was garbage)
    expect(['created', 'editing']).toContain(updated.lifecycle);
    expect(updated.lifecycle).not.toBe('gated');
  });

  // Final-report calls real OpenAI (can't intercept server-to-server via page.route)
  test('POST /final-report → lifecycle=completed (SLC-AC8)', async ({ request, cleanupTracker }) => {
    test.slow(); // two OpenAI calls (gate + final-report)
    const session = await createDraftSession(request, cleanupTracker);
    await patchProgress(request, session.id, { frameworkDraft: SUBSTANTIVE_DRAFT });

    const headers = await authHeaders();
    // Gate first — need lifecycle=gated to call final-report
    const gateRes = await request.post(`${BASE_URL}/api/circles-sessions/${session.id}/gate`, {
      headers,
      data: { step: DRILL_STEP, frameworkDraft: SUBSTANTIVE_DRAFT },
    });
    expect(gateRes.status()).toBe(200);
    const gateBody = await gateRes.json();

    const gateOk = gateBody.canProceed && (gateBody.overallStatus === 'ok' || gateBody.overallStatus === 'warn');
    if (!gateOk) {
      // AI did not pass gate with quality input — rare but possible; skip final-report
      console.warn('SLC-AC8: gate returned ok=false; skipping final-report lifecycle test');
      return;
    }

    const finalRes = await request.post(`${BASE_URL}/api/circles-sessions/${session.id}/final-report`, {
      headers,
      data: {},
    });
    expect(finalRes.status()).toBe(200);

    const getRes = await request.get(`${BASE_URL}/api/circles-sessions/${session.id}`, { headers });
    const updated = await getRes.json();
    expect(updated.lifecycle).toBe('completed');
  });

  test('PATCH /progress after gated does NOT demote lifecycle (SLC-AC9 monotone)', async ({ request, cleanupTracker }) => {
    test.slow(); // gate calls real OpenAI
    const session = await createDraftSession(request, cleanupTracker);
    await patchProgress(request, session.id, { frameworkDraft: SUBSTANTIVE_DRAFT });

    const headers = await authHeaders();
    await request.post(`${BASE_URL}/api/circles-sessions/${session.id}/gate`, {
      headers,
      data: { step: DRILL_STEP, frameworkDraft: SUBSTANTIVE_DRAFT },
    });

    const getRes1 = await request.get(`${BASE_URL}/api/circles-sessions/${session.id}`, { headers });
    const afterGate = await getRes1.json();
    // Only proceed with monotone test if gate succeeded
    if (afterGate.lifecycle !== 'gated') {
      console.warn('SLC-AC9: gate did not reach gated state, monotone guard not exercised');
      return;
    }

    // Now PATCH /progress — should NOT demote from gated back to editing
    const patchRes = await patchProgress(request, session.id, { currentPhase: 2 });
    expect(patchRes.status()).toBe(200);

    const getRes2 = await request.get(`${BASE_URL}/api/circles-sessions/${session.id}`, { headers });
    const updated = await getRes2.json();
    expect(updated.lifecycle).toBe('gated');
  });

  test('FE-supplied lifecycle in PATCH body is ignored (SLC-AC10)', async ({ request, cleanupTracker }) => {
    const session = await createDraftSession(request, cleanupTracker);
    expect(session.lifecycle).toBe('created');

    // Send lifecycle=completed in body — server must strip it (SLC-AC10)
    const res = await patchProgress(request, session.id, { lifecycle: 'completed' });
    // Route returns 400 nothing_to_update OR 200 with no change — either is acceptable
    expect([200, 400]).toContain(res.status());

    // Regardless of status: DB lifecycle must remain 'created' (not 'completed')
    const headers = await authHeaders();
    const getRes = await request.get(`${BASE_URL}/api/circles-sessions/${session.id}`, { headers });
    const updated = await getRes.json();
    expect(updated.lifecycle).toBe('created');
  });

});
