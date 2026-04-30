// TDD: Tests written BEFORE implementation (RED phase)
// circles-sessions-draft.test.js — POST /draft lazy-create endpoint
// (auth + guest variants)

jest.mock('../db/client', () => {
  const state = { chainResult: { data: null, error: null } };
  const mockFns = {
    from: jest.fn(),
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    auth: { getUser: jest.fn() },
    __state: state,
    then: jest.fn((resolve, reject) => {
      Promise.resolve(state.chainResult).then(resolve, reject);
    }),
  };
  ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit'].forEach(k => {
    mockFns[k].mockReturnValue(mockFns);
  });
  mockFns.single.mockResolvedValue({ data: null, error: null });
  mockFns.maybeSingle.mockResolvedValue({ data: null, error: null });
  return mockFns;
});

jest.mock('../prompts/circles-gate', () => ({ reviewFramework: jest.fn() }));
jest.mock('../prompts/circles-coach', () => ({ streamCirclesReply: jest.fn() }));
jest.mock('../prompts/circles-evaluator', () => ({ evaluateCirclesStep: jest.fn() }));
jest.mock('../prompts/circles-conclusion-check', () => ({ checkConclusion: jest.fn() }));
jest.mock('../prompts/circles-final-report', () => ({ generateFinalReport: jest.fn() }));
jest.mock('../prompts/circles-hint', () => ({ generateCirclesHint: jest.fn() }));
jest.mock('../prompts/circles-example', () => ({ generateCirclesExample: jest.fn() }));

const request = require('supertest');
const express = require('express');
const db = require('../db/client');

const FAKE_USER = { id: 'user-123', email: 'test@example.com' };
const AUTH_HEADER = { Authorization: 'Bearer valid-token' };
const GUEST_HEADER = { 'X-Guest-ID': '11111111-1111-4111-8111-111111111111' };

db.auth.getUser.mockResolvedValue({ data: { user: FAKE_USER }, error: null });

const authRouter = require('../routes/circles-sessions');
const guestRouter = require('../routes/guest-circles-sessions');

const app = express();
app.use(express.json());
app.use('/api/circles-sessions', authRouter);
app.use('/api/guest-circles-sessions', guestRouter);

function resetDbChain() {
  ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit'].forEach(m => {
    db[m].mockReset();
    db[m].mockReturnValue(db);
  });
  db.single.mockReset();
  db.single.mockResolvedValue({ data: null, error: null });
  db.maybeSingle.mockReset();
  db.maybeSingle.mockResolvedValue({ data: null, error: null });
  db.then.mockReset();
  db.__state.chainResult = { data: null, error: null };
  db.then.mockImplementation((resolve, reject) => {
    Promise.resolve(db.__state.chainResult).then(resolve, reject);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  db.auth.getUser.mockResolvedValue({ data: { user: FAKE_USER }, error: null });
  resetDbChain();
});

describe('POST /api/circles-sessions/draft (auth)', () => {
  test('returns 400 when question_id is missing', async () => {
    const res = await request(app)
      .post('/api/circles-sessions/draft')
      .set(AUTH_HEADER)
      .send({ mode: 'drill' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
  });

  test('returns 400 when mode is missing', async () => {
    const res = await request(app)
      .post('/api/circles-sessions/draft')
      .set(AUTH_HEADER)
      .send({ question_id: 'q1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
  });

  test('returns 401 when no auth header', async () => {
    const res = await request(app)
      .post('/api/circles-sessions/draft')
      .send({ question_id: 'circles_001', mode: 'drill' });
    expect(res.status).toBe(401);
  });

  test('inserts active session with empty drafts and returns row', async () => {
    const insertedRow = {
      id: 'sess-1',
      user_id: FAKE_USER.id,
      question_id: 'circles_001',
      mode: 'drill',
      drill_step: 'C1',
      sim_step_index: 0,
      current_phase: 1,
      status: 'active',
      step_drafts: {},
      framework_draft: {},
    };
    db.single.mockResolvedValue({ data: insertedRow, error: null });

    const res = await request(app)
      .post('/api/circles-sessions/draft')
      .set(AUTH_HEADER)
      .send({ question_id: 'circles_001', mode: 'drill', drill_step: 'C1' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('sess-1');
    expect(res.body.status).toBe('active');
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: FAKE_USER.id,
      question_id: 'circles_001',
      mode: 'drill',
      drill_step: 'C1',
      current_phase: 1,
      status: 'active',
      step_drafts: {},
      framework_draft: {},
    }));
  });

  test('returns 500 when DB insert fails', async () => {
    db.single.mockResolvedValue({ data: null, error: { message: 'db error' } });
    const res = await request(app)
      .post('/api/circles-sessions/draft')
      .set(AUTH_HEADER)
      .send({ question_id: 'circles_001', mode: 'simulation' });
    expect(res.status).toBe(500);
  });
});

describe('POST /api/guest-circles-sessions/draft (guest)', () => {
  test('returns 400 when question_id missing', async () => {
    const res = await request(app)
      .post('/api/guest-circles-sessions/draft')
      .set(GUEST_HEADER)
      .send({ mode: 'drill' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when no guest header', async () => {
    const res = await request(app)
      .post('/api/guest-circles-sessions/draft')
      .send({ question_id: 'circles_001', mode: 'drill' });
    expect(res.status).toBe(400);
  });

  test('inserts active guest session with empty drafts', async () => {
    const insertedRow = {
      id: 'guest-sess-1',
      guest_id: '11111111-1111-4111-8111-111111111111',
      question_id: 'circles_001',
      mode: 'simulation',
      drill_step: null,
      sim_step_index: 0,
      current_phase: 1,
      status: 'active',
      step_drafts: {},
      framework_draft: {},
    };
    db.single.mockResolvedValue({ data: insertedRow, error: null });

    const res = await request(app)
      .post('/api/guest-circles-sessions/draft')
      .set(GUEST_HEADER)
      .send({ question_id: 'circles_001', mode: 'simulation' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('guest-sess-1');
    expect(res.body.status).toBe('active');
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
      guest_id: '11111111-1111-4111-8111-111111111111',
      question_id: 'circles_001',
      mode: 'simulation',
      status: 'active',
      step_drafts: {},
      framework_draft: {},
    }));
  });
});

// ── PATCH /progress accepts step_drafts ──────────────────────────────────────
describe('PATCH /api/circles-sessions/:id/progress accepts step_drafts', () => {
  test('updates step_drafts when stepDrafts provided', async () => {
    const drafts = { C1: { 問題範圍: 'foo' } };
    // Route calls maybeSingle twice: (1) read prior step_drafts, (2) update result.
    db.maybeSingle
      .mockResolvedValueOnce({ data: { step_drafts: {} }, error: null })
      .mockResolvedValueOnce({ data: { id: 'session-abc' }, error: null });
    const res = await request(app)
      .patch('/api/circles-sessions/session-abc/progress')
      .set(AUTH_HEADER)
      .send({ stepDrafts: drafts });

    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ step_drafts: drafts })
    );
  });
});
