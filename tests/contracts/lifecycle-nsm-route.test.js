// tests/contracts/lifecycle-nsm-route.test.js
// Mirrors lifecycle-circles-route.test.js for NSM routes.
// Uses supertest against the in-process app; DB calls stubbed via
// the in-memory store in tests/helpers/test-supabase.js.

const { seedSession, createMockDb, aiStubs } = require('../helpers/test-supabase');

// ── jest.mock() declarations (hoisted by jest) ────────────────────────────────

jest.mock('../../db/client', () => {
  const { createMockDb } = require('../helpers/test-supabase');
  return createMockDb();
});

jest.mock('../../prompts/nsm-gate', () => ({
  reviewNSMGate: jest.fn(async () => {
    const { aiStubs } = require('../helpers/test-supabase');
    return aiStubs['nsm-gate'] || { canProceed: true, overallStatus: 'ok', items: [] };
  }),
}));

jest.mock('../../prompts/nsm-evaluator', () => ({
  evaluateNSM: jest.fn(async () => {
    const { aiStubs } = require('../helpers/test-supabase');
    return aiStubs['nsm-evaluator'] || { total: 80, coachTree: {}, dimensions: {} };
  }),
}));

// Stub remaining prompt deps not under test
jest.mock('../../prompts/nsm-hints', () => ({ generateNSMHints: jest.fn() }));
jest.mock('../../prompts/nsm-context', () => ({ generateNSMContext: jest.fn() }));
jest.mock('../../prompts/utils/product-type', () => ({ guessProductType: jest.fn() }));

// ── App setup ─────────────────────────────────────────────────────────────────

const request = require('supertest');
const express = require('express');

const GUEST_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createTestApp() {
  const app = express();
  app.use(express.json());
  const authRouter = require('../../routes/nsm-sessions');
  const guestRouter = require('../../routes/guest-nsm-sessions');
  app.use('/api/nsm-sessions', authRouter);
  app.use('/api/guest-nsm-sessions', guestRouter);
  return app;
}

// ── Auth NSM lifecycle wiring ─────────────────────────────────────────────────

describe('NSM lifecycle wiring', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    seedSession.reset();
  });

  test('POST / inserts lifecycle=created (SLC-AC4)', async () => {
    const res = await request(app)
      .post('/api/nsm-sessions')
      .set('Authorization', 'Bearer test-user-1')
      .send({ questionId: 'nsm_001', questionJson: { id: 'nsm_001', problem_statement: 'test' } });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', res.body.sessionId);
    expect(row.lifecycle).toBe('created');
  });

  test('PATCH /:id/progress with userNsm → editing (SLC-AC5)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'created', user_id: 'test-user-1' });
    const res = await request(app)
      .patch(`/api/nsm-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ userNsm: '我們的 NSM 是週活躍用戶數，目標提升 30%' });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('editing');
  });

  test('PATCH /:id/progress with polluted-only stub does NOT promote (SLC-AC6)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'created', user_id: 'test-user-1' });
    const res = await request(app)
      .patch(`/api/nsm-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ userNsm: 'e2e-r1-17896543210' });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('created');
  });

  test('POST /:id/gate ok=true → gated (SLC-AC7)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'editing', user_id: 'test-user-1' });
    seedSession.stubAi('nsm-gate', { canProceed: true, overallStatus: 'ok', items: [] });
    const res = await request(app)
      .post(`/api/nsm-sessions/${id}/gate`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ nsm: '週活躍用戶數', rationale: '因為它直接反映核心使用行為' });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('gated');
  });

  test('POST /:id/gate ok=false does NOT promote (SLC-AC7 negative)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'editing', user_id: 'test-user-1' });
    seedSession.stubAi('nsm-gate', { canProceed: false, overallStatus: 'error', items: [] });
    await request(app)
      .post(`/api/nsm-sessions/${id}/gate`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ nsm: '週活躍用戶數', rationale: '因為它直接反映核心使用行為' });
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('editing');
  });

  test('POST /:id/evaluate → completed (SLC-AC8)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'gated', user_id: 'test-user-1' });
    seedSession.stubAi('nsm-evaluator', { total: 85, coachTree: {}, dimensions: {} });
    const res = await request(app)
      .post(`/api/nsm-sessions/${id}/evaluate`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ userNsm: '週活躍用戶數', userBreakdown: { reach: '...', depth: '...', frequency: '...' } });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('completed');
  });

  test('PATCH following gated cannot demote (SLC-AC9 monotone)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'gated', user_id: 'test-user-1' });
    const res = await request(app)
      .patch(`/api/nsm-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ currentStep: 2 });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('gated');
  });

  test('FE-supplied lifecycle in body is ignored (SLC-AC10)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'created', user_id: 'test-user-1' });
    // Sending only lifecycle — route must strip it, return 400 (nothing_to_update)
    // and DB row lifecycle must remain 'created'
    await request(app)
      .patch(`/api/nsm-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ lifecycle: 'completed' });
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('created');
  });
});

// ── Guest NSM lifecycle wiring ────────────────────────────────────────────────

describe('GUEST NSM lifecycle wiring', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    seedSession.reset();
  });

  test('POST / inserts lifecycle=created (SLC-AC4 guest)', async () => {
    const res = await request(app)
      .post('/api/guest-nsm-sessions')
      .set('X-Guest-ID', GUEST_ID)
      .send({ questionId: 'nsm_001', questionJson: { id: 'nsm_001', problem_statement: 'test' } });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', res.body.sessionId);
    expect(row.lifecycle).toBe('created');
  });

  test('PATCH /:id/progress with userNsm → editing (SLC-AC5 guest)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'created', guest_id: GUEST_ID });
    const res = await request(app)
      .patch(`/api/guest-nsm-sessions/${id}/progress`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ userNsm: '我們的 NSM 是週活躍用戶數，目標提升 30%' });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('editing');
  });

  test('PATCH /:id/progress with polluted-only stub does NOT promote (SLC-AC6 guest)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'created', guest_id: GUEST_ID });
    const res = await request(app)
      .patch(`/api/guest-nsm-sessions/${id}/progress`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ userNsm: 'e2e-r1-17896543210' });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('created');
  });

  test('POST /:id/gate ok=true → gated (SLC-AC7 guest)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'editing', guest_id: GUEST_ID });
    seedSession.stubAi('nsm-gate', { canProceed: true, overallStatus: 'ok', items: [] });
    const res = await request(app)
      .post(`/api/guest-nsm-sessions/${id}/gate`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ nsm: '週活躍用戶數', rationale: '因為它直接反映核心使用行為' });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('gated');
  });

  test('POST /:id/gate ok=false does NOT promote (SLC-AC7 negative guest)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'editing', guest_id: GUEST_ID });
    seedSession.stubAi('nsm-gate', { canProceed: false, overallStatus: 'error', items: [] });
    await request(app)
      .post(`/api/guest-nsm-sessions/${id}/gate`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ nsm: '週活躍用戶數', rationale: '因為它直接反映核心使用行為' });
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('editing');
  });

  test('POST /:id/evaluate → completed (SLC-AC8 guest)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'gated', guest_id: GUEST_ID });
    seedSession.stubAi('nsm-evaluator', { total: 85, coachTree: {}, dimensions: {} });
    const res = await request(app)
      .post(`/api/guest-nsm-sessions/${id}/evaluate`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ userNsm: '週活躍用戶數', userBreakdown: { reach: '...', depth: '...', frequency: '...' } });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('completed');
  });

  test('PATCH following gated cannot demote (SLC-AC9 monotone guest)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'gated', guest_id: GUEST_ID });
    const res = await request(app)
      .patch(`/api/guest-nsm-sessions/${id}/progress`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ currentStep: 2 });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('gated');
  });

  test('FE-supplied lifecycle in body is ignored (SLC-AC10 guest)', async () => {
    const id = seedSession.insert('nsm_sessions', { lifecycle: 'created', guest_id: GUEST_ID });
    await request(app)
      .patch(`/api/guest-nsm-sessions/${id}/progress`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ lifecycle: 'completed' });
    const row = seedSession.fetch('nsm_sessions', id);
    expect(row.lifecycle).toBe('created');
  });
});
