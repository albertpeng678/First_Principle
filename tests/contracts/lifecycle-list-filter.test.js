// tests/contracts/lifecycle-list-filter.test.js
// Contract tests: GET list endpoints filter lifecycle='created' by default.
// ?include_empty=true is operator-only (authenticated routes) or rejected with 403
// (guest routes have no user email, so always 403).
//
// SLC-AC11: default list excludes created rows
// SLC-AC12: GET /:id still returns created row
// SLC-AC13: ?include_empty=true from non-operator → 403
// SLC-AC14: ?include_empty=true from operator → returns all

const { seedSession, createMockDb, aiStubs } = require('../helpers/test-supabase');

// ── jest.mock() declarations (hoisted by jest) ────────────────────────────────

jest.mock('../../db/client', () => {
  const { createMockDb } = require('../helpers/test-supabase');
  return createMockDb();
});

// Stub all prompt deps not under test
jest.mock('../../prompts/circles-gate', () => ({ reviewFramework: jest.fn() }));
jest.mock('../../prompts/circles-final-report', () => ({ generateFinalReport: jest.fn() }));
jest.mock('../../prompts/circles-coach', () => ({ streamCirclesReply: jest.fn() }));
jest.mock('../../prompts/circles-evaluator', () => ({ evaluateCirclesStep: jest.fn() }));
jest.mock('../../prompts/circles-conclusion-check', () => ({ checkConclusion: jest.fn() }));
jest.mock('../../prompts/circles-hint', () => ({ generateCirclesHint: jest.fn() }));
jest.mock('../../prompts/circles-example', () => ({ generateCirclesExample: jest.fn() }));
jest.mock('../../prompts/nsm-evaluator', () => ({ evaluateNSM: jest.fn() }));
jest.mock('../../prompts/nsm-hints', () => ({ generateNSMHints: jest.fn() }));
jest.mock('../../prompts/nsm-gate', () => ({ reviewNSMGate: jest.fn() }));
jest.mock('../../prompts/nsm-context', () => ({ generateNSMContext: jest.fn() }));
jest.mock('../../prompts/utils/product-type', () => ({ guessProductType: jest.fn(() => 'b2b') }));
jest.mock('../../lib/evaluate-step-handler', () => ({
  runEvaluateStep: jest.fn(),
  EvaluatorError: class EvaluatorError extends Error {},
}));

// ── App setup ─────────────────────────────────────────────────────────────────

const request = require('supertest');
const express = require('express');

const GUEST_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/circles-sessions', require('../../routes/circles-sessions'));
  app.use('/api/guest-circles-sessions', require('../../routes/guest-circles-sessions'));
  app.use('/api/nsm-sessions', require('../../routes/nsm-sessions'));
  app.use('/api/guest/nsm-sessions', require('../../routes/guest-nsm-sessions'));
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated CIRCLES — /api/circles-sessions
// ─────────────────────────────────────────────────────────────────────────────

describe('list filter — circles-sessions (auth)', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
    process.env.OPERATOR_EMAIL = 'op@first-principle.test';
  });

  beforeEach(() => {
    seedSession.reset();
    // Use distinct question_ids to prevent dedupSessions collapsing them to 1 row
    seedSession.insert('circles_sessions', { user_id: 'user-A', lifecycle: 'created',   question_id: 'QC1' });
    seedSession.insert('circles_sessions', { user_id: 'user-A', lifecycle: 'editing',   question_id: 'QC2' });
    seedSession.insert('circles_sessions', { user_id: 'user-A', lifecycle: 'gated',     question_id: 'QC3' });
    seedSession.insert('circles_sessions', { user_id: 'user-A', lifecycle: 'completed', question_id: 'QC4' });
  });

  test('default GET returns ZERO created rows (SLC-AC11)', async () => {
    const res = await request(app)
      .get('/api/circles-sessions')
      .set('Authorization', 'Bearer user-A');
    expect(res.status).toBe(200);
    const lifecycles = res.body.map((r) => r.lifecycle).sort();
    expect(lifecycles).toEqual(['completed', 'editing', 'gated']);
  });

  test('GET /:id still returns a created row (SLC-AC12)', async () => {
    const id = seedSession.insert('circles_sessions', { user_id: 'user-A', lifecycle: 'created', question_id: 'QC5' });
    const res = await request(app)
      .get(`/api/circles-sessions/${id}`)
      .set('Authorization', 'Bearer user-A');
    expect(res.status).toBe(200);
    expect(res.body.lifecycle).toBe('created');
  });

  test('?include_empty=true as non-operator → 403 (SLC-AC13)', async () => {
    const res = await request(app)
      .get('/api/circles-sessions?include_empty=true')
      .set('Authorization', 'Bearer user-A');
    expect(res.status).toBe(403);
  });

  test('?include_empty=true as operator → returns all (SLC-AC14)', async () => {
    // Operator's own sessions (include one 'created' row that should appear)
    seedSession.insert('circles_sessions', { user_id: 'op@first-principle.test', lifecycle: 'created',   question_id: 'OP1' });
    seedSession.insert('circles_sessions', { user_id: 'op@first-principle.test', lifecycle: 'editing',   question_id: 'OP2' });
    seedSession.insert('circles_sessions', { user_id: 'op@first-principle.test', lifecycle: 'gated',     question_id: 'OP3' });
    seedSession.insert('circles_sessions', { user_id: 'op@first-principle.test', lifecycle: 'completed', question_id: 'OP4' });
    const res = await request(app)
      .get('/api/circles-sessions?include_empty=true')
      .set('Authorization', 'Bearer op@first-principle.test');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  test('OPERATOR_EMAIL unset → flag fails closed (defense-in-depth)', async () => {
    const saved = process.env.OPERATOR_EMAIL;
    delete process.env.OPERATOR_EMAIL;
    try {
      const res = await request(app)
        .get('/api/circles-sessions?include_empty=true')
        .set('Authorization', 'Bearer op@first-principle.test');
      expect(res.status).toBe(403);
    } finally {
      process.env.OPERATOR_EMAIL = saved;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated NSM — /api/nsm-sessions
// ─────────────────────────────────────────────────────────────────────────────

describe('list filter — nsm-sessions (auth)', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
    process.env.OPERATOR_EMAIL = 'op@first-principle.test';
  });

  beforeEach(() => {
    seedSession.reset();
    // Use distinct question_ids to prevent dedupSessions collapsing them to 1 row
    seedSession.insert('nsm_sessions', { user_id: 'user-B', lifecycle: 'created',   question_id: 'QN1' });
    seedSession.insert('nsm_sessions', { user_id: 'user-B', lifecycle: 'editing',   question_id: 'QN2' });
    seedSession.insert('nsm_sessions', { user_id: 'user-B', lifecycle: 'completed', question_id: 'QN3' });
  });

  test('default GET returns ZERO created rows (SLC-AC11/nsm)', async () => {
    const res = await request(app)
      .get('/api/nsm-sessions')
      .set('Authorization', 'Bearer user-B');
    expect(res.status).toBe(200);
    const lifecycles = res.body.map((r) => r.lifecycle).sort();
    expect(lifecycles).toEqual(['completed', 'editing']);
  });

  test('GET /:id still returns a created row (SLC-AC12/nsm)', async () => {
    const id = seedSession.insert('nsm_sessions', { user_id: 'user-B', lifecycle: 'created' });
    const res = await request(app)
      .get(`/api/nsm-sessions/${id}`)
      .set('Authorization', 'Bearer user-B');
    expect(res.status).toBe(200);
    expect(res.body.lifecycle).toBe('created');
  });

  test('?include_empty=true as non-operator → 403 (SLC-AC13/nsm)', async () => {
    const res = await request(app)
      .get('/api/nsm-sessions?include_empty=true')
      .set('Authorization', 'Bearer user-B');
    expect(res.status).toBe(403);
  });

  test('?include_empty=true as operator → returns all (SLC-AC14/nsm)', async () => {
    // Operator's own NSM sessions (include one 'created' row that should appear)
    seedSession.insert('nsm_sessions', { user_id: 'op@first-principle.test', lifecycle: 'created',   question_id: 'ON1' });
    seedSession.insert('nsm_sessions', { user_id: 'op@first-principle.test', lifecycle: 'editing',   question_id: 'ON2' });
    seedSession.insert('nsm_sessions', { user_id: 'op@first-principle.test', lifecycle: 'completed', question_id: 'ON3' });
    const res = await request(app)
      .get('/api/nsm-sessions?include_empty=true')
      .set('Authorization', 'Bearer op@first-principle.test');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Guest CIRCLES — /api/guest-circles-sessions
// Guest endpoints have no user.email → always 403 for include_empty=true
// ─────────────────────────────────────────────────────────────────────────────

describe('list filter — guest-circles-sessions', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
    process.env.OPERATOR_EMAIL = 'op@first-principle.test';
  });

  beforeEach(() => {
    seedSession.reset();
    // Use distinct question_ids to prevent dedupSessions collapsing them to 1 row
    seedSession.insert('circles_sessions', { guest_id: GUEST_UUID, lifecycle: 'created',   question_id: 'GC1' });
    seedSession.insert('circles_sessions', { guest_id: GUEST_UUID, lifecycle: 'editing',   question_id: 'GC2' });
    seedSession.insert('circles_sessions', { guest_id: GUEST_UUID, lifecycle: 'completed', question_id: 'GC3' });
  });

  test('default GET excludes created rows (SLC-AC11/guest-circles)', async () => {
    const res = await request(app)
      .get('/api/guest-circles-sessions')
      .set('x-guest-id', GUEST_UUID);
    expect(res.status).toBe(200);
    const lifecycles = res.body.map((r) => r.lifecycle).sort();
    expect(lifecycles).toEqual(['completed', 'editing']);
  });

  test('?include_empty=true from guest → 403 (no user.email)', async () => {
    const res = await request(app)
      .get('/api/guest-circles-sessions?include_empty=true')
      .set('x-guest-id', GUEST_UUID);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Guest NSM — /api/guest/nsm-sessions
// ─────────────────────────────────────────────────────────────────────────────

describe('list filter — guest-nsm-sessions', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
    process.env.OPERATOR_EMAIL = 'op@first-principle.test';
  });

  beforeEach(() => {
    seedSession.reset();
    // Use distinct question_ids to prevent dedupSessions collapsing them to 1 row
    seedSession.insert('nsm_sessions', { guest_id: GUEST_UUID, lifecycle: 'created',   question_id: 'GN1' });
    seedSession.insert('nsm_sessions', { guest_id: GUEST_UUID, lifecycle: 'editing',   question_id: 'GN2' });
    seedSession.insert('nsm_sessions', { guest_id: GUEST_UUID, lifecycle: 'completed', question_id: 'GN3' });
  });

  test('default GET excludes created rows (SLC-AC11/guest-nsm)', async () => {
    const res = await request(app)
      .get('/api/guest/nsm-sessions')
      .set('x-guest-id', GUEST_UUID);
    expect(res.status).toBe(200);
    const lifecycles = res.body.map((r) => r.lifecycle).sort();
    expect(lifecycles).toEqual(['completed', 'editing']);
  });

  test('?include_empty=true from guest → 403 (no user.email)', async () => {
    const res = await request(app)
      .get('/api/guest/nsm-sessions?include_empty=true')
      .set('x-guest-id', GUEST_UUID);
    expect(res.status).toBe(403);
  });
});
