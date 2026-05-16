// tests/api/circles-sessions-list-contract.spec.js
// Real API contract tests for GET /api/circles-sessions — F-N-005.
// Hits localhost:4000 real Express + real Supabase test DB.
//
// Skills applied:
//   api-testing.md 903-1021 (schema validation — Option B manual type checks, no Zod dep)
//   api-testing.md 434-565 (JSON response assertions — status first, toMatchObject, type checks)
//   api-testing.md §APIRequestContext Basics — request.post/patch/get directly
//   api-testing.md §API Data Seeding — create + track + delete after each test
//   when-to-mock.md decision matrix — NEVER mock own API/DB; auth = real
//   test-organization.md §Pattern 1 — tests/api/ feature-based file
//
// Iron Law IL-3 TDD: tests written against existing implementation.
// Cleanup: auto-cleanup.fixture.js tracks session ids + DELETE after each test.

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// Real question_ids from circles_database.json
const QUESTION_ID_1 = 'circles_001'; // Spotify — same as lifecycle-circles.spec.js
const QUESTION_ID_2 = 'circles_002'; // Second question for dedup-safe multi-seed tests
const DRILL_STEP    = 'C1';

// Substantive C1 draft — passes hasSubstantiveContent; promotes lifecycle created → editing
// so the session appears in the default GET /api/circles-sessions list (lifecycle != 'created' filter)
const SUBSTANTIVE_DRAFT = {
  C1: {
    問題範圍: '我們的目標是提升 Spotify Podcast 功能的週活躍留存率，特別針對 18-35 歲通勤族群',
    影響對象: '目前每週使用 Spotify 至少一次但 Podcast 使用率低的 MAU，約 4000 萬人',
    核心衝突: '用戶知道 Podcast 存在但不清楚如何找到符合通勤時間的節目，發現路徑體驗差',
    目標結果: '週 Podcast 活躍率從 15% 提升至 25%，DAU/MAU 比從 0.3 到 0.45',
  },
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
 * Seed a session via POST /draft + PATCH /progress (to promote lifecycle to 'editing')
 * so it appears in the default GET /api/circles-sessions list.
 *
 * Per api-testing.md §API Data Seeding: create via API, not raw DB insertion.
 * @param {object} request — Playwright APIRequestContext
 * @param {object} cleanupTracker — fixture tracker
 * @param {string} [questionId='circles_001'] — use distinct IDs when seeding multiple sessions
 *   to avoid dedupSessions() collapsing them (lib/session-dedup.js deduplicates by question_id)
 * Returns the session id and registers it with cleanupTracker.
 */
async function seedEditingSession(request, cleanupTracker, questionId = QUESTION_ID_1) {
  const headers = await authHeaders();

  // Step 1 — create draft session
  const draftRes = await request.post(`${BASE_URL}/api/circles-sessions/draft`, {
    headers,
    data: { question_id: questionId, mode: 'drill', drill_step: DRILL_STEP },
  });
  // Per api-testing.md 434-565: always assert status first, then body
  expect(draftRes.status()).toBe(200);
  const session = await draftRes.json();
  expect(session.id).toBeTruthy();
  cleanupTracker.track('circles', session.id);

  // Step 2 — patch with substantive draft to promote lifecycle created → editing
  // Default GET list filters out lifecycle='created' rows (routes/circles-sessions.js:136)
  const patchRes = await request.patch(`${BASE_URL}/api/circles-sessions/${session.id}/progress`, {
    headers,
    data: { frameworkDraft: SUBSTANTIVE_DRAFT },
  });
  expect(patchRes.status()).toBe(200);

  return session.id;
}

/**
 * Option B manual shape assertion per api-testing.md 964-1021.
 * Verifies every required contract field for a single list row.
 * Called once per row in Test 3.
 */
function assertSessionRowShape(row) {
  // Per api-testing.md 1000-1011: toMatchObject with expect.any() for type checks
  expect(row).toMatchObject({
    id:            expect.any(String),
    question_id:   expect.any(String),
    current_phase: expect.any(Number),
    mode:          expect.any(String),
    drill_step:    expect.any(String),
    created_at:    expect.any(String),
    updated_at:    expect.any(String),
    status:        expect.any(String),
    lifecycle:     expect.any(String),
  });

  // Value constraints — per api-testing.md 1008-1010
  expect(['drill', 'sim']).toContain(row.mode);
  expect(['active', 'completed', 'archived']).toContain(row.status);
  expect(['created', 'editing', 'gated', 'completed']).toContain(row.lifecycle);

  // Date format validation — per api-testing.md 493
  expect(new Date(row.created_at).toString()).not.toBe('Invalid Date');
  expect(new Date(row.updated_at).toString()).not.toBe('Invalid Date');

  // id must be a non-empty UUID string
  expect(row.id.length).toBeGreaterThan(0);
  // question_id must be a non-empty string
  expect(row.question_id.length).toBeGreaterThan(0);
}

// ── setup ────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  // Warm up auth token cache once per file (same pattern as lifecycle-circles.spec.js)
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ── specs ────────────────────────────────────────────────────────────────────

test.describe('GET /api/circles-sessions — F-N-005 real schema contract', () => {

  // Test 1: 401 without auth
  // Per api-testing.md 434-437: always check status code first; 401 is the auth guard contract.
  test('401 without auth token', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/circles-sessions`);
    // Per api-testing.md 447: status first
    expect(res.status()).toBe(401);
  });

  // Test 2: 200 with auth, returns array
  // Per api-testing.md 530-531: ok() + status + body type check
  test('200 with valid auth, response body is an array', async ({ request, cleanupTracker }) => {
    // Seed at least one visible session so the list is non-trivially exercised
    await seedEditingSession(request, cleanupTracker);

    const headers = await authHeaders();
    const res = await request.get(`${BASE_URL}/api/circles-sessions`, { headers });

    // Per api-testing.md 529-531: check status then ok()
    expect(res.status()).toBe(200);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    // Per api-testing.md 553-564: assert array
    expect(Array.isArray(body)).toBe(true);
  });

  // Test 3: shape — each row has required contract fields
  // Per api-testing.md 496-519 (list response structure) + 903-1021 (schema validation Option B)
  test('each row in list has required contract fields (id, question_id, current_phase, mode, drill_step, created_at, updated_at, status, lifecycle)', async ({ request, cleanupTracker }) => {
    // Seed 2 sessions with DIFFERENT question_id (draft is idempotent per question+mode+drill_step)
    const id1 = await seedEditingSession(request, cleanupTracker, QUESTION_ID_1);
    const id2 = await seedEditingSession(request, cleanupTracker, QUESTION_ID_2);

    const headers = await authHeaders();
    // Use ?limit=50 to bypass the server-side in-memory cache (routes/circles-sessions.js:120-123).
    // The cache is skipped when req.query.limit is set, ensuring fresh post-seed data.
    const res = await request.get(`${BASE_URL}/api/circles-sessions?limit=50`, { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);

    // Find the two seeded rows in the response (list may contain other sessions from e2e account)
    const seededIds = new Set([id1, id2]);
    const seededRows = body.filter(r => seededIds.has(r.id));
    expect(seededRows).toHaveLength(2);

    // Per api-testing.md 504-511: assert every item in array matches shape
    for (const row of seededRows) {
      assertSessionRowShape(row);
    }

    // Also assert every row in the full list (not just seeded) conforms to contract
    for (const row of body) {
      assertSessionRowShape(row);
    }
  });

  // Test 4: empty list case (new user)
  // A brand-new user with no sessions should receive an empty array — not a 404 or error.
  // We simulate this by querying with status filter that matches no sessions.
  // Per F-N-005: "asserting required fields" implies the empty case must also return valid array.
  //
  // Implementation note: we cannot create a second e2e user without Supabase admin SDK,
  // so we use the ?status=completed filter which reliably returns [] for a fresh e2e user
  // that has no completed sessions (all seeded sessions in other tests are cleaned up).
  // The shape contract for an empty array [] is: response is array + length 0 is valid.
  test('empty list returns [] array, not null or error', async ({ request }) => {
    const headers = await authHeaders();

    // Request only 'archived' sessions — extremely unlikely to exist for e2e test user
    // and reliably gives us an empty array to test the empty-case contract.
    const res = await request.get(`${BASE_URL}/api/circles-sessions?status=archived`, { headers });
    expect(res.status()).toBe(200);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    // Per api-testing.md 553: array assertion; empty array is valid
    expect(Array.isArray(body)).toBe(true);
    // Must be 0 items (no archived sessions for e2e test user)
    expect(body).toHaveLength(0);
  });

});
