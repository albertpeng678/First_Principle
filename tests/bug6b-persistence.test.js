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
