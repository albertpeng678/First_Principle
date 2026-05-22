// tests/api/nsm-evaluate-shape-coerce.spec.js
//
// P0-SCHEMA-1-v2 — NSM /evaluate user_nsm shape coerce verification.
// Spec: docs/superpowers/specs/2026-05-22-schema-1-v2-evaluate-shape-coerce-design.md §6
//
// Skills applied:
//   playwright-skill/core/api-testing.md §APIRequestContext Basics — request fixture
//   playwright-skill/core/api-testing.md §Data Seeding (service-role carve-out)
//   playwright-skill/core/common-pitfalls.md Pitfall 11 — no-mock self-backend
//   playwright-skill/core/common-pitfalls.md Pitfall 14 — test-local + auto-cleanup
//   addy/test-driven-development Prove-It pattern — red→green proof of B3 merge
//
// 6 TCs = auth × 3 + guest × 3:
//   TC1 string→object merge preserves existing explanation/businessLink
//   TC2 object passthrough (idempotent)
//   TC3 invalid type (array) → no-op (DB unchanged)

const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const TEST_EMAIL = 'e2e@first-principle.test';
const TEST_PASSWORD = process.env.TEST_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TEST_PASSWORD) {
  throw new Error('Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / TEST_PASSWORD');
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test-local cleanup tracker (Pitfall 14)
const createdSessionIds = [];

test.afterAll(async () => {
  if (createdSessionIds.length) {
    await admin.from('nsm_sessions').delete().in('id', createdSessionIds);
  }
});

async function getAuthToken(request) {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { 'apikey': process.env.SUPABASE_ANON_KEY || '', 'Content-Type': 'application/json' },
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { token: body.access_token, userId: body.user.id };
}

async function seedAuthSession(userId, initialUserNsm) {
  const id = crypto.randomUUID();
  const { error } = await admin.from('nsm_sessions').insert({
    id,
    user_id: userId,
    question_id: `coerce-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question_json: { id: 'q1', nsm: 'Test', evaluator: { dims: [] } },
    status: 'editing',
    lifecycle: 'editing',
    user_nsm: initialUserNsm,
    user_breakdown: {},
    progress_json: { currentStep: 3 },
  });
  if (error) throw new Error(`seed failed: ${error.message}`);
  createdSessionIds.push(id);
  return id;
}

async function seedGuestSession(guestId, initialUserNsm) {
  const id = crypto.randomUUID();
  const { error } = await admin.from('nsm_sessions').insert({
    id,
    guest_id: guestId,
    question_id: `coerce-tc-guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question_json: { id: 'q1', nsm: 'Test', evaluator: { dims: [] } },
    status: 'editing',
    lifecycle: 'editing',
    user_nsm: initialUserNsm,
    user_breakdown: {},
    progress_json: { currentStep: 3 },
  });
  if (error) throw new Error(`seed failed: ${error.message}`);
  createdSessionIds.push(id);
  return id;
}

async function readBack(sessionId) {
  const { data, error } = await admin.from('nsm_sessions').select('user_nsm').eq('id', sessionId).single();
  if (error) throw error;
  return data.user_nsm;
}

test.describe('P0-SCHEMA-1-v2 coerce — auth route', () => {
  test('TC1 string input merges with existing explanation/businessLink', async ({ request }) => {
    const { token, userId } = await getAuthToken(request);
    const sid = await seedAuthSession(userId, { nsm: 'old', explanation: 'X', businessLink: 'Y' });

    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${sid}/progress`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { userNsm: 'new' },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'new', explanation: 'X', businessLink: 'Y' });
  });

  test('TC2 object input passes through unchanged', async ({ request }) => {
    const { token, userId } = await getAuthToken(request);
    const sid = await seedAuthSession(userId, {});

    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${sid}/progress`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { userNsm: { nsm: 'a', explanation: 'b', businessLink: 'c' } },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'a', explanation: 'b', businessLink: 'c' });
  });

  test('TC3 array input → no-op (DB unchanged)', async ({ request }) => {
    const { token, userId } = await getAuthToken(request);
    const sid = await seedAuthSession(userId, { nsm: 'old', explanation: 'X', businessLink: 'Y' });

    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${sid}/progress`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { userNsm: [1, 2, 3] },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'old', explanation: 'X', businessLink: 'Y' });
  });
});

test.describe('P0-SCHEMA-1-v2 coerce — guest route', () => {
  test('TC1 guest string input merges', async ({ request }) => {
    const guestId = crypto.randomUUID();
    const sid = await seedGuestSession(guestId, { nsm: 'old', explanation: 'X', businessLink: 'Y' });

    const res = await request.patch(`${BASE_URL}/api/guest/nsm-sessions/${sid}/progress`, {
      headers: { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' },
      data: { userNsm: 'new' },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'new', explanation: 'X', businessLink: 'Y' });
  });

  test('TC2 guest object passthrough', async ({ request }) => {
    const guestId = crypto.randomUUID();
    const sid = await seedGuestSession(guestId, {});

    const res = await request.patch(`${BASE_URL}/api/guest/nsm-sessions/${sid}/progress`, {
      headers: { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' },
      data: { userNsm: { nsm: 'a', explanation: 'b', businessLink: 'c' } },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'a', explanation: 'b', businessLink: 'c' });
  });

  test('TC3 guest array → no-op', async ({ request }) => {
    const guestId = crypto.randomUUID();
    const sid = await seedGuestSession(guestId, { nsm: 'old', explanation: 'X', businessLink: 'Y' });

    const res = await request.patch(`${BASE_URL}/api/guest/nsm-sessions/${sid}/progress`, {
      headers: { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' },
      data: { userNsm: [1, 2, 3] },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'old', explanation: 'X', businessLink: 'Y' });
  });
});
