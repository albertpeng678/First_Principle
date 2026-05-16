// tests/contracts/lifecycle-circles-route.test.js
// Uses supertest against the in-process app to verify the lifecycle column
// is written correctly by every PATCH/POST. Real DB calls are stubbed via
// the in-memory store in tests/helpers/test-supabase.js.

const { seedSession, createMockDb, aiStubs } = require('../helpers/test-supabase');

// ── jest.mock() declarations (hoisted by jest) ────────────────────────────────

jest.mock('../../db/client', () => {
  const { createMockDb } = require('../helpers/test-supabase');
  return createMockDb();
});

jest.mock('../../prompts/circles-gate', () => ({
  reviewFramework: jest.fn(async () => {
    const { aiStubs } = require('../helpers/test-supabase');
    return aiStubs['circles-gate'] || { ok: true, issues: [] };
  }),
}));

jest.mock('../../prompts/circles-final-report', () => ({
  generateFinalReport: jest.fn(async () => {
    const { aiStubs } = require('../helpers/test-supabase');
    return aiStubs['circles-final'] || { total: 80, details: {} };
  }),
}));

// Stub remaining prompt deps not under test
jest.mock('../../prompts/circles-coach', () => ({ streamCirclesReply: jest.fn() }));
jest.mock('../../prompts/circles-evaluator', () => ({ evaluateCirclesStep: jest.fn() }));
jest.mock('../../prompts/circles-conclusion-check', () => ({ checkConclusion: jest.fn() }));
jest.mock('../../prompts/circles-hint', () => ({ generateCirclesHint: jest.fn() }));
jest.mock('../../prompts/circles-example', () => ({ generateCirclesExample: jest.fn() }));

// ── App setup ─────────────────────────────────────────────────────────────────

const request = require('supertest');
const express = require('express');

const GUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createTestApp() {
  const app = express();
  app.use(express.json());
  const authRouter = require('../../routes/circles-sessions');
  const guestRouter = require('../../routes/guest-circles-sessions');
  app.use('/api/circles-sessions', authRouter);
  app.use('/api/guest-circles-sessions', guestRouter);
  return app;
}

// ── Auth CIRCLES lifecycle wiring ─────────────────────────────────────────────

describe('CIRCLES lifecycle wiring', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    seedSession.reset();
  });

  test('POST /draft inserts lifecycle=created (SLC-AC4)', async () => {
    const res = await request(app)
      .post('/api/circles-sessions/draft')
      .set('Authorization', 'Bearer test-user-1')
      .send({ question_id: 'circles_001', mode: 'drill' });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('circles_sessions', res.body.id);
    expect(row.lifecycle).toBe('created');
  });

  test('PATCH /:id/progress with substantive content → editing (SLC-AC5)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'created', user_id: 'test-user-1' });
    const res = await request(app)
      .patch(`/api/circles-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ frameworkDraft: { C1: { 問題範圍: '我們的目標是把週活躍提升到 30%' } } });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('editing');
  });

  test('PATCH /:id/progress with polluted-only stub does NOT promote (SLC-AC6)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'created', user_id: 'test-user-1' });
    const res = await request(app)
      .patch(`/api/circles-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ frameworkDraft: { C1: { 問題範圍: 'e2e-r1-17896543210' } } });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('created');
  });

  test('POST /:id/gate ok=true → gated (SLC-AC7)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'editing', user_id: 'test-user-1' });
    seedSession.stubAi('circles-gate', { ok: true, issues: [] });
    const res = await request(app)
      .post(`/api/circles-sessions/${id}/gate`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ step: 'C1', frameworkDraft: { C1: { 問題範圍: '真實' } } });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('gated');
  });

  test('POST /:id/gate ok=false does NOT promote (SLC-AC7 negative)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'editing', user_id: 'test-user-1' });
    seedSession.stubAi('circles-gate', { ok: false, issues: ['too vague'] });
    await request(app)
      .post(`/api/circles-sessions/${id}/gate`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ step: 'C1', frameworkDraft: { C1: { 問題範圍: '真實' } } });
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('editing');
  });

  test('POST /:id/final-report → completed (SLC-AC8)', async () => {
    const id = seedSession.insert('circles_sessions', {
      lifecycle: 'gated',
      user_id: 'test-user-1',
      step_scores: { C1: 80, I: 75, R: 70, C2: 65, L: 60, E: 55, S: 50 },
    });
    seedSession.stubAi('circles-final', { total: 85 });
    const res = await request(app)
      .post(`/api/circles-sessions/${id}/final-report`)
      .set('Authorization', 'Bearer test-user-1');
    expect(res.status).toBe(200);
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('completed');
  });

  test('PATCH following gated cannot demote (SLC-AC9 monotone)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'gated', user_id: 'test-user-1' });
    await request(app)
      .patch(`/api/circles-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ currentStep: 'I' });
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('gated');
  });

  test('FE-supplied lifecycle in body is ignored (SLC-AC10)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'created', user_id: 'test-user-1' });
    // Sending only lifecycle in body: route should strip it + return 400 (nothing_to_update)
    // but the DB row lifecycle must remain 'created'
    await request(app)
      .patch(`/api/circles-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ lifecycle: 'completed' });
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('created');
  });
});

// ── Guest CIRCLES lifecycle wiring ────────────────────────────────────────────

describe('GUEST CIRCLES lifecycle wiring', () => {
  let app;

  beforeAll(() => {
    // Reuse existing app instance (routes already loaded)
    app = createTestApp();
  });

  beforeEach(() => {
    seedSession.reset();
  });

  test('POST /draft inserts lifecycle=created (SLC-AC4 guest)', async () => {
    const res = await request(app)
      .post('/api/guest-circles-sessions/draft')
      .set('X-Guest-ID', GUEST_ID)
      .send({ question_id: 'circles_001', mode: 'drill' });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('circles_sessions', res.body.id);
    expect(row.lifecycle).toBe('created');
  });

  test('PATCH /:id/progress with substantive content → editing (SLC-AC5 guest)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'created', guest_id: GUEST_ID });
    const res = await request(app)
      .patch(`/api/guest-circles-sessions/${id}/progress`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ frameworkDraft: { C1: { 問題範圍: '我們的目標是把週活躍提升到 30%' } } });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('editing');
  });

  test('PATCH /:id/progress with polluted-only stub does NOT promote (SLC-AC6 guest)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'created', guest_id: GUEST_ID });
    const res = await request(app)
      .patch(`/api/guest-circles-sessions/${id}/progress`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ frameworkDraft: { C1: { 問題範圍: 'e2e-r1-17896543210' } } });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('created');
  });

  test('POST /:id/gate ok=true → gated (SLC-AC7 guest)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'editing', guest_id: GUEST_ID });
    seedSession.stubAi('circles-gate', { ok: true, issues: [] });
    const res = await request(app)
      .post(`/api/guest-circles-sessions/${id}/gate`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ step: 'C1', frameworkDraft: { C1: { 問題範圍: '真實' } } });
    expect(res.status).toBe(200);
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('gated');
  });

  test('POST /:id/gate ok=false does NOT promote (SLC-AC7 negative guest)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'editing', guest_id: GUEST_ID });
    seedSession.stubAi('circles-gate', { ok: false, issues: ['too vague'] });
    await request(app)
      .post(`/api/guest-circles-sessions/${id}/gate`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ step: 'C1', frameworkDraft: { C1: { 問題範圍: '真實' } } });
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('editing');
  });

  test('POST /:id/final-report → completed (SLC-AC8 guest)', async () => {
    const id = seedSession.insert('circles_sessions', {
      lifecycle: 'gated',
      guest_id: GUEST_ID,
      step_scores: { C1: 80, I: 75, R: 70, C2: 65, L: 60, E: 55, S: 50 },
    });
    seedSession.stubAi('circles-final', { total: 85 });
    const res = await request(app)
      .post(`/api/guest-circles-sessions/${id}/final-report`)
      .set('X-Guest-ID', GUEST_ID);
    expect(res.status).toBe(200);
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('completed');
  });

  test('PATCH following gated cannot demote (SLC-AC9 monotone guest)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'gated', guest_id: GUEST_ID });
    await request(app)
      .patch(`/api/guest-circles-sessions/${id}/progress`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ currentStep: 'I' });
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('gated');
  });

  test('FE-supplied lifecycle in body is ignored (SLC-AC10 guest)', async () => {
    const id = seedSession.insert('circles_sessions', { lifecycle: 'created', guest_id: GUEST_ID });
    await request(app)
      .patch(`/api/guest-circles-sessions/${id}/progress`)
      .set('X-Guest-ID', GUEST_ID)
      .send({ lifecycle: 'completed' });
    const row = seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('created');
  });
});
