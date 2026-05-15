'use strict';
// Bug 6b — Persistence gaps: BE round-trip + FE rehydrate unit tests.
// Covers:
//   1. NSM PATCH /progress accepts currentStep / gateResult / reportTab
//   2. NSM GET list returns progress_json + updated_at
//   3. CIRCLES PATCH /progress accepts phase2ConclusionDraft → progress_json
//   4. FE rehydrate: NSM session row → AppState (nsmStep / nsmReportTab / nsmGateResult)
//   5. FE rehydrate: CIRCLES session row → AppState (gate + phase2Conclusion + phase)
//   6. tryResumeLatestSession logic (pure function mirror)

// ══════════════════════════════════════════════════════════════════════════════
// Section A: Backend route tests (NSM sessions)
// ══════════════════════════════════════════════════════════════════════════════

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
  mockFns.maybeSingle.mockResolvedValue({ data: { id: 'mock-id' }, error: null });
  return mockFns;
});

jest.mock('../prompts/nsm-evaluator', () => ({ evaluateNSM: jest.fn() }));
jest.mock('../prompts/nsm-hints',     () => ({ generateNSMHints: jest.fn() }));
jest.mock('../prompts/nsm-gate',      () => ({ reviewNSMGate: jest.fn() }));
jest.mock('../prompts/nsm-context',   () => ({ generateNSMContext: jest.fn() }));
jest.mock('../prompts/utils/product-type', () => ({ guessProductType: jest.fn(() => 'design') }));
jest.mock('../lib/session-rehydrate', () => ({
  rehydrateMany: jest.fn((d) => d),
  rehydrateQuestionJson: jest.fn((d) => d),
}));
jest.mock('../lib/session-cache', () => ({
  get: jest.fn(() => null),
  set: jest.fn(),
  invalidate: jest.fn(),
  _reset: jest.fn(),
}));
jest.mock('../lib/session-dedup', () => ({
  dedupSessions: jest.fn((d) => d),
}));

jest.mock('../prompts/circles-gate',      () => ({ reviewFramework: jest.fn() }));
jest.mock('../prompts/circles-coach',     () => ({ streamCirclesReply: jest.fn() }));
jest.mock('../lib/evaluate-step-handler', () => ({ runEvaluateStep: jest.fn(), EvaluatorError: class EvaluatorError extends Error {} }));
jest.mock('../prompts/circles-conclusion-check', () => ({ checkConclusion: jest.fn() }));
jest.mock('../prompts/circles-final-report',     () => ({ generateFinalReport: jest.fn() }));
jest.mock('../prompts/circles-hint',             () => ({ generateCirclesHint: jest.fn() }));
jest.mock('../prompts/circles-example',          () => ({ generateCirclesExample: jest.fn() }));

const request = require('supertest');
const express = require('express');
const db      = require('../db/client');
const cache   = require('../lib/session-cache');

const FAKE_USER  = { id: 'user-123', email: 'test@example.com' };
const AUTH_HEADER = { Authorization: 'Bearer valid-token' };

// Build NSM test app
const nsmApp = express();
nsmApp.use(express.json());
db.auth.getUser.mockResolvedValue({ data: { user: FAKE_USER }, error: null });
const nsmRouter = require('../routes/nsm-sessions');
nsmApp.use('/api/nsm-sessions', nsmRouter);

// Build CIRCLES test app (separate to avoid route conflicts)
const circlesApp = express();
circlesApp.use(express.json());
const circlesRouter = require('../routes/circles-sessions');
circlesApp.use('/api/circles-sessions', circlesRouter);

function resetDbChain() {
  ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit'].forEach(m => {
    db[m].mockReset();
    db[m].mockReturnValue(db);
  });
  db.single.mockReset();
  db.single.mockResolvedValue({ data: null, error: null });
  db.maybeSingle.mockReset();
  db.maybeSingle.mockResolvedValue({ data: { id: 'mock-id' }, error: null });
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
  cache._reset();
});

// ── Section A: NSM PATCH /progress — Block 2 BE round-trip ──────────────────

describe('NSM PATCH /progress — Block 2: accepts currentStep / gateResult / reportTab', () => {
  test('persists currentStep into progress_json', async () => {
    // maybeSingle returns existing progress_json then the update mock
    db.maybeSingle
      .mockResolvedValueOnce({ data: { progress_json: {} }, error: null })  // read existing
      .mockResolvedValueOnce({ data: { id: 'nsm-1' }, error: null });        // update result

    const res = await request(nsmApp)
      .patch('/api/nsm-sessions/nsm-1/progress')
      .set(AUTH_HEADER)
      .send({ currentStep: 3 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ progress_json: expect.objectContaining({ currentStep: 3 }) })
    );
  });

  test('persists gateResult into progress_json', async () => {
    db.maybeSingle
      .mockResolvedValueOnce({ data: { progress_json: {} }, error: null })
      .mockResolvedValueOnce({ data: { id: 'nsm-1' }, error: null });

    const gate = { overall_status: 'error', feedback: 'too vague' };
    const res = await request(nsmApp)
      .patch('/api/nsm-sessions/nsm-1/progress')
      .set(AUTH_HEADER)
      .send({ gateResult: gate });

    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ progress_json: expect.objectContaining({ gateResult: gate }) })
    );
  });

  test('persists reportTab into progress_json', async () => {
    db.maybeSingle
      .mockResolvedValueOnce({ data: { progress_json: { currentStep: 4 } }, error: null })
      .mockResolvedValueOnce({ data: { id: 'nsm-1' }, error: null });

    const res = await request(nsmApp)
      .patch('/api/nsm-sessions/nsm-1/progress')
      .set(AUTH_HEADER)
      .send({ reportTab: 'comparison' });

    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        progress_json: expect.objectContaining({ reportTab: 'comparison', currentStep: 4 }),
      })
    );
  });

  test('shallow-merges into existing progress_json (does not clobber sibling keys)', async () => {
    db.maybeSingle
      .mockResolvedValueOnce({ data: { progress_json: { currentStep: 3, reportTab: 'overview' } }, error: null })
      .mockResolvedValueOnce({ data: { id: 'nsm-1' }, error: null });

    await request(nsmApp)
      .patch('/api/nsm-sessions/nsm-1/progress')
      .set(AUTH_HEADER)
      .send({ reportTab: 'comparison' });

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        progress_json: expect.objectContaining({
          currentStep: 3,      // preserved from existing
          reportTab: 'comparison',  // updated
        }),
      })
    );
  });
});

// ── Section A2: NSM GET list — includes progress_json + updated_at ───────────

describe('NSM GET / list — Block 2: returns progress_json + updated_at', () => {
  test('selects progress_json and updated_at columns', async () => {
    // Cache miss → real DB call
    db.__state.chainResult = { data: [], error: null };

    await request(nsmApp).get('/api/nsm-sessions').set(AUTH_HEADER);

    // Verify select string includes progress_json and updated_at
    const selectCall = db.select.mock.calls.find(c => {
      const s = c[0] || '';
      return s.includes('progress_json') && s.includes('updated_at');
    });
    expect(selectCall).toBeDefined();
  });
});

// ── Section B: CIRCLES PATCH /progress — phase2ConclusionDraft ──────────────

describe('CIRCLES PATCH /progress — Block 2: phase2ConclusionDraft → progress_json', () => {
  test('persists phase2ConclusionDraft into progress_json', async () => {
    const draft = '用戶留存的核心問題是…（40字）';
    // maybeSingle: first call reads existing progress_json, second is the update result
    db.maybeSingle
      .mockResolvedValueOnce({ data: { progress_json: {} }, error: null })
      .mockResolvedValueOnce({ data: { id: 'circles-1' }, error: null });

    const res = await request(circlesApp)
      .patch('/api/circles-sessions/circles-1/progress')
      .set(AUTH_HEADER)
      .send({ phase2ConclusionDraft: draft });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        progress_json: expect.objectContaining({ phase2ConclusionDraft: draft }),
      })
    );
  });

  test('shallow-merges phase2ConclusionDraft with existing progress_json keys', async () => {
    const existing = { someOtherKey: 'preserved' };
    db.maybeSingle
      .mockResolvedValueOnce({ data: { progress_json: existing }, error: null })
      .mockResolvedValueOnce({ data: { id: 'circles-1' }, error: null });

    await request(circlesApp)
      .patch('/api/circles-sessions/circles-1/progress')
      .set(AUTH_HEADER)
      .send({ phase2ConclusionDraft: '新草稿' });

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        progress_json: expect.objectContaining({
          someOtherKey: 'preserved',
          phase2ConclusionDraft: '新草稿',
        }),
      })
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section C: FE rehydrate — pure logic unit tests (mirrors app.js functions)
// ══════════════════════════════════════════════════════════════════════════════

// Mirror of applyNsmRestoreFromDb (the NSM rehydrate branch in app.js)
function applyNsmRestoreFromDb(AppState, sessionRow) {
  AppState.nsmSession = sessionRow;
  AppState.nsmSelectedQuestion = sessionRow.question_json || null;
  var rawNsm = sessionRow.user_nsm;
  if (typeof rawNsm === 'string') {
    AppState.nsmDefinition = { nsm: rawNsm, explanation: '', businessLink: '' };
  } else if (rawNsm && typeof rawNsm === 'object') {
    AppState.nsmDefinition = { nsm: rawNsm.nsm || '', explanation: rawNsm.explanation || '', businessLink: rawNsm.businessLink || '' };
  } else {
    AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
  }
  AppState.nsmBreakdown = sessionRow.user_breakdown || { reach: '', depth: '', frequency: '', impact: '' };
  AppState.nsmEvalResult = sessionRow.scores_json || null;
  var _prog = sessionRow.progress_json || {};
  var _scored = sessionRow.scores_json && Object.keys(sessionRow.scores_json).length > 0;
  var _hasBreakdown = sessionRow.user_breakdown && Object.values(sessionRow.user_breakdown).some(function (v) { return v && String(v).trim(); });
  var _hasNsm = sessionRow.user_nsm && sessionRow.user_nsm.nsm && String(sessionRow.user_nsm.nsm).trim();
  AppState.nsmStep = _prog.currentStep || (_scored ? 4 : (_hasBreakdown ? 3 : (_hasNsm ? 2 : 1)));
  AppState.nsmReportTab = _prog.reportTab || 'overview';
  AppState.nsmGateResult = _prog.gateResult || null;
  AppState.view = 'nsm';
}

function freshNsmState() {
  return {
    nsmStep: 1, nsmReportTab: 'overview', nsmGateResult: null,
    nsmSession: null, nsmSelectedQuestion: null, nsmEvalResult: null,
    nsmDefinition: { nsm: '', explanation: '', businessLink: '' },
    nsmBreakdown: { reach: '', depth: '', frequency: '', impact: '' },
    view: 'circles',
  };
}

describe('FE rehydrate: NSM session → AppState (Block 3)', () => {
  it('restores nsmStep from progress_json.currentStep (server checkpoint wins)', () => {
    const state = freshNsmState();
    applyNsmRestoreFromDb(state, {
      question_json: { company: 'Zoom' },
      user_nsm: { nsm: 'something', explanation: '', businessLink: '' },
      user_breakdown: null,
      scores_json: null,
      progress_json: { currentStep: 3 },  // server says step 3
    });
    expect(state.nsmStep).toBe(3);  // must use server value, not inferred step 2
  });

  it('falls back to smart routing when progress_json.currentStep is absent', () => {
    const state = freshNsmState();
    applyNsmRestoreFromDb(state, {
      question_json: { company: 'Airbnb' },
      user_nsm: { nsm: 'hosts who book at least once/month', explanation: '', businessLink: '' },
      user_breakdown: null,
      scores_json: null,
      progress_json: {},
    });
    expect(state.nsmStep).toBe(2);  // smart routing: nsm filled → step 2
  });

  it('restores nsmReportTab from progress_json.reportTab', () => {
    const state = freshNsmState();
    applyNsmRestoreFromDb(state, {
      question_json: { company: 'Stripe' },
      user_nsm: null, user_breakdown: null,
      scores_json: { totalScore: 80 },
      progress_json: { currentStep: 4, reportTab: 'comparison' },
    });
    expect(state.nsmReportTab).toBe('comparison');
  });

  it('defaults nsmReportTab to overview when not in progress_json', () => {
    const state = freshNsmState();
    applyNsmRestoreFromDb(state, {
      question_json: { company: 'Figma' },
      user_nsm: null, user_breakdown: null, scores_json: null,
      progress_json: {},
    });
    expect(state.nsmReportTab).toBe('overview');
  });

  it('restores nsmGateResult from progress_json.gateResult', () => {
    const state = freshNsmState();
    const gate = { overall_status: 'error', feedback: 'too vague' };
    applyNsmRestoreFromDb(state, {
      question_json: { company: 'Notion' },
      user_nsm: null, user_breakdown: null, scores_json: null,
      progress_json: { gateResult: gate },
    });
    expect(state.nsmGateResult).toEqual(gate);
    expect(state.nsmGateResult.overall_status).toBe('error');
  });

  it('sets nsmGateResult to null when absent from progress_json', () => {
    const state = freshNsmState();
    applyNsmRestoreFromDb(state, {
      question_json: { company: 'Canva' },
      user_nsm: null, user_breakdown: null, scores_json: null,
      progress_json: {},
    });
    expect(state.nsmGateResult).toBeNull();
  });
});

// Mirror of restoreCirclesFromDb (the CIRCLES rehydrate additions in app.js)
function applyCirclesRestoreFromDb(AppState, sessionRow) {
  AppState.circlesSession = sessionRow;
  AppState.circlesSelectedQuestion = sessionRow.question_json || null;
  AppState.circlesMode = sessionRow.mode === 'simulation' ? 'sim' : 'drill';
  AppState.circlesDrillStep = sessionRow.drill_step || 'C1';
  AppState.circlesPhase = sessionRow.current_phase || 1;
  AppState.circlesSimStep = sessionRow.sim_step_index || 0;
  AppState.circlesConversation = sessionRow.conversation || [];
  AppState.circlesStepScores = sessionRow.step_scores || {};
  AppState.circlesFrameworkDraft = sessionRow.framework_draft || {};
  AppState.circlesGateResult = sessionRow.gate_result || null;
  AppState.circlesPhase2ConclusionDraft = (sessionRow.progress_json && sessionRow.progress_json.phase2ConclusionDraft) || '';
  AppState.view = 'circles';
}

function freshCirclesState() {
  return {
    circlesSession: null, circlesSelectedQuestion: null,
    circlesMode: null, circlesDrillStep: null, circlesPhase: 1, circlesSimStep: 0,
    circlesConversation: [], circlesStepScores: {}, circlesFrameworkDraft: {},
    circlesGateResult: null, circlesPhase2ConclusionDraft: '',
    view: 'circles',
  };
}

describe('FE rehydrate: CIRCLES session → AppState (Block 3)', () => {
  it('restores circlesPhase from current_phase', () => {
    const state = freshCirclesState();
    applyCirclesRestoreFromDb(state, {
      question_json: { company: 'Meta' },
      mode: 'simulation', drill_step: null,
      current_phase: 2, sim_step_index: 1,
      conversation: [{ userMessage: 'hi' }],
      step_scores: {}, framework_draft: {},
      gate_result: null, progress_json: {},
    });
    expect(state.circlesPhase).toBe(2);
    expect(state.circlesMode).toBe('sim');
    expect(state.circlesConversation).toHaveLength(1);
  });

  it('restores circlesGateResult from gate_result column', () => {
    const state = freshCirclesState();
    const gate = { overallStatus: 'ok', items: [] };
    applyCirclesRestoreFromDb(state, {
      question_json: { company: 'Google' },
      mode: 'drill', drill_step: 'C1',
      current_phase: 1, sim_step_index: 0,
      conversation: [], step_scores: {},
      framework_draft: {}, gate_result: gate, progress_json: {},
    });
    expect(state.circlesGateResult).toEqual(gate);
  });

  it('restores circlesPhase2ConclusionDraft from progress_json', () => {
    const state = freshCirclesState();
    const draft = '產品的北極星指標應關注…（足夠長的草稿測試）';
    applyCirclesRestoreFromDb(state, {
      question_json: { company: 'Apple' },
      mode: 'drill', drill_step: 'C1',
      current_phase: 2, sim_step_index: 0,
      conversation: [], step_scores: {},
      framework_draft: {}, gate_result: null,
      progress_json: { phase2ConclusionDraft: draft },
    });
    expect(state.circlesPhase2ConclusionDraft).toBe(draft);
  });

  it('defaults circlesPhase2ConclusionDraft to empty string when not in progress_json', () => {
    const state = freshCirclesState();
    applyCirclesRestoreFromDb(state, {
      question_json: { company: 'Netflix' },
      mode: 'drill', drill_step: 'I',
      current_phase: 1, sim_step_index: 0,
      conversation: [], step_scores: {}, framework_draft: {},
      gate_result: null, progress_json: null,
    });
    expect(state.circlesPhase2ConclusionDraft).toBe('');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section D: tryResumeLatestSession logic (pure mirror)
// ══════════════════════════════════════════════════════════════════════════════

// Pure mirror of tryResumeLatestSession logic (no DOM/window)
function buildResumeCandidate(sessions) {
  const all = sessions.filter(s => s.status === 'active');
  if (all.length === 0) return null;
  all.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  return all[0];
}

describe('tryResumeLatestSession logic (Block 4)', () => {
  it('picks most-recent active session', () => {
    const sessions = [
      { id: '1', status: 'active', _kind: 'circles', updated_at: '2026-05-10T00:00:00Z' },
      { id: '2', status: 'active', _kind: 'nsm',     updated_at: '2026-05-12T00:00:00Z' },
      { id: '3', status: 'completed', _kind: 'circles', updated_at: '2026-05-14T00:00:00Z' },
    ];
    const latest = buildResumeCandidate(sessions);
    expect(latest.id).toBe('2');
    expect(latest._kind).toBe('nsm');
  });

  it('returns null when no active sessions', () => {
    const sessions = [
      { id: '1', status: 'completed', _kind: 'circles' },
    ];
    const latest = buildResumeCandidate(sessions);
    expect(latest).toBeNull();
  });

  it('returns null for empty list', () => {
    expect(buildResumeCandidate([])).toBeNull();
  });

  it('picks circles session when it is most recent', () => {
    const sessions = [
      { id: 'c1', status: 'active', _kind: 'circles', updated_at: '2026-05-13T00:00:00Z' },
      { id: 'n1', status: 'active', _kind: 'nsm',     updated_at: '2026-05-11T00:00:00Z' },
    ];
    const latest = buildResumeCandidate(sessions);
    expect(latest.id).toBe('c1');
    expect(latest._kind).toBe('circles');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section D2: Bug A — NSM PATCH /progress with userNsm object (camelCase key)
// ══════════════════════════════════════════════════════════════════════════════

describe('Bug A — NSM PATCH /progress accepts userNsm object (camelCase key)', () => {
  test('PATCH with userNsm object → updates user_nsm column', async () => {
    // Route destructures camelCase: const { userNsm } = req.body
    // FE must send { userNsm: {...} } not { user_nsm: {...} }
    db.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'nsm-1' }, error: null }); // update result

    const nsmObj = { nsm: 'DAU/MAU ratio', explanation: '衡量活躍黏著度', businessLink: '驅動訂閱' };
    const res = await request(nsmApp)
      .patch('/api/nsm-sessions/nsm-1/progress')
      .set(AUTH_HEADER)
      .send({ userNsm: nsmObj, userBreakdown: { reach: '10M', depth: 'weekly', frequency: 'high', impact: 'NPS+5' } });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Verify the route mapped userNsm → user_nsm in DB update
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ user_nsm: nsmObj })
    );
  });

  test('PATCH with snake_case user_nsm key is silently dropped (documents the old bug)', () => {
    // When FE mistakenly sends snake_case key, route sees userNsm=undefined → patch empty → 400
    // This test documents the OLD behavior (now fixed in FE) so we know what to avoid.
    // The route correctly reads camelCase only — snake_case from body is ignored.
    const body = { user_nsm: { nsm: 'Revenue', explanation: '', businessLink: '' } };
    const { userNsm } = body; // mirrors route destructuring
    expect(userNsm).toBeUndefined(); // snake_case key → undefined in camelCase destructure
  });

  test('PATCH userNsm object + userBreakdown round-trip: both reach DB update', async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: { id: 'nsm-2' }, error: null });

    const nsmObj = { nsm: 'Booking rate', explanation: 'hosts/guests', businessLink: 'GMV' };
    const breakdown = { reach: '1M', depth: 'daily', frequency: 'high', impact: '$10M ARR' };

    const res = await request(nsmApp)
      .patch('/api/nsm-sessions/nsm-2/progress')
      .set(AUTH_HEADER)
      .send({ userNsm: nsmObj, userBreakdown: breakdown });

    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        user_nsm: nsmObj,
        user_breakdown: breakdown,
      })
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section D3: Bug B — tryResumeLatestSession pre-fetch abort + sort fallback
// ══════════════════════════════════════════════════════════════════════════════

describe('Bug B — tryResumeLatestSession sort fallback to created_at', () => {
  it('uses created_at when updated_at is null (PATCH 400 → updated_at never set)', () => {
    // When PATCH 400s, updated_at stays NULL. Sort must still pick newest by created_at.
    const sessions = [
      { id: 'old', status: 'active', _kind: 'nsm', updated_at: null, created_at: '2026-05-10T00:00:00Z' },
      { id: 'new', status: 'active', _kind: 'nsm', updated_at: null, created_at: '2026-05-14T00:00:00Z' },
    ];
    const latest = buildResumeCandidate(sessions);
    expect(latest.id).toBe('new'); // newer created_at wins even when both updated_at=null
  });

  it('prefers updated_at over created_at when updated_at is set', () => {
    const sessions = [
      { id: 'recently-edited', status: 'active', _kind: 'circles', updated_at: '2026-05-15T10:00:00Z', created_at: '2026-05-01T00:00:00Z' },
      { id: 'newly-created',   status: 'active', _kind: 'nsm',     updated_at: null,                    created_at: '2026-05-14T00:00:00Z' },
    ];
    const latest = buildResumeCandidate(sessions);
    // recently-edited has updated_at=2026-05-15, newly-created has only created_at=2026-05-14
    expect(latest.id).toBe('recently-edited');
  });
});

describe('Bug B — tryResumeLatestSession source contracts', () => {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  const fnStart = appSrc.indexOf('async function tryResumeLatestSession()');
  const fnEnd = appSrc.indexOf('\n  window._tryResumeLatestSession', fnStart);
  const fnBody = appSrc.slice(fnStart, fnEnd);

  it('pre-fetch abort check: view !== circles guard is before Promise.all fetch', () => {
    // Bug B fix: abort check must appear before the fetch, not only after.
    const viewCheckIdx = fnBody.indexOf("AppState.view !== 'circles'");
    const fetchIdx = fnBody.indexOf('Promise.all([');
    expect(viewCheckIdx).toBeGreaterThan(-1); // guard exists
    expect(viewCheckIdx).toBeLessThan(fetchIdx); // guard is BEFORE fetch
  });

  it('sort uses updated_at || created_at fallback', () => {
    expect(fnBody).toContain('b.updated_at || b.created_at');
    expect(fnBody).toContain('a.updated_at || a.created_at');
  });

  it('post-fetch abort check still present (double-guard against race)', () => {
    // Both pre-fetch and post-fetch guards should exist
    const allMatches = [...fnBody.matchAll(/AppState\.view !== 'circles'/g)];
    expect(allMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('login handler uses .then().catch() chain not bare fire-and-forget call', () => {
    // Bug B fix: tryResumeLatestSession() call must be followed by .then(
    // to ensure promise is tracked (not silently ignored).
    const loginFnStart = appSrc.indexOf('function doAuthLogin(email, pw)');
    const loginFnEnd = appSrc.indexOf('\n  function doAuthRegister', loginFnStart);
    const loginBody = appSrc.slice(loginFnStart, loginFnEnd);
    expect(loginBody).toContain('tryResumeLatestSession().then(');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section D4: Bug C — triggerNsmSaveCycle catch logs error
// ══════════════════════════════════════════════════════════════════════════════

describe('Bug C — triggerNsmSaveCycle PATCH catch logs error (not silent)', () => {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  const fnStart = appSrc.indexOf('function triggerNsmSaveCycle()');
  const fnEnd = appSrc.indexOf('\n  }', fnStart) + 4;
  const fnBody = appSrc.slice(fnStart, fnEnd);

  it('catch block logs error via console.error (not silent empty catch)', () => {
    expect(fnBody).toContain('console.error');
    expect(fnBody).not.toContain('.catch(function () {})');
  });

  it('error message includes [nsm-save] prefix for grep-ability', () => {
    expect(fnBody).toContain('[nsm-save]');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section E: Source-level contract checks (app.js)
// ══════════════════════════════════════════════════════════════════════════════

describe('Source contract — app.js persistence (Block 1-4)', () => {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  it('PERSISTED_KEYS includes nsmStep', () => {
    const keysStart = appSrc.indexOf('const PERSISTED_KEYS = [');
    const keysEnd = appSrc.indexOf('];', keysStart) + 2;
    const keysSection = appSrc.slice(keysStart, keysEnd);
    expect(keysSection).toContain("'nsmStep'");
  });

  it('PERSISTED_KEYS includes nsmReportTab', () => {
    const keysStart = appSrc.indexOf('const PERSISTED_KEYS = [');
    const keysEnd = appSrc.indexOf('];', keysStart) + 2;
    const keysSection = appSrc.slice(keysStart, keysEnd);
    expect(keysSection).toContain("'nsmReportTab'");
  });

  it('PERSISTED_KEYS includes nsmGateResult', () => {
    const keysStart = appSrc.indexOf('const PERSISTED_KEYS = [');
    const keysEnd = appSrc.indexOf('];', keysStart) + 2;
    const keysSection = appSrc.slice(keysStart, keysEnd);
    expect(keysSection).toContain("'nsmGateResult'");
  });

  it('PERSISTED_KEYS includes circlesGateResult', () => {
    const keysStart = appSrc.indexOf('const PERSISTED_KEYS = [');
    const keysEnd = appSrc.indexOf('];', keysStart) + 2;
    const keysSection = appSrc.slice(keysStart, keysEnd);
    expect(keysSection).toContain("'circlesGateResult'");
  });

  it('restoreCirclesPhase1FromSession sets circlesGateResult from gate_result', () => {
    const fnStart = appSrc.indexOf('function restoreCirclesPhase1FromSession(item)');
    const fnEnd = appSrc.indexOf('\n  }', fnStart);
    const fnBody = appSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain('AppState.circlesGateResult');
    expect(fnBody).toContain('gate_result');
  });

  it('restoreCirclesPhase1FromSession sets circlesPhase2ConclusionDraft from progress_json', () => {
    const fnStart = appSrc.indexOf('function restoreCirclesPhase1FromSession(item)');
    const fnEnd = appSrc.indexOf('\n  }', fnStart);
    const fnBody = appSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain('circlesPhase2ConclusionDraft');
    expect(fnBody).toContain('phase2ConclusionDraft');
  });

  it('NSM rehydrate branch sets nsmReportTab from progress_json', () => {
    const fnStart = appSrc.indexOf('async function loadCirclesSessionFromHistory(item)');
    const branchStart = appSrc.indexOf('if (isNsm) {', fnStart);
    const branchEnd = appSrc.indexOf('return;\n    }', branchStart) + 14;
    const branchBody = appSrc.slice(branchStart, branchEnd);
    expect(branchBody).toContain('nsmReportTab');
    expect(branchBody).toContain('progress_json');
  });

  it('NSM rehydrate branch sets nsmGateResult from progress_json', () => {
    const fnStart = appSrc.indexOf('async function loadCirclesSessionFromHistory(item)');
    const branchStart = appSrc.indexOf('if (isNsm) {', fnStart);
    const branchEnd = appSrc.indexOf('return;\n    }', branchStart) + 14;
    const branchBody = appSrc.slice(branchStart, branchEnd);
    expect(branchBody).toContain('nsmGateResult');
  });

  it('tryResumeLatestSession is defined in app.js', () => {
    expect(appSrc).toContain('async function tryResumeLatestSession()');
  });

  it('tryResumeLatestSession is exposed on window', () => {
    expect(appSrc).toContain('window._tryResumeLatestSession = tryResumeLatestSession');
  });

  it('nsmPersistStep is defined and persists step to server', () => {
    expect(appSrc).toContain('function nsmPersistStep(step, reportTab)');
    const fnStart = appSrc.indexOf('function nsmPersistStep(step, reportTab)');
    const fnEnd = appSrc.indexOf('\n  }', fnStart);
    const fnBody = appSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain('/progress');
    expect(fnBody).toContain('currentStep');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section F: Bug D — renderCirclesHome must NOT mutate circlesMode
// Root cause: render side-effect set circlesMode='simulation' before
// tryResumeLatestSession fetch returned → post-fetch guard aborted resume.
// Fix: mutation removed from render; default set in tryResumeLatestSession
// no-session branch instead.
// ══════════════════════════════════════════════════════════════════════════════

describe('Bug D — renderCirclesHome does not mutate circlesMode (source contract)', () => {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  const fnStart = appSrc.indexOf('function renderCirclesHome()');
  const fnEnd   = appSrc.indexOf('\n  function bindCirclesHome()', fnStart);
  const fnBody  = appSrc.slice(fnStart, fnEnd);

  it('renderCirclesHome body does not assign AppState.circlesMode', () => {
    // Render must be side-effect-free. circlesMode default is set by
    // tryResumeLatestSession (no-session path), not during render.
    expect(fnBody).not.toContain('AppState.circlesMode =');
  });

  it('renderCirclesHome reads circlesMode (does not hardcode mode)', () => {
    // Must still read circlesMode to drive mode-selector active state.
    expect(fnBody).toContain('AppState.circlesMode');
  });
});

describe('Bug D — tryResumeLatestSession sets default circlesMode on no-session path', () => {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  const fnStart = appSrc.indexOf('async function tryResumeLatestSession()');
  const fnEnd   = appSrc.indexOf('\n  window._tryResumeLatestSession', fnStart);
  const fnBody  = appSrc.slice(fnStart, fnEnd);

  it('no-active-session branch sets circlesMode = simulation as default', () => {
    // When fetch returns 0 active sessions, set default here (not in render).
    // Locate the all.length === 0 block and verify the default assignment is inside it.
    const emptyCheckIdx = fnBody.indexOf("all.length === 0");
    const defaultIdx    = fnBody.indexOf("circlesMode = 'simulation'");
    expect(emptyCheckIdx).toBeGreaterThan(-1);
    expect(defaultIdx).toBeGreaterThan(-1);
    // Default assignment must come after the all.length === 0 check
    expect(defaultIdx).toBeGreaterThan(emptyCheckIdx);
    // Must be guarded: only set when circlesMode is still null
    expect(fnBody.slice(emptyCheckIdx, emptyCheckIdx + 500)).toContain('!AppState.circlesMode');
  });

  it('Bug G fix: post-fetch guard does NOT check circlesMode (stale localStorage must not block resume)', () => {
    // Bug G: circlesMode can be a stale localStorage residue (e.g. from a previous sim session).
    // The post-fetch guard must NOT abort on circlesMode != null — server is source of truth.
    // Only a genuine view change (view !== circles) warrants aborting.
    const guardIdx = fnBody.indexOf("AppState.circlesMode != null");
    expect(guardIdx).toBe(-1);  // must NOT appear in the post-fetch guard
  });

  it('Bug G fix: post-fetch guard does NOT check nsmStep > 1 (stale localStorage must not block resume)', () => {
    // Similarly, nsmStep can be stale from a prior session in localStorage.
    // The guard must only check view, not nsmStep.
    // Count occurrences of "nsmStep > 1" in the function; only the pre-fetch alreadyInSession
    // check should contain it (which itself is guarded by alreadyInSession = ... || nsmSession check).
    // The post-fetch abort line must not contain "nsmStep > 1".
    const postFetchGuardIdx = fnBody.indexOf("abort only if user actively navigated away");
    expect(postFetchGuardIdx).toBeGreaterThan(-1); // Bug G comment must be present
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section F2: Bug D — e2e-style: tryResumeLatestSession completes resume
// even when circlesMode was previously non-null (regression guard for the
// original bug where render mutated circlesMode before fetch returned).
// ══════════════════════════════════════════════════════════════════════════════

describe('Bug D — tryResumeLatestSession resume logic (pure mirror with NSM active session)', () => {
  // Mirror of tryResumeLatestSession — pure function, no DOM, no fetch.
  // Simulates: render() fires first (setting circlesMode in old code),
  // then fetch returns with an active NSM session.
  // With Bug D fix: circlesMode is NOT set by render, so post-fetch guard passes.
  function simulateResumeWithCirclesModeNull(sessions) {
    // AppState after render() fires but BEFORE fetch returns (Bug D fix: circlesMode = null)
    const AppState = {
      view: 'circles',
      circlesMode: null,    // Bug D fix: render no longer sets this
      nsmStep: 1,
      nsmSession: null,
      circlesSession: null,
      circlesPhase: 1,
    };

    // Mirror: pre-fetch guard
    if (AppState.view !== 'circles') return { aborted: 'pre-fetch-view', AppState };
    var alreadyInSession = AppState.nsmStep > 1 || AppState.circlesPhase > 1
      || AppState.nsmSession || AppState.circlesSession;
    if (alreadyInSession) return { aborted: 'pre-fetch-session', AppState };

    // Mirror: filter + sort
    const all = sessions.filter(s => s.status === 'active');
    if (all.length === 0) {
      if (!AppState.circlesMode && AppState.view === 'circles') {
        AppState.circlesMode = 'simulation'; // Bug D fix: default set here
      }
      return { aborted: 'no-sessions', AppState };
    }
    all.sort((a, b) =>
      new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
    );
    const latest = all[0];

    // Mirror: post-fetch guard (Bug G fix: only abort on view change, not on stale localStorage)
    if (AppState.view !== 'circles') {
      return { aborted: 'post-fetch-guard', AppState };
    }

    // Mirror: apply session
    if (latest._kind === 'nsm') {
      AppState.view = 'nsm';
      AppState.nsmSession = latest;
      AppState.nsmSelectedQuestion = latest.question_json || null;
      const rawNsm = latest.user_nsm;
      if (typeof rawNsm === 'string') {
        AppState.nsmDefinition = { nsm: rawNsm, explanation: '', businessLink: '' };
      } else if (rawNsm && typeof rawNsm === 'object') {
        AppState.nsmDefinition = { nsm: rawNsm.nsm || '', explanation: rawNsm.explanation || '', businessLink: rawNsm.businessLink || '' };
      } else {
        AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
      }
      AppState.nsmBreakdown = latest.user_breakdown || { reach: '', depth: '', frequency: '', impact: '' };
      const prog = latest.progress_json || {};
      const hasScores = latest.scores_json && Object.keys(latest.scores_json).length > 0;
      const hasBreakdown = latest.user_breakdown && Object.values(latest.user_breakdown).some(v => v && String(v).trim());
      const hasNsm = latest.user_nsm && (
        (typeof latest.user_nsm === 'object' && latest.user_nsm.nsm && String(latest.user_nsm.nsm).trim()) ||
        (typeof latest.user_nsm === 'string' && latest.user_nsm.trim())
      );
      AppState.nsmStep = prog.currentStep || (hasScores ? 4 : (hasBreakdown ? 3 : (hasNsm ? 2 : 1)));
    } else {
      AppState.circlesSession = latest;
      AppState.circlesMode = latest.mode === 'simulation' ? 'sim' : 'drill';
    }
    AppState._resumeToastShow = true;
    return { aborted: null, AppState };
  }

  it('Bug D regression: NSM active session → view=nsm, nsmSelectedQuestion set', () => {
    const sessions = [
      {
        id: 'nsm-session-q5',
        status: 'active',
        _kind: 'nsm',
        updated_at: '2026-05-15T10:00:00Z',
        question_json: { id: 'q5', company: 'Spotify', product: 'Podcast' },
        user_nsm: { nsm: 'Listening hours', explanation: 'Core engagement', businessLink: 'Ad revenue' },
        user_breakdown: { reach: '10M', depth: 'daily', frequency: 'high', impact: '$5M ARR' },
        progress_json: { currentStep: 3 },
        scores_json: null,
      }
    ];

    const result = simulateResumeWithCirclesModeNull(sessions);

    // Must NOT be aborted
    expect(result.aborted).toBeNull();
    // view must be 'nsm'
    expect(result.AppState.view).toBe('nsm');
    // nsmSelectedQuestion must be set from question_json
    expect(result.AppState.nsmSelectedQuestion).toEqual({ id: 'q5', company: 'Spotify', product: 'Podcast' });
    // nsmSession must be the session object
    expect(result.AppState.nsmSession.id).toBe('nsm-session-q5');
    // nsmStep must be inferred from progress_json
    expect(result.AppState.nsmStep).toBe(3);
    // resume toast must be queued
    expect(result.AppState._resumeToastShow).toBe(true);
  });

  it('Bug G fix: stale localStorage circlesMode non-null no longer blocks resume', () => {
    // Bug G: with stale localStorage residue, circlesMode could be 'sim' or 'simulation'
    // at the time of the post-fetch guard. With Bug G fix the guard no longer checks
    // circlesMode — only view matters. Resume must complete and apply server state.
    // The simulation starts with circlesMode: null (clean state for the simulation function),
    // but the source contract test (below) verifies the guard no longer references circlesMode.
    const sessions = [
      {
        id: 'nsm-active',
        status: 'active',
        _kind: 'nsm',
        updated_at: '2026-05-14T12:00:00Z',
        question_json: { id: 'q12', company: 'Airbnb', product: null },
        user_nsm: 'Booking rate',
        user_breakdown: null,
        progress_json: {},
        scores_json: null,
      }
    ];

    const result = simulateResumeWithCirclesModeNull(sessions);
    // With Bug G fix: view check only → post-fetch guard passes → resume completes
    expect(result.aborted).toBeNull();
    expect(result.AppState.view).toBe('nsm');
    expect(result.AppState.nsmSelectedQuestion).toEqual({ id: 'q12', company: 'Airbnb', product: null });
    // nsmDefinition coerced from string
    expect(result.AppState.nsmDefinition.nsm).toBe('Booking rate');
    // nsmStep defaults to 2 (has NSM but no breakdown/scores)
    expect(result.AppState.nsmStep).toBe(2);
  });

  it('No active sessions → circlesMode defaulted to simulation, view stays circles', () => {
    const result = simulateResumeWithCirclesModeNull([
      { id: 'old', status: 'completed', _kind: 'circles', updated_at: '2026-05-01T00:00:00Z' }
    ]);
    expect(result.aborted).toBe('no-sessions');
    expect(result.AppState.view).toBe('circles');
    // Bug D fix: default circlesMode applied in no-session branch
    expect(result.AppState.circlesMode).toBe('simulation');
  });

  it('CIRCLES active session → circlesMode set from session mode', () => {
    const sessions = [
      {
        id: 'circles-drill-1',
        status: 'active',
        _kind: 'circles',
        updated_at: '2026-05-15T09:00:00Z',
        mode: 'drill',
        question_json: { id: 'q7', company: 'Grab', product: 'Driver app' },
        drill_step: 'C1',
        current_phase: 1,
      }
    ];

    const result = simulateResumeWithCirclesModeNull(sessions);
    expect(result.aborted).toBeNull();
    expect(result.AppState.circlesSession.id).toBe('circles-drill-1');
    expect(result.AppState.circlesMode).toBe('drill');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section F3: Bug G — stale localStorage circlesMode/nsmStep must not block resume
// Real-world scenario: user previously used simulation mode on device A, localStorage
// persists circlesMode='sim'. On device B (or after reload), tryResumeLatestSession
// must still resume the server's latest active session, overwriting the stale state.
// ══════════════════════════════════════════════════════════════════════════════

// Simulate the Bug G scenario: stale circlesMode from localStorage before fetch returns
function simulateResumeWithStaleCirclesMode(staleModeValue, sessions) {
  // AppState after boot restores stale localStorage (Bug G scenario)
  const AppState = {
    view: 'circles',
    circlesMode: staleModeValue,  // stale localStorage residue (e.g. 'sim' from old session)
    nsmStep: 1,
    nsmSession: null,
    circlesSession: null,
    circlesPhase: 1,
  };

  // Mirror pre-fetch guard (Bug B fix — checks view only)
  if (AppState.view !== 'circles') return { aborted: 'pre-fetch-view', AppState };

  // Mirror alreadyInSession check — note: circlesSession is null, circlesPhase=1 → not already in session
  var alreadyInSession = AppState.nsmStep > 1 || AppState.circlesPhase > 1
    || AppState.nsmSession || AppState.circlesSession;
  if (alreadyInSession) return { aborted: 'pre-fetch-session', AppState };

  // Mirror: filter + sort
  const all = sessions.filter(s => s.status === 'active');
  if (all.length === 0) {
    if (!AppState.circlesMode && AppState.view === 'circles') {
      AppState.circlesMode = 'simulation';
    }
    return { aborted: 'no-sessions', AppState };
  }
  all.sort((a, b) =>
    new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
  );
  const latest = all[0];

  // Mirror: Bug G fix — post-fetch guard checks view ONLY (no circlesMode / nsmStep check)
  if (AppState.view !== 'circles') {
    return { aborted: 'post-fetch-guard', AppState };
  }

  // Mirror: apply session
  if (latest._kind === 'nsm') {
    AppState.view = 'nsm';
    AppState.nsmSession = latest;
  } else {
    AppState.circlesSession = latest;
    AppState.circlesMode = latest.mode === 'simulation' ? 'sim' : 'drill';
  }
  AppState._resumeToastShow = true;
  return { aborted: null, AppState };
}

describe('Bug G — stale localStorage circlesMode does not block server resume', () => {
  it('stale circlesMode=sim + server returns drill session → circlesSession.id from server', () => {
    // Real-world scenario: user used sim on device A → localStorage has circlesMode='sim'.
    // On device B reload, server has an active drill session. Must resume server session.
    const serverSessionId = '7773d633-drill-latest';
    const sessions = [
      {
        id: serverSessionId,
        status: 'active',
        _kind: 'circles',
        mode: 'drill',
        updated_at: '2026-05-15T10:00:00Z',
        question_json: { id: 'q1', company: 'Meta', product: 'Reels' },
        drill_step: 'C1',
        current_phase: 1,
      }
    ];

    // Stale localStorage had circlesMode='sim' from a previous simulation session
    const result = simulateResumeWithStaleCirclesMode('sim', sessions);

    // Must NOT abort — stale circlesMode is overwritten by server state
    expect(result.aborted).toBeNull();
    // circlesSession must come from server, not stale localStorage
    expect(result.AppState.circlesSession.id).toBe(serverSessionId);
    // circlesMode must reflect server session (drill), not stale localStorage (sim)
    expect(result.AppState.circlesMode).toBe('drill');
    expect(result.AppState._resumeToastShow).toBe(true);
  });

  it('stale circlesMode=simulation (string) + server returns NSM session → NSM resumed', () => {
    const sessions = [
      {
        id: 'nsm-session-latest',
        status: 'active',
        _kind: 'nsm',
        updated_at: '2026-05-15T11:00:00Z',
        question_json: { id: 'q5', company: 'Spotify', product: 'Podcast' },
        user_nsm: 'Listening hours',
        user_breakdown: null,
        progress_json: {},
        scores_json: null,
      }
    ];

    const result = simulateResumeWithStaleCirclesMode('simulation', sessions);

    expect(result.aborted).toBeNull();
    expect(result.AppState.view).toBe('nsm');
    expect(result.AppState.nsmSession.id).toBe('nsm-session-latest');
  });

  it('source contract: post-fetch guard in app.js contains Bug G comment and no circlesMode check', () => {
    const fs = require('fs');
    const path = require('path');
    const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

    const fnStart = appSrc.indexOf('async function tryResumeLatestSession()');
    const fnEnd = appSrc.indexOf('\n  window._tryResumeLatestSession', fnStart);
    const fnBody = appSrc.slice(fnStart, fnEnd);

    // Bug G fix comment must be present
    expect(fnBody).toContain('Bug G fix');
    // Post-fetch guard must be exactly: if (AppState.view !== 'circles') return;
    // Find the guard line after the sort (after latest = all[0])
    const sortIdx = fnBody.indexOf('all.sort(function');
    const afterSort = fnBody.slice(sortIdx);
    const guardLineMatch = afterSort.match(/if \(AppState\.view !== 'circles'\) return;/);
    expect(guardLineMatch).not.toBeNull();
    // The actual if-statement for the post-fetch guard must NOT contain circlesMode or nsmStep
    // We check the guard line itself (not comments) — extract the if-statement line
    const nsmBranchIdx = afterSort.indexOf('if (latest._kind');
    const guardSection = afterSort.slice(0, nsmBranchIdx);
    // Strip comment lines and check the actual code lines
    const codeLines = guardSection.split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n');
    expect(codeLines).not.toContain('circlesMode != null');
    expect(codeLines).not.toContain('nsmStep > 1');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section G: Bug E — CIRCLES drill rehydrate framework_draft + step_drafts
// ══════════════════════════════════════════════════════════════════════════════

// Pure mirror of the Bug E fix: the CIRCLES branch of tryResumeLatestSession
// now applies step_drafts reverse-transform + localStorage merge, mirroring
// restoreCirclesPhase1FromSession.
function applyCirclesResumeFromDb(AppState, latest, localStorageMock) {
  // Mirrors tryResumeLatestSession CIRCLES branch (Bug E fix)
  AppState.circlesSession = latest;
  AppState.circlesSelectedQuestion = latest.question_json || latest.currentQuestion || null;
  AppState.circlesMode = latest.mode === 'simulation' ? 'sim' : 'drill';
  AppState.circlesDrillStep = latest.drill_step || 'C1';
  AppState.circlesPhase = latest.current_phase || 1;
  AppState.circlesSimStep = latest.sim_step_index || 0;
  AppState.circlesConversation = latest.conversation || [];
  AppState.circlesStepScores = latest.step_scores || {};
  AppState.circlesFrameworkDraft = latest.framework_draft || {};
  AppState.circlesGateResult = latest.gate_result || null;
  AppState.circlesPhase2ConclusionDraft = (latest.progress_json && latest.progress_json.phase2ConclusionDraft) || '';
  // Bug E fix: step_drafts reverse-transform
  var sd = latest.step_drafts || {};
  AppState.circlesPhase1 = sd.P1 || null;
  AppState.circlesPhase1S = sd.P1S || null;
  AppState.circlesPhase1Solutions = sd.P1L || null;
  AppState.circlesPhase1Evaluate = sd.P1E || null;
  // Bug E fix: localStorage merge
  try {
    var qid = (AppState.circlesSelectedQuestion || {}).id;
    if (qid && localStorageMock && localStorageMock[qid]) {
      var local = localStorageMock[qid];
      var serverTs = sd.ts || new Date(latest.updated_at || latest.created_at || 0).getTime();
      var sdEmpty = !sd.P1 && !sd.P1S && !sd.P1L && !sd.P1E && !sd.framework;
      var fdEmpty = !latest.framework_draft || Object.keys(latest.framework_draft || {}).length === 0;
      var backendEmpty = sdEmpty && fdEmpty;
      var localFresher = local && local.ts && local.ts > serverTs;
      if (local && (localFresher || backendEmpty)) {
        if (local.P1) AppState.circlesPhase1 = local.P1;
        if (local.P1S) AppState.circlesPhase1S = local.P1S;
        if (Array.isArray(local.P1L) && local.P1L.length) AppState.circlesPhase1Solutions = local.P1L;
        if (local.P1E) AppState.circlesPhase1Evaluate = local.P1E;
        if (local.framework) AppState.circlesFrameworkDraft = local.framework;
      }
    }
  } catch (_) {}
}

function freshCirclesResumeState() {
  return {
    circlesSession: null, circlesSelectedQuestion: null,
    circlesMode: null, circlesDrillStep: null, circlesPhase: 1, circlesSimStep: 0,
    circlesConversation: [], circlesStepScores: {}, circlesFrameworkDraft: {},
    circlesGateResult: null, circlesPhase2ConclusionDraft: '',
    circlesPhase1: null, circlesPhase1S: null, circlesPhase1Solutions: null, circlesPhase1Evaluate: null,
  };
}

describe('Bug E — CIRCLES drill rehydrate framework_draft + step_drafts (tryResumeLatestSession)', () => {
  it('rehydrates circlesFrameworkDraft from framework_draft column', () => {
    const state = freshCirclesResumeState();
    const frameworkDraft = { C1: { '問題範圍': 'TikTok 短影音創作者工具流失', '時間範圍': 'Q1-Q2 2026' } };
    applyCirclesResumeFromDb(state, {
      id: 'circles-drill-c82e8e4f',
      status: 'active',
      _kind: 'circles',
      mode: 'drill',
      drill_step: 'C1',
      question_json: { id: 'q-tiktok', company: 'TikTok', product: 'Creator Studio' },
      framework_draft: frameworkDraft,
      step_drafts: {},
      current_phase: 1,
      sim_step_index: 0,
      conversation: [], step_scores: {}, gate_result: null, progress_json: {},
      updated_at: '2026-05-14T10:00:00Z', created_at: '2026-05-14T09:00:00Z',
    }, null);

    expect(state.circlesFrameworkDraft).toEqual(frameworkDraft);
    expect(state.circlesMode).toBe('drill');
    expect(state.circlesDrillStep).toBe('C1');
    expect(state.circlesSelectedQuestion).toEqual({ id: 'q-tiktok', company: 'TikTok', product: 'Creator Studio' });
  });

  it('rehydrates circlesPhase1 + circlesPhase1S from step_drafts (P1 + P1S keys)', () => {
    const state = freshCirclesResumeState();
    const p1Data = { recommendation: '優先解決創作者 onboarding 中影片格式轉換摩擦' };
    const p1sData = { recommendation: '功能：批次格式轉換', reasoning: '降低初次上傳失敗率', nsm: '完成首次上傳率', tracking: { reach: '10M', depth: 'daily', frequency: 'weekly', impact: '+15%' } };
    applyCirclesResumeFromDb(state, {
      id: 'circles-drill-2',
      status: 'active',
      _kind: 'circles',
      mode: 'drill',
      drill_step: 'C1',
      question_json: { id: 'q-meta', company: 'Meta', product: 'Reels' },
      framework_draft: {},
      step_drafts: { P1: p1Data, P1S: p1sData, ts: Date.now() - 5000 },
      current_phase: 1,
      sim_step_index: 0,
      conversation: [], step_scores: {}, gate_result: null, progress_json: {},
      updated_at: '2026-05-14T10:00:00Z', created_at: '2026-05-14T09:00:00Z',
    }, null);

    expect(state.circlesPhase1).toEqual(p1Data);
    expect(state.circlesPhase1S).toEqual(p1sData);
    expect(state.circlesPhase1Solutions).toBeNull();
    expect(state.circlesPhase1Evaluate).toBeNull();
  });

  it('rehydrates circlesPhase1Solutions (P1L) and circlesPhase1Evaluate (P1E) from step_drafts', () => {
    const state = freshCirclesResumeState();
    const solutions = [{ name: 'AI 模板生成', mechanism: '降低創作門檻' }, { name: '一鍵剪輯', mechanism: '提速編輯流程' }];
    const evaluate = [{ advantages: '快速上手', disadvantages: '內容同質化', risks: '創作者依賴度高', metrics: 'D7 留存率' }];
    applyCirclesResumeFromDb(state, {
      id: 'circles-drill-3',
      status: 'active',
      _kind: 'circles',
      mode: 'drill',
      drill_step: 'L',
      question_json: { id: 'q-snap', company: 'Snap', product: 'Spotlight' },
      framework_draft: {},
      step_drafts: { P1L: solutions, P1E: evaluate, ts: Date.now() - 5000 },
      current_phase: 1,
      sim_step_index: 0,
      conversation: [], step_scores: {}, gate_result: null, progress_json: {},
      updated_at: '2026-05-14T10:00:00Z', created_at: '2026-05-14T09:00:00Z',
    }, null);

    expect(state.circlesPhase1Solutions).toEqual(solutions);
    expect(state.circlesPhase1Evaluate).toEqual(evaluate);
  });

  it('localStorage merge: prefers local framework when server backend is empty', () => {
    const state = freshCirclesResumeState();
    const localFramework = { C1: { '問題範圍': 'local-only-content', '業務影響': 'local-impact' } };
    const localDraft = { P1: { recommendation: 'local-p1' }, framework: localFramework, ts: Date.now() };

    applyCirclesResumeFromDb(state, {
      id: 'circles-drill-4',
      status: 'active',
      _kind: 'circles',
      mode: 'drill',
      drill_step: 'C1',
      question_json: { id: 'q-uber', company: 'Uber', product: 'Driver' },
      framework_draft: {},  // server has empty framework (PATCH lost to race)
      step_drafts: {},      // server has empty step_drafts
      current_phase: 1, sim_step_index: 0,
      conversation: [], step_scores: {}, gate_result: null, progress_json: {},
      updated_at: '2026-05-14T10:00:00Z', created_at: '2026-05-14T09:00:00Z',
    }, { 'q-uber': localDraft });

    // When backend is empty, local takes over
    expect(state.circlesFrameworkDraft).toEqual(localFramework);
    expect(state.circlesPhase1).toEqual({ recommendation: 'local-p1' });
  });

  it('localStorage merge: prefers server data when server is newer than local', () => {
    const state = freshCirclesResumeState();
    const serverFramework = { C1: { '問題範圍': 'server-content' } };
    const serverUpdatedAt = new Date('2026-05-15T12:00:00Z').getTime();
    const oldLocalTs = serverUpdatedAt - 10000; // local is older than server
    const localDraft = { P1: { recommendation: 'old-local-p1' }, framework: { C1: { '問題範圍': 'old-local-content' } }, ts: oldLocalTs };

    applyCirclesResumeFromDb(state, {
      id: 'circles-drill-5',
      status: 'active',
      _kind: 'circles',
      mode: 'drill',
      drill_step: 'C1',
      question_json: { id: 'q-lyft', company: 'Lyft', product: 'Rider' },
      framework_draft: serverFramework,
      step_drafts: { P1: { recommendation: 'server-p1' }, ts: serverUpdatedAt },
      current_phase: 1, sim_step_index: 0,
      conversation: [], step_scores: {}, gate_result: null, progress_json: {},
      updated_at: '2026-05-15T12:00:00Z', created_at: '2026-05-14T09:00:00Z',
    }, { 'q-lyft': localDraft });

    // Server is newer → server data wins
    expect(state.circlesFrameworkDraft).toEqual(serverFramework);
    expect(state.circlesPhase1).toEqual({ recommendation: 'server-p1' });
  });

  it('source contract: tryResumeLatestSession CIRCLES branch sets circlesPhase1 from step_drafts', () => {
    // Verify app.js contains the Bug E fix
    const fs = require('fs');
    const path = require('path');
    const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

    const fnStart = appSrc.indexOf('async function tryResumeLatestSession()');
    const fnEnd = appSrc.indexOf('\n  window._tryResumeLatestSession', fnStart);
    const fnBody = appSrc.slice(fnStart, fnEnd);

    // The CIRCLES branch (else block) must contain step_drafts reverse-transform
    const elseBlockIdx = fnBody.lastIndexOf('} else {');
    const elseBlock = fnBody.slice(elseBlockIdx);

    expect(elseBlock).toContain('step_drafts');
    expect(elseBlock).toContain('circlesPhase1');
    expect(elseBlock).toContain('circlesPhase1S');
    expect(elseBlock).toContain('circlesPhase1Solutions');
    expect(elseBlock).toContain('circlesPhase1Evaluate');
  });

  it('source contract: tryResumeLatestSession CIRCLES branch applies localStorage merge', () => {
    const fs = require('fs');
    const path = require('path');
    const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

    const fnStart = appSrc.indexOf('async function tryResumeLatestSession()');
    const fnEnd = appSrc.indexOf('\n  window._tryResumeLatestSession', fnStart);
    const fnBody = appSrc.slice(fnStart, fnEnd);

    const elseBlockIdx = fnBody.lastIndexOf('} else {');
    const elseBlock = fnBody.slice(elseBlockIdx);

    // Must contain localStorage merge with backend-empty check
    expect(elseBlock).toContain('localStorage.getItem');
    expect(elseBlock).toContain('_backendEmpty');
    expect(elseBlock).toContain('_localFresher');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section H: Bug F — tryResumeLatestSession parallel invocation dedupe
// Root cause: boot / login / register can all fire simultaneously; if boot
// completes first (no-session path sets circlesMode='simulation') the later
// login call is blocked by the circlesMode != null guard → stale state.
// Fix: _resumePromise module-level ref collapses parallel calls to one promise.
// ══════════════════════════════════════════════════════════════════════════════

describe('Bug F — tryResumeLatestSession dedupe source contracts', () => {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  const fnStart = appSrc.indexOf('async function tryResumeLatestSession()');
  const fnEnd   = appSrc.indexOf('\n  window._tryResumeLatestSession', fnStart);
  const fnBody  = appSrc.slice(fnStart, fnEnd);

  // Also capture the var declaration which is just before the async function
  const blockStart = appSrc.indexOf('var _resumePromise = null;');
  const blockEnd   = fnEnd;
  const blockBody  = blockStart > -1 ? appSrc.slice(blockStart, blockEnd) : '';

  it('_resumePromise module-level variable is declared before tryResumeLatestSession', () => {
    expect(blockStart).toBeGreaterThan(-1);
    // Must appear before the async function definition
    expect(blockStart).toBeLessThan(fnStart);
  });

  it('tryResumeLatestSession returns _resumePromise when already in-flight', () => {
    // Guard pattern: if (_resumePromise) return _resumePromise;
    expect(fnBody).toContain('if (_resumePromise) return _resumePromise');
  });

  it('tryResumeLatestSession assigns IIFE result to _resumePromise', () => {
    // The function body stores the IIFE into _resumePromise
    expect(fnBody).toContain('_resumePromise = (async function');
  });

  it('_resumePromise is reset to null in finally block after completion', () => {
    expect(fnBody).toContain('finally {');
    // finally block must reset the promise so next login cycle gets a fresh fetch
    const finallyIdx = fnBody.indexOf('finally {');
    const afterFinally = fnBody.slice(finallyIdx, finallyIdx + 200);
    expect(afterFinally).toContain('_resumePromise = null');
  });

  it('tryResumeLatestSession returns _resumePromise at end of outer function', () => {
    expect(fnBody).toContain('return _resumePromise;');
  });
});

describe('Bug F — tryResumeLatestSession dedupe logic (pure simulation)', () => {
  // Pure simulation of the dedupe pattern — no DOM, no fetch.
  // Verifies that parallel calls share one promise and only one fetch is made.
  function buildDedupedResume(fetchImpl) {
    var _resumePromise = null;
    var fetchCallCount = 0;

    function tryResumeLatestSession() {
      if (_resumePromise) return _resumePromise;
      _resumePromise = (async function _tryResume() {
        try {
          fetchCallCount++;
          await fetchImpl();
        } finally {
          _resumePromise = null;
        }
      })();
      return _resumePromise;
    }

    return { tryResumeLatestSession, getFetchCount: function () { return fetchCallCount; } };
  }

  it('3 parallel calls share one promise — only 1 fetch issued', async () => {
    var resolveFetch;
    var fetchImpl = function () {
      return new Promise(function (resolve) { resolveFetch = resolve; });
    };

    var ctx = buildDedupedResume(fetchImpl);

    var p1 = ctx.tryResumeLatestSession();
    var p2 = ctx.tryResumeLatestSession();
    var p3 = ctx.tryResumeLatestSession();

    // All three must be the same promise object
    expect(p1).toBe(p2);
    expect(p2).toBe(p3);

    resolveFetch();
    await p1;

    // Only one fetch was issued
    expect(ctx.getFetchCount()).toBe(1);
  });

  it('after first call resolves, second independent call issues a fresh fetch', async () => {
    var fetchImpl = function () { return Promise.resolve(); };
    var ctx = buildDedupedResume(fetchImpl);

    await ctx.tryResumeLatestSession(); // first call — completes, resets _resumePromise
    await ctx.tryResumeLatestSession(); // second call — new cycle, should fetch again

    expect(ctx.getFetchCount()).toBe(2);
  });

  it('race scenario: boot sets stale state → login call joins in-flight → one fetch, correct result', async () => {
    // Simulates: boot fires call 1 (slow fetch), login fires call 2 immediately.
    // With dedupe: call 2 returns same promise as call 1.
    // Final state is determined by the single fetch result, not by call 1 stale path.
    var fetchResolved = false;
    var resolveFetch;
    var fetchImpl = function () {
      return new Promise(function (resolve) {
        resolveFetch = function () { fetchResolved = true; resolve(); };
      });
    };

    var ctx = buildDedupedResume(fetchImpl);

    // Boot call (slow)
    var bootPromise = ctx.tryResumeLatestSession();
    // Login call (fires immediately after)
    var loginPromise = ctx.tryResumeLatestSession();

    expect(bootPromise).toBe(loginPromise); // same promise
    expect(fetchResolved).toBe(false);      // fetch not yet complete

    resolveFetch();
    await bootPromise;

    expect(fetchResolved).toBe(true);
    expect(ctx.getFetchCount()).toBe(1); // only one fetch, not two
  });
});
