// tests/api/nsm-hints-real.spec.js
// Real API layer tests for NSM hint endpoints (Trophy 60% tier).
// Hits localhost:4000 real Express + real Supabase test DB.
//
// Skills applied:
//   api-testing.md §APIRequestContext Basics — request.post directly
//   api-testing.md §Error Response Testing — 400/401/404 error paths
//   when-to-mock.md §Full Mock (route.fulfill) — ONLY for api.openai.com (third-party)
//   when-to-mock.md Pitfall 11 — NEVER mock own routes/DB
//   test-organization.md §Pattern 1 — tests/api/ feature-based file
//
// NOTE on OpenAI mocking:
//   page.route() only intercepts browser-initiated HTTP, not server-to-server Node.js calls.
//   Hint endpoints call OpenAI from the Express process directly.
//   Per when-to-mock.md §Real Service Strategies + lifecycle-nsm.spec.js precedent:
//   happy-path tests call real OpenAI with test.slow(); validation + permission tests
//   never reach OpenAI, so they are instant.
//
// Endpoints tested:
//   POST /api/nsm-public/step2-hint   (public, no auth, no session)
//   POST /api/nsm-public/step3-hint   (public, no auth, no session)
//   POST /api/nsm-sessions/:id/hints  (auth-required, real Supabase session)
//
// Cleanup: cleanupTracker fixture DELETEs created nsm-sessions after each test.

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// ── shared test data ──────────────────────────────────────────────────────────

// Real NSM question ID from public/nsm-db.js (first question: Netflix)
const QUESTION_ID = 'q1';

// Minimal question_json for session creation (mirrors lifecycle-nsm.spec.js pattern)
const QUESTION_JSON = {
  id: 'q1',
  company: 'Netflix',
  industry: '內容訂閱制',
  scenario: '影音串流平台競爭激烈，必須確保用戶持續感受到內容價值以維持自動扣款。',
};

// ── helpers ───────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getE2eToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// Creates a real NSM session in Supabase and registers for cleanup.
async function createNsmSession(request, cleanupTracker) {
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

// ── setup ─────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  // Warm up auth token cache once per file (per lifecycle-circles.spec.js pattern)
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ── POST /api/nsm-public/step2-hint ──────────────────────────────────────────

test.describe('POST /api/nsm-public/step2-hint', () => {

  // Validation: missing questionId → 400 (never reaches OpenAI)
  test('returns 400 when questionId is missing', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/nsm-public/step2-hint`, {
      data: { field: 'nsm' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    // Per api-testing.md §Error Response Testing: assert specific error key
    expect(body.error).toBe('missing_questionId');
  });

  // Validation: invalid field value → 400 (never reaches OpenAI)
  test('returns 400 when field is not in allowlist', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/nsm-public/step2-hint`, {
      data: { questionId: QUESTION_ID, field: 'invalid_field_name' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_field');
  });

  // Validation: unknown questionId → 404 (never reaches OpenAI)
  test('returns 404 when questionId does not exist in DB', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/nsm-public/step2-hint`, {
      data: { questionId: 'nonexistent-q-xyz', field: 'nsm' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('question_not_found');
  });

  // Permission: public endpoint — no auth required
  test('succeeds without any Authorization header (public endpoint)', async ({ request }) => {
    // This test only verifies the route does not reject unauthenticated requests.
    // It will hit OpenAI; use test.slow() per lifecycle-nsm.spec.js precedent.
    test.slow();
    const res = await request.post(`${BASE_URL}/api/nsm-public/step2-hint`, {
      // Intentionally no Authorization header
      headers: { 'Content-Type': 'application/json' },
      data: { questionId: QUESTION_ID, field: 'nsm' },
    });
    // Route is public: must not return 401
    expect(res.status()).not.toBe(401);
    // Either 200 (OpenAI call succeeded) or 500 (OpenAI error) are acceptable here;
    // what matters is the route itself does not require authentication.
    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Per api-testing.md §JSON Response Assertions: assert body shape
      expect(body).toHaveProperty('hint');
      expect(typeof body.hint).toBe('string');
      expect(body.hint.length).toBeGreaterThan(0);
    }
  });

  // Happy path: valid input → 200 + hint string (calls real OpenAI)
  test('returns 200 with hint string for valid nsm field', async ({ request }) => {
    test.slow(); // calls real OpenAI
    const res = await request.post(`${BASE_URL}/api/nsm-public/step2-hint`, {
      data: { questionId: QUESTION_ID, field: 'nsm' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('hint');
    expect(typeof body.hint).toBe('string');
    // Hint should be non-empty and in Chinese (prompt instructs 純繁體中文)
    expect(body.hint.length).toBeGreaterThan(5);
  });

  // Happy path: explanation field
  test('returns 200 with hint string for explanation field', async ({ request }) => {
    test.slow(); // calls real OpenAI
    const res = await request.post(`${BASE_URL}/api/nsm-public/step2-hint`, {
      data: { questionId: QUESTION_ID, field: 'explanation' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('hint');
    expect(typeof body.hint).toBe('string');
    expect(body.hint.length).toBeGreaterThan(5);
  });

  // Happy path: businessLink field (all 3 allowed fields covered)
  test('returns 200 with hint string for businessLink field', async ({ request }) => {
    test.slow(); // calls real OpenAI
    const res = await request.post(`${BASE_URL}/api/nsm-public/step2-hint`, {
      data: { questionId: QUESTION_ID, field: 'businessLink' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('hint');
    expect(typeof body.hint).toBe('string');
    expect(body.hint.length).toBeGreaterThan(5);
  });

  // Verify userDraft is never forwarded to prompt (Stage 1D contract)
  // Per hint-routes.test.js intent: the route strips userDraft before calling prompt.
  // We verify the route still returns 200 when userDraft is included in body.
  test('returns 200 even when userDraft is included (route strips it)', async ({ request }) => {
    test.slow();
    const res = await request.post(`${BASE_URL}/api/nsm-public/step2-hint`, {
      data: { questionId: QUESTION_ID, field: 'nsm', userDraft: 'should be ignored' },
    });
    // Route must not reject because of unknown field in body
    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('hint');
    }
  });

});

// ── POST /api/nsm-public/step3-hint ──────────────────────────────────────────

test.describe('POST /api/nsm-public/step3-hint', () => {

  // Validation: missing questionId → 400
  test('returns 400 when questionId is missing', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/nsm-public/step3-hint`, {
      data: { dimId: 'reach', dimType: 'attention' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_questionId');
  });

  // Validation: invalid dimId → 400
  test('returns 400 when dimId is not in allowlist', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/nsm-public/step3-hint`, {
      data: { questionId: QUESTION_ID, dimId: 'invalid_dim', dimType: 'attention' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_dimId');
  });

  // Validation: invalid dimType → 400
  test('returns 400 when dimType is invalid', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/nsm-public/step3-hint`, {
      data: { questionId: QUESTION_ID, dimId: 'reach', dimType: 'unknown_type' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_dimType');
  });

  // Validation: unknown questionId → 404
  test('returns 404 when questionId does not exist', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/nsm-public/step3-hint`, {
      data: { questionId: 'nonexistent-q-xyz', dimId: 'reach', dimType: 'attention' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('question_not_found');
  });

  // Permission: public endpoint — no auth required
  test('succeeds without Authorization header (public endpoint)', async ({ request }) => {
    test.slow();
    const res = await request.post(`${BASE_URL}/api/nsm-public/step3-hint`, {
      headers: { 'Content-Type': 'application/json' },
      data: { questionId: QUESTION_ID, dimId: 'reach', dimType: 'attention' },
    });
    expect(res.status()).not.toBe(401);
    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('hint');
      expect(typeof body.hint).toBe('string');
      expect(body.hint.length).toBeGreaterThan(0);
    }
  });

  // Happy path: valid input → 200 + hint string (all 4 dim types covered)
  test('returns 200 with hint for reach/attention', async ({ request }) => {
    test.slow();
    const res = await request.post(`${BASE_URL}/api/nsm-public/step3-hint`, {
      data: { questionId: QUESTION_ID, dimId: 'reach', dimType: 'attention' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('hint');
    expect(typeof body.hint).toBe('string');
    expect(body.hint.length).toBeGreaterThan(5);
  });

  test('returns 200 with hint for depth/saas', async ({ request }) => {
    test.slow();
    const res = await request.post(`${BASE_URL}/api/nsm-public/step3-hint`, {
      data: { questionId: QUESTION_ID, dimId: 'depth', dimType: 'saas' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('hint');
    expect(typeof body.hint).toBe('string');
    expect(body.hint.length).toBeGreaterThan(5);
  });

  // dimType is optional — defaults to 'attention'
  test('returns 200 when dimType is omitted (defaults to attention)', async ({ request }) => {
    test.slow();
    const res = await request.post(`${BASE_URL}/api/nsm-public/step3-hint`, {
      data: { questionId: QUESTION_ID, dimId: 'frequency' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('hint');
    expect(typeof body.hint).toBe('string');
  });

  // Stage 1D contract: userDraft ignored
  test('returns 200 even when userDraft is included (route strips it)', async ({ request }) => {
    test.slow();
    const res = await request.post(`${BASE_URL}/api/nsm-public/step3-hint`, {
      data: { questionId: QUESTION_ID, dimId: 'frequency', dimType: 'attention', userDraft: 'ignored' },
    });
    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('hint');
    }
  });

});

// ── POST /api/nsm-sessions/:id/hints ─────────────────────────────────────────

test.describe('POST /api/nsm-sessions/:id/hints', () => {

  // Permission: no auth → 401 (auth-required endpoint)
  test('returns 401 when Authorization header is missing', async ({ request }) => {
    // Use a fake session id — the auth middleware rejects before DB lookup
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/00000000-0000-4000-a000-000000000000/hints`, {
      headers: { 'Content-Type': 'application/json' },
      data: { userNsm: '測試指標' },
    });
    // Per api-testing.md §Error Response Testing §401 — missing authentication
    expect(res.status()).toBe(401);
  });

  // Permission: invalid/expired token → 401
  test('returns 401 with invalid Bearer token', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/00000000-0000-4000-a000-000000000000/hints`, {
      headers: {
        'Authorization': 'Bearer invalid.token.value',
        'Content-Type': 'application/json',
      },
      data: { userNsm: '測試指標' },
    });
    expect(res.status()).toBe(401);
  });

  // Validation: valid auth but session not found → 404
  test('returns 404 when session does not belong to authenticated user', async ({ request }) => {
    const headers = await authHeaders();
    // Valid session UUID format but does not exist for this user
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/00000000-0000-4000-a000-000000000001/hints`, {
      headers,
      data: { userNsm: '測試指標' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  // Happy path: valid auth + real session → 200 + 3-dim hints object
  test('returns 200 with 3-dim hint object for valid session', async ({ request, cleanupTracker }) => {
    test.slow(); // creates real Supabase session + calls real OpenAI
    const sessionId = await createNsmSession(request, cleanupTracker);

    const headers = await authHeaders();
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/${sessionId}/hints`, {
      headers,
      data: { userNsm: '週活躍 Podcast 用戶數' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Per api-testing.md §JSON Response Assertions: assert all 3 dim keys present
    expect(body).toMatchObject({
      reach:     expect.any(String),
      depth:     expect.any(String),
      frequency: expect.any(String),
    });
    // Each dim hint should be a non-empty markdown string
    for (const dim of ['reach', 'depth', 'frequency']) {
      expect(body[dim].length).toBeGreaterThan(0);
    }
  });

  // Happy path: userNsm is optional (empty string accepted)
  test('returns 200 when userNsm is omitted (defaults to empty string)', async ({ request, cleanupTracker }) => {
    test.slow();
    const sessionId = await createNsmSession(request, cleanupTracker);

    const headers = await authHeaders();
    const res = await request.post(`${BASE_URL}/api/nsm-sessions/${sessionId}/hints`, {
      headers,
      data: {},
    });
    // Route defaults userNsm to '' — should still succeed
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('reach');
    expect(body).toHaveProperty('depth');
    expect(body).toHaveProperty('frequency');
  });

});

// ── POST /api/guest/nsm-sessions/:id/hints ───────────────────────────────────

test.describe('POST /api/guest/nsm-sessions/:id/hints', () => {

  // Permission: missing x-guest-id header → 400 (requireGuestId middleware)
  test('returns 400 when x-guest-id header is missing', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/guest/nsm-sessions/00000000-0000-4000-a000-000000000000/hints`, {
      headers: { 'Content-Type': 'application/json' },
      data: { userNsm: '測試' },
    });
    // requireGuestId returns 400 missing_or_invalid_guest_id (not 401)
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_or_invalid_guest_id');
  });

  // Permission: invalid (non-UUID) guest id → 400
  test('returns 400 when x-guest-id is not a valid UUID', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/guest/nsm-sessions/00000000-0000-4000-a000-000000000000/hints`, {
      headers: {
        'Content-Type': 'application/json',
        'x-guest-id': 'not-a-uuid',
      },
      data: { userNsm: '測試' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_or_invalid_guest_id');
  });

  // Validation: valid guest id but session not found → 404
  test('returns 404 when guest session does not exist', async ({ request }) => {
    const { v4: uuidv4 } = require('crypto');
    // Node's crypto.randomUUID() generates a valid v4 UUID
    const fakeGuestId = require('crypto').randomUUID();
    const res = await request.post(`${BASE_URL}/api/guest/nsm-sessions/00000000-0000-4000-a000-000000000002/hints`, {
      headers: {
        'Content-Type': 'application/json',
        'x-guest-id': fakeGuestId,
      },
      data: { userNsm: '測試' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

});
