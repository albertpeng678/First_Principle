// tests/api/circles-evaluate-step-rescore-guard.spec.js
// AC-2 (spec b2ca935 §3.2): POST /api/circles-sessions/:id/evaluate-step rejects
// with 422 when stepKey already scored.
//
// Skills applied:
//   api-testing.md §Error Response Testing (lines 1023-1166) — 422 unprocessable entity pattern
//   common-pitfalls.md Pitfall 11 — real Supabase + real session (no jest.mock, no own-API mock)
//   STANDING memory feedback_e2e_real_data_only — no stub timestamp / no mock own API / real DB

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const QUESTION_ID = 'circles_001';
const DRILL_STEP = 'C1';

const adminDb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

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
  cleanupTracker.track('circles', body.id);
  return body.id;
}

async function seedStepScore(sessionId, stepKey) {
  const { error } = await adminDb
    .from('circles_sessions')
    .update({
      step_scores: {
        [stepKey]: {
          totalScore: 75,
          highlight: 'seed',
          improvement: 'seed',
          dimensions: [],
          coachVersion: { context: 'c', perField: [], reasoning: 'r' },
        },
      },
    })
    .eq('id', sessionId);
  if (error) throw new Error(`seed: ${error.message}`);
}

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

test.beforeAll(async () => {
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

test.describe('POST /evaluate-step rescore guard — AC-2', () => {
  test('422 step_already_scored when stepKey is in step_scores', async ({ request, cleanupTracker }) => {
    const sessionId = await createDraftSession(request, cleanupTracker);
    // L5 fix (P0-#255): set lifecycle='gated' so lifecycle guard passes;
    // we are testing the step_already_scored guard, not the lifecycle guard.
    await setLifecycleGated(sessionId);
    await seedStepScore(sessionId, DRILL_STEP);

    const headers = await authHeaders();
    const res = await request.post(
      `${BASE_URL}/api/circles-sessions/${sessionId}/evaluate-step`,
      { headers, data: { stepKey: DRILL_STEP, framework: 'seed', conversation: [] } }
    );

    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'step_already_scored', stepKey: DRILL_STEP });
  });
});
