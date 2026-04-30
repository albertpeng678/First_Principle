// TDD: Tests written BEFORE implementation (RED phase)
// circles-sessions.test.js — Auth route for CIRCLES training sessions

// ── Mock all external dependencies ──────────────────────────────────────────

jest.mock('../db/client', () => {
  // A shared state bag accessible inside the factory closure.
  // Jest allows object mutation — just not references to outer-scope lets/vars.
  const state = { chainResult: { data: null, error: null } };

  // The db chain object is both chainable (each method returns itself)
  // AND thenable (so `await db.from(...).update(...).eq(...).eq(...)` works).
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
    auth: {
      getUser: jest.fn(),
    },
    // Expose state so tests can modify it from outside the factory
    __state: state,
    // Make the chain object itself thenable so `await chain` resolves
    then: jest.fn((resolve, reject) => {
      const result = state.chainResult;
      Promise.resolve(result).then(resolve, reject);
    }),
  };
  // Each chainable method returns the same object by default
  ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit'].forEach(k => {
    mockFns[k].mockReturnValue(mockFns);
  });
  // single() returns a Promise by default
  mockFns.single.mockResolvedValue({ data: null, error: null });
  // maybeSingle is used by PATCH /:id/progress + draft idempotency. Default
  // returns a row so update paths return 200 (override per-test for null cases).
  mockFns.maybeSingle.mockResolvedValue({ data: { id: 'mock-id' }, error: null });
  return mockFns;
});

jest.mock('../prompts/circles-gate', () => ({
  reviewFramework: jest.fn(),
}));

jest.mock('../prompts/circles-coach', () => ({
  streamCirclesReply: jest.fn(),
}));

jest.mock('../prompts/circles-evaluator', () => ({
  evaluateCirclesStep: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const db = require('../db/client');
const { reviewFramework } = require('../prompts/circles-gate');
const { streamCirclesReply } = require('../prompts/circles-coach');
const { evaluateCirclesStep } = require('../prompts/circles-evaluator');

// Build test app — include the router under test
const app = express();
app.use(express.json());

// We also need requireAuth — mock it to inject req.user automatically
// by intercepting at the db.auth.getUser level
const FAKE_USER = { id: 'user-123', email: 'test@example.com' };
const AUTH_HEADER = { Authorization: 'Bearer valid-token' };

// Before loading the router, set up auth mock to always succeed
db.auth.getUser.mockResolvedValue({ data: { user: FAKE_USER }, error: null });

const router = require('../routes/circles-sessions');
app.use('/api/circles-sessions', router);

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetDbChain() {
  // Reset all chain methods to return the chain again
  ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit'].forEach(m => {
    db[m].mockReset();
    db[m].mockReturnValue(db);
  });
  db.single.mockReset();
  db.single.mockResolvedValue({ data: null, error: null });
  db.maybeSingle.mockReset();
  db.maybeSingle.mockResolvedValue({ data: { id: 'mock-id' }, error: null });
  db.then.mockReset();
  // Reset state and restore the thenable implementation
  db.__state.chainResult = { data: null, error: null };
  db.then.mockImplementation((resolve, reject) => {
    Promise.resolve(db.__state.chainResult).then(resolve, reject);
  });
}

// Set what the chain resolves to when awaited directly (for non-.single() endings)
function setChainResult(result) {
  db.__state.chainResult = result;
}

function makeSession(overrides = {}) {
  return {
    id: 'session-abc',
    user_id: 'user-123',
    question_id: 'q1',
    question_json: { problem_statement: '如何提升留存率？', company: 'TestCo' },
    mode: 'drill',
    drill_step: 'C1',
    framework_draft: {},
    gate_result: null,
    conversation: [],
    step_scores: {},
    current_phase: 1,
    sim_step_index: 0,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Re-apply auth mock after clearAllMocks
  db.auth.getUser.mockResolvedValue({ data: { user: FAKE_USER }, error: null });
  resetDbChain();
});

// ── POST / — create session ───────────────────────────────────────────────────

describe('POST /api/circles-sessions', () => {
  test('returns 400 when questionId is missing', async () => {
    const res = await request(app)
      .post('/api/circles-sessions')
      .set(AUTH_HEADER)
      .send({ questionJson: {}, mode: 'drill' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
  });

  test('returns 400 when questionJson is missing', async () => {
    const res = await request(app)
      .post('/api/circles-sessions')
      .set(AUTH_HEADER)
      .send({ questionId: 'q1', mode: 'drill' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
  });

  test('returns 400 when mode is missing', async () => {
    const res = await request(app)
      .post('/api/circles-sessions')
      .set(AUTH_HEADER)
      .send({ questionId: 'q1', questionJson: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
  });

  test('returns sessionId on success', async () => {
    db.single.mockResolvedValue({ data: { id: 'new-session-id' }, error: null });

    const res = await request(app)
      .post('/api/circles-sessions')
      .set(AUTH_HEADER)
      .send({ questionId: 'q1', questionJson: { problem_statement: 'test' }, mode: 'drill' });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('new-session-id');
  });

  test('passes drillStep as drill_step to DB insert', async () => {
    db.single.mockResolvedValue({ data: { id: 'sid' }, error: null });

    await request(app)
      .post('/api/circles-sessions')
      .set(AUTH_HEADER)
      .send({ questionId: 'q1', questionJson: {}, mode: 'simulation', drillStep: 'I' });

    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({ drill_step: 'I' })
    );
  });

  test('uses null for drill_step when drillStep not provided', async () => {
    db.single.mockResolvedValue({ data: { id: 'sid' }, error: null });

    await request(app)
      .post('/api/circles-sessions')
      .set(AUTH_HEADER)
      .send({ questionId: 'q1', questionJson: {}, mode: 'drill' });

    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({ drill_step: null })
    );
  });

  test('returns 500 when DB insert fails', async () => {
    db.single.mockResolvedValue({ data: null, error: { message: 'db error' } });

    const res = await request(app)
      .post('/api/circles-sessions')
      .set(AUTH_HEADER)
      .send({ questionId: 'q1', questionJson: {}, mode: 'drill' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('db error');
  });

  test('returns 401 when no auth header', async () => {
    const res = await request(app)
      .post('/api/circles-sessions')
      .send({ questionId: 'q1', questionJson: {}, mode: 'drill' });
    expect(res.status).toBe(401);
  });
});

// ── GET / — list sessions ─────────────────────────────────────────────────────

describe('GET /api/circles-sessions', () => {
  test('returns array of sessions for the user', async () => {
    const sessions = [makeSession(), makeSession({ id: 'session-def' })];
    db.limit.mockResolvedValue({ data: sessions, error: null });

    const res = await request(app)
      .get('/api/circles-sessions')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  test('returns empty array when no sessions', async () => {
    db.limit.mockResolvedValue({ data: null, error: null });

    const res = await request(app)
      .get('/api/circles-sessions')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns 500 when DB query fails', async () => {
    db.limit.mockResolvedValue({ data: null, error: { message: 'query failed' } });

    const res = await request(app)
      .get('/api/circles-sessions')
      .set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('query failed');
  });

  test('returns 401 when no auth header', async () => {
    const res = await request(app).get('/api/circles-sessions');
    expect(res.status).toBe(401);
  });
});

// ── GET /:id — get single session ─────────────────────────────────────────────

describe('GET /api/circles-sessions/:id', () => {
  test('returns session data when found', async () => {
    const session = makeSession();
    db.single.mockResolvedValue({ data: session, error: null });

    const res = await request(app)
      .get('/api/circles-sessions/session-abc')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('session-abc');
  });

  test('returns 404 when session not found', async () => {
    db.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } });

    const res = await request(app)
      .get('/api/circles-sessions/nonexistent')
      .set(AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('returns 404 when session belongs to different user', async () => {
    // DB returns no data because eq('user_id', ...) filters it out
    db.single.mockResolvedValue({ data: null, error: null });

    const res = await request(app)
      .get('/api/circles-sessions/someone-elses-session')
      .set(AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('returns 401 when no auth header', async () => {
    const res = await request(app).get('/api/circles-sessions/session-abc');
    expect(res.status).toBe(401);
  });
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────

describe('DELETE /api/circles-sessions/:id', () => {
  test('returns { ok: true } on successful delete', async () => {
    db.single.mockResolvedValue({ data: { id: 'session-abc' }, error: null });

    const res = await request(app)
      .delete('/api/circles-sessions/session-abc')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('returns 404 when session not found', async () => {
    db.single.mockResolvedValue({ data: null, error: null });

    const res = await request(app)
      .delete('/api/circles-sessions/nonexistent')
      .set(AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('returns 500 on non-PGRST116 DB error', async () => {
    db.single.mockResolvedValue({ data: null, error: { code: 'OTHER', message: 'db error' } });

    const res = await request(app)
      .delete('/api/circles-sessions/session-abc')
      .set(AUTH_HEADER);

    expect(res.status).toBe(500);
  });

  test('returns 404 (not 500) when PGRST116 error and no data', async () => {
    db.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } });

    const res = await request(app)
      .delete('/api/circles-sessions/nonexistent')
      .set(AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  test('returns 401 when no auth header', async () => {
    const res = await request(app).delete('/api/circles-sessions/session-abc');
    expect(res.status).toBe(401);
  });
});

// ── POST /:id/gate ────────────────────────────────────────────────────────────

describe('POST /api/circles-sessions/:id/gate', () => {
  test('returns 400 when frameworkDraft is missing', async () => {
    const res = await request(app)
      .post('/api/circles-sessions/session-abc/gate')
      .set(AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('frameworkDraft');
  });

  test('returns 404 when session not found', async () => {
    db.single.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const res = await request(app)
      .post('/api/circles-sessions/nonexistent/gate')
      .set(AUTH_HEADER)
      .send({ frameworkDraft: { C1: 'test' } });

    expect(res.status).toBe(404);
  });

  test('calls reviewFramework with correct params', async () => {
    const session = makeSession({ drill_step: 'C1', mode: 'drill' });
    db.single.mockResolvedValue({ data: session, error: null });
    reviewFramework.mockResolvedValue({ pass: true, feedback: 'Good' });

    await request(app)
      .post('/api/circles-sessions/session-abc/gate')
      .set(AUTH_HEADER)
      .send({ frameworkDraft: { clarify: 'test' } });

    expect(reviewFramework).toHaveBeenCalledWith({
      step: 'C1',
      frameworkDraft: { clarify: 'test' },
      questionJson: session.question_json,
      mode: 'drill',
    });
  });

  test('returns gateResult from reviewFramework', async () => {
    const session = makeSession();
    db.single.mockResolvedValue({ data: session, error: null });
    const gateResult = { pass: true, feedback: 'Excellent' };
    reviewFramework.mockResolvedValue(gateResult);

    const res = await request(app)
      .post('/api/circles-sessions/session-abc/gate')
      .set(AUTH_HEADER)
      .send({ frameworkDraft: { C1: 'content' } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(gateResult);
  });

  test('returns 500 when reviewFramework throws', async () => {
    const session = makeSession();
    db.single.mockResolvedValue({ data: session, error: null });
    reviewFramework.mockRejectedValue(new Error('AI error'));

    const res = await request(app)
      .post('/api/circles-sessions/session-abc/gate')
      .set(AUTH_HEADER)
      .send({ frameworkDraft: { C1: 'content' } });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('AI error');
  });

  test('uses C1 as default step when drill_step is null', async () => {
    const session = makeSession({ drill_step: null });
    db.single.mockResolvedValue({ data: session, error: null });
    reviewFramework.mockResolvedValue({ pass: true });

    await request(app)
      .post('/api/circles-sessions/session-abc/gate')
      .set(AUTH_HEADER)
      .send({ frameworkDraft: {} });

    expect(reviewFramework).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'C1' })
    );
  });
});

// ── POST /:id/message — SSE streaming ────────────────────────────────────────

describe('POST /api/circles-sessions/:id/message', () => {
  test('returns 400 when userMessage is missing', async () => {
    const res = await request(app)
      .post('/api/circles-sessions/session-abc/message')
      .set(AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
    // Route returns snake_case error code 'empty_user_message'.
    expect(res.body.error).toMatch(/user_message|userMessage/);
  });

  test('returns 404 when session not found', async () => {
    db.single.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const res = await request(app)
      .post('/api/circles-sessions/nonexistent/message')
      .set(AUTH_HEADER)
      .send({ userMessage: 'Hello' });

    expect(res.status).toBe(404);
  });

  test('sets SSE headers: Content-Type text/event-stream', async () => {
    const session = makeSession();
    db.single.mockResolvedValue({ data: session, error: null });

    async function* fakeStream() {
      yield '【被訪談者】\n回答\n\n【教練點評】\n點評\n\n【教練提示】\n提示';
    }
    streamCirclesReply.mockReturnValue(fakeStream());

    const res = await request(app)
      .post('/api/circles-sessions/session-abc/message')
      .set(AUTH_HEADER)
      .send({ userMessage: 'test message' });

    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
  });

  test('streams delta chunks as SSE events', async () => {
    const session = makeSession();
    db.single.mockResolvedValue({ data: session, error: null });

    async function* fakeStream() {
      yield '【被訪談者】\n';
      yield '回答內容';
      yield '\n\n【教練點評】\n點評\n\n【教練提示】\n提示';
    }
    streamCirclesReply.mockReturnValue(fakeStream());

    const res = await request(app)
      .post('/api/circles-sessions/session-abc/message')
      .set(AUTH_HEADER)
      .send({ userMessage: 'test' });

    const text = res.text;
    // Should contain delta events
    expect(text).toContain('"delta"');
    // Should contain done event
    expect(text).toContain('"done":true');
  });

  test('sends done event with parsed 3-role turn', async () => {
    const session = makeSession();
    db.single.mockResolvedValue({ data: session, error: null });

    const fullReply = '【被訪談者】\n我是受訪者回答\n\n【教練點評】\n這是點評\n\n【教練提示】\n這是提示';

    async function* fakeStream() {
      yield fullReply;
    }
    streamCirclesReply.mockReturnValue(fakeStream());

    const res = await request(app)
      .post('/api/circles-sessions/session-abc/message')
      .set(AUTH_HEADER)
      .send({ userMessage: '你好' });

    // Parse out the done event from SSE text
    const lines = res.text.split('\n');
    const doneLine = lines.find(l => {
      if (!l.startsWith('data: ')) return false;
      try {
        const obj = JSON.parse(l.slice(6));
        return obj.done === true;
      } catch { return false; }
    });
    expect(doneLine).toBeDefined();
    const doneObj = JSON.parse(doneLine.slice(6));
    expect(doneObj.turn.interviewee).toBe('我是受訪者回答');
    expect(doneObj.turn.coaching).toBe('這是點評');
    expect(doneObj.turn.hint).toBe('這是提示');
    expect(doneObj.turn.userMessage).toBe('你好');
  });

  test('saves parsed turn to DB conversation', async () => {
    const session = makeSession({ conversation: [] });
    db.single.mockResolvedValue({ data: session, error: null });

    async function* fakeStream() {
      yield '【被訪談者】\n受訪答案\n\n【教練點評】\n教練反饋\n\n【教練提示】\n提示內容';
    }
    streamCirclesReply.mockReturnValue(fakeStream());

    await request(app)
      .post('/api/circles-sessions/session-abc/message')
      .set(AUTH_HEADER)
      .send({ userMessage: '問題' });

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.arrayContaining([
          expect.objectContaining({
            userMessage: '問題',
            interviewee: '受訪答案',
            coaching: '教練反饋',
            hint: '提示內容',
          }),
        ]),
      })
    );
  });

  test('returns 401 when no auth header', async () => {
    const res = await request(app)
      .post('/api/circles-sessions/session-abc/message')
      .send({ userMessage: 'test' });
    expect(res.status).toBe(401);
  });
});

// ── POST /:id/evaluate-step ───────────────────────────────────────────────────

describe('POST /api/circles-sessions/:id/evaluate-step', () => {
  test('returns 404 when session not found', async () => {
    db.single.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const res = await request(app)
      .post('/api/circles-sessions/nonexistent/evaluate-step')
      .set(AUTH_HEADER)
      .send({});

    expect(res.status).toBe(404);
  });

  test('calls evaluateCirclesStep with correct params', async () => {
    const session = makeSession({ drill_step: 'I', framework_draft: { user: 'PM' }, conversation: [] });
    db.single.mockResolvedValue({ data: session, error: null });
    evaluateCirclesStep.mockResolvedValue({ totalScore: 80, dimensions: [] });

    await request(app)
      .post('/api/circles-sessions/session-abc/evaluate-step')
      .set(AUTH_HEADER)
      .send({});

    expect(evaluateCirclesStep).toHaveBeenCalledWith({
      step: 'I',
      frameworkDraft: { user: 'PM' },
      conversation: [],
      questionJson: session.question_json,
      mode: 'drill',
    });
  });

  test('returns evaluateCirclesStep result', async () => {
    const session = makeSession();
    db.single.mockResolvedValue({ data: session, error: null });
    const evalResult = { totalScore: 75, highlight: '不錯', improvement: '補充', dimensions: [] };
    evaluateCirclesStep.mockResolvedValue(evalResult);

    const res = await request(app)
      .post('/api/circles-sessions/session-abc/evaluate-step')
      .set(AUTH_HEADER)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.totalScore).toBe(75);
  });

  test('sets status to completed for drill mode', async () => {
    const session = makeSession({ mode: 'drill', drill_step: 'C1', sim_step_index: 0 });
    db.single.mockResolvedValue({ data: session, error: null });
    evaluateCirclesStep.mockResolvedValue({ totalScore: 80 });

    await request(app)
      .post('/api/circles-sessions/session-abc/evaluate-step')
      .set(AUTH_HEADER)
      .send({});

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  test('sets status to completed for simulation mode at last step (sim_step_index 6)', async () => {
    // Route security model (B4-1) derives completion from the post-merge
    // step_scores having all 7 entries — NOT from client-controlled
    // sim_step_index. So pre-populate 6 prior step_scores and let this eval
    // fill the 7th (drill_step 'S').
    const session = makeSession({
      mode: 'simulation',
      drill_step: 'S',
      sim_step_index: 6,
      step_scores: { C1: {}, I: {}, R: {}, C2: {}, L: {}, E: {} },
    });
    db.single.mockResolvedValue({ data: session, error: null });
    evaluateCirclesStep.mockResolvedValue({ totalScore: 90 });

    await request(app)
      .post('/api/circles-sessions/session-abc/evaluate-step')
      .set(AUTH_HEADER)
      .send({});

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  test('sets status to active for simulation mode at non-last step', async () => {
    const session = makeSession({ mode: 'simulation', sim_step_index: 3 });
    db.single.mockResolvedValue({ data: session, error: null });
    evaluateCirclesStep.mockResolvedValue({ totalScore: 85 });

    await request(app)
      .post('/api/circles-sessions/session-abc/evaluate-step')
      .set(AUTH_HEADER)
      .send({});

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
  });

  test('saves step score under drill_step key', async () => {
    const session = makeSession({ drill_step: 'C1', step_scores: {} });
    db.single.mockResolvedValue({ data: session, error: null });
    const evalResult = { totalScore: 80 };
    evaluateCirclesStep.mockResolvedValue(evalResult);

    await request(app)
      .post('/api/circles-sessions/session-abc/evaluate-step')
      .set(AUTH_HEADER)
      .send({});

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        step_scores: { C1: evalResult },
      })
    );
  });

  test('returns 500 when evaluateCirclesStep throws', async () => {
    const session = makeSession();
    db.single.mockResolvedValue({ data: session, error: null });
    evaluateCirclesStep.mockRejectedValue(new Error('eval error'));

    const res = await request(app)
      .post('/api/circles-sessions/session-abc/evaluate-step')
      .set(AUTH_HEADER)
      .send({});

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('eval error');
  });

  test('returns 401 when no auth header', async () => {
    const res = await request(app)
      .post('/api/circles-sessions/session-abc/evaluate-step')
      .send({});
    expect(res.status).toBe(401);
  });
});

// ── PATCH /:id/progress ───────────────────────────────────────────────────────

describe('PATCH /api/circles-sessions/:id/progress', () => {
  test('returns 400 when no fields provided', async () => {
    const res = await request(app)
      .patch('/api/circles-sessions/session-abc/progress')
      .set(AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('nothing_to_update');
  });

  test('updates currentPhase when provided', async () => {
    const res = await request(app)
      .patch('/api/circles-sessions/session-abc/progress')
      .set(AUTH_HEADER)
      .send({ currentPhase: 2 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ current_phase: 2 })
    );
  });

  test('updates simStepIndex when provided', async () => {
    await request(app)
      .patch('/api/circles-sessions/session-abc/progress')
      .set(AUTH_HEADER)
      .send({ simStepIndex: 3 });

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ sim_step_index: 3 })
    );
  });

  test('updates frameworkDraft when provided', async () => {
    const draft = { C1: 'some text' };
    await request(app)
      .patch('/api/circles-sessions/session-abc/progress')
      .set(AUTH_HEADER)
      .send({ frameworkDraft: draft });

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ framework_draft: draft })
    );
  });

  test('updates gateResult when provided', async () => {
    const gateResult = { pass: false, feedback: 'needs work' };
    await request(app)
      .patch('/api/circles-sessions/session-abc/progress')
      .set(AUTH_HEADER)
      .send({ gateResult });

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ gate_result: gateResult })
    );
  });

  test('can update multiple fields at once', async () => {
    await request(app)
      .patch('/api/circles-sessions/session-abc/progress')
      .set(AUTH_HEADER)
      .send({ currentPhase: 2, simStepIndex: 1, frameworkDraft: { I: 'users' } });

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        current_phase: 2,
        sim_step_index: 1,
        framework_draft: { I: 'users' },
      })
    );
  });

  test('does not include undefined fields in patch', async () => {
    await request(app)
      .patch('/api/circles-sessions/session-abc/progress')
      .set(AUTH_HEADER)
      .send({ currentPhase: 1 });

    const updateArg = db.update.mock.calls[0][0];
    expect(Object.keys(updateArg)).not.toContain('sim_step_index');
    expect(Object.keys(updateArg)).not.toContain('framework_draft');
    expect(Object.keys(updateArg)).not.toContain('gate_result');
  });

  test('returns 500 when DB update fails', async () => {
    // Route ends with `.maybeSingle()` — override that specifically.
    db.maybeSingle.mockResolvedValue({ data: null, error: { message: 'update failed' } });

    const res = await request(app)
      .patch('/api/circles-sessions/session-abc/progress')
      .set(AUTH_HEADER)
      .send({ currentPhase: 2 });

    expect(res.status).toBe(500);
  });

  test('returns 401 when no auth header', async () => {
    const res = await request(app)
      .patch('/api/circles-sessions/session-abc/progress')
      .send({ currentPhase: 1 });
    expect(res.status).toBe(401);
  });
});
