'use strict';

// Regression test for Bug 1 — NSM offcanvas session restore missing fields:
// Clicking a Zoom session in offcanvas history previously landed on Step 4
// (AI eval result page) with wrong question shown and drafts lost, because
// loadCirclesSessionFromHistory only set nsmStep=4 and nsmEvalResult but did
// NOT restore nsmSelectedQuestion / nsmDefinition / nsmBreakdown.
//
// Fix contract (public/app.js — loadCirclesSessionFromHistory NSM branch):
//   AppState.nsmSelectedQuestion ← item.question_json || null
//   AppState.nsmDefinition       ← item.user_nsm || { nsm:'', explanation:'', businessLink:'' }
//   AppState.nsmBreakdown        ← item.user_breakdown || { reach:'', depth:'', frequency:'', impact:'' }
//   AppState.nsmEvalResult       ← item.scores_json || null
//   AppState.nsmStep             ← 1  (always Step 1, mirror Issue 2b CIRCLES fix)

// ── Pure logic extraction — mirrors the patched NSM branch ──────────────────
function applyNsmRestore(AppState, item) {
  AppState.nsmSession = item;
  AppState.nsmSelectedQuestion = item.question_json || null;
  AppState.nsmDefinition = item.user_nsm || { nsm: '', explanation: '', businessLink: '' };
  AppState.nsmBreakdown = item.user_breakdown || { reach: '', depth: '', frequency: '', impact: '' };
  AppState.nsmEvalResult = item.scores_json || null;
  AppState.nsmStep = 1;
  AppState.view = 'nsm';
}

function freshAppState() {
  return {
    nsmStep: 4,
    nsmSession: null,
    nsmSelectedQuestion: null,
    nsmEvalResult: null,
    nsmDefinition: { nsm: 'stale-def', explanation: '', businessLink: '' },
    nsmBreakdown: { reach: 'stale', depth: '', frequency: '', impact: '' },
    view: 'circles',
    offcanvasOpen: true,
  };
}

describe('Bug 1 — NSM session restore: all fields populated from history item', () => {
  it('restores nsmSelectedQuestion from item.question_json', () => {
    const AppState = freshAppState();
    const item = {
      id: 'nsm-1',
      question_json: { id: 'q-zoom', company: 'Zoom', product: 'Zoom Meetings' },
      scores_json: { totalScore: 72 },
    };
    applyNsmRestore(AppState, item);
    expect(AppState.nsmSelectedQuestion).toEqual(item.question_json);
    expect(AppState.nsmSelectedQuestion.company).toBe('Zoom');
  });

  it('restores nsmDefinition from item.user_nsm when present', () => {
    const AppState = freshAppState();
    const item = {
      id: 'nsm-2',
      question_json: { company: 'Zoom' },
      user_nsm: { nsm: 'User engagement rate', explanation: 'DAU/MAU ratio', businessLink: 'revenue' },
      scores_json: null,
    };
    applyNsmRestore(AppState, item);
    expect(AppState.nsmDefinition.nsm).toBe('User engagement rate');
    expect(AppState.nsmDefinition.explanation).toBe('DAU/MAU ratio');
  });

  it('uses empty-shell nsmDefinition when item.user_nsm is absent (list endpoint does not return it)', () => {
    const AppState = freshAppState();
    const item = {
      id: 'nsm-3',
      question_json: { company: 'Stripe' },
      // user_nsm absent — GET /api/nsm-sessions list endpoint only returns
      // id, question_id, question_json, status, scores_json, created_at
      scores_json: { totalScore: 88 },
    };
    applyNsmRestore(AppState, item);
    expect(AppState.nsmDefinition).toEqual({ nsm: '', explanation: '', businessLink: '' });
    // Must NOT carry over stale nsmDefinition from previous session
    expect(AppState.nsmDefinition.nsm).toBe('');
  });

  it('restores nsmBreakdown from item.user_breakdown when present', () => {
    const AppState = freshAppState();
    const item = {
      id: 'nsm-4',
      question_json: { company: 'Airbnb' },
      user_breakdown: { reach: '10M hosts', depth: 'weekly', frequency: 'high', impact: 'NPS+5' },
      scores_json: null,
    };
    applyNsmRestore(AppState, item);
    expect(AppState.nsmBreakdown.reach).toBe('10M hosts');
    expect(AppState.nsmBreakdown.depth).toBe('weekly');
  });

  it('uses empty-shell nsmBreakdown when item.user_breakdown is absent', () => {
    const AppState = freshAppState();
    const item = {
      id: 'nsm-5',
      question_json: { company: 'Notion' },
      scores_json: null,
    };
    applyNsmRestore(AppState, item);
    expect(AppState.nsmBreakdown).toEqual({ reach: '', depth: '', frequency: '', impact: '' });
    // Must NOT carry over stale nsmBreakdown from previous session
    expect(AppState.nsmBreakdown.reach).toBe('');
  });

  it('restores nsmEvalResult from item.scores_json', () => {
    const AppState = freshAppState();
    const item = {
      id: 'nsm-6',
      question_json: { company: 'Duolingo' },
      scores_json: { totalScore: 65, scores: { reach: 3, depth: 2, frequency: 4, impact: 3, strategic: 2 } },
    };
    applyNsmRestore(AppState, item);
    expect(AppState.nsmEvalResult).toEqual(item.scores_json);
    expect(AppState.nsmEvalResult.totalScore).toBe(65);
  });

  it('sets nsmEvalResult to null when item.scores_json is absent (active session)', () => {
    const AppState = freshAppState();
    const item = {
      id: 'nsm-7',
      question_json: { company: 'Figma' },
    };
    applyNsmRestore(AppState, item);
    expect(AppState.nsmEvalResult).toBeNull();
  });

  it('always lands on nsmStep = 1 regardless of session completeness (Option A — mirror Issue 2b)', () => {
    const cases = [
      { label: 'active session (no scores)', item: { id: 'a', question_json: { company: 'A' } } },
      { label: 'completed session with scores', item: { id: 'b', question_json: { company: 'B' }, scores_json: { totalScore: 80 } } },
      { label: 'session with user_nsm present', item: { id: 'c', question_json: { company: 'C' }, user_nsm: { nsm: 'foo' } } },
    ];
    for (const { label, item } of cases) {
      const AppState = freshAppState();
      applyNsmRestore(AppState, item);
      expect(AppState.nsmStep).toBe(1);
      // Must NOT auto-jump to Step 4 (the 卡死 regression)
      expect(AppState.nsmStep).not.toBe(4);
    }
  });

  it('sets view to nsm and clears stale AppState from previous session', () => {
    const AppState = freshAppState(); // starts with stale nsmDefinition.nsm = 'stale-def'
    const item = { id: 'nsm-8', question_json: { company: 'Zoom' } };
    applyNsmRestore(AppState, item);
    expect(AppState.view).toBe('nsm');
    expect(AppState.nsmDefinition.nsm).toBe(''); // stale cleared
    expect(AppState.nsmBreakdown.reach).toBe(''); // stale cleared
  });
});

// ── Source-level contract check — read public/app.js and verify the NSM branch ──
describe('Bug 1 — source contract: app.js NSM branch sets correct fields', () => {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  // Extract the NSM branch inside loadCirclesSessionFromHistory
  const fnStart = appSrc.indexOf('async function loadCirclesSessionFromHistory(item)');
  // The NSM branch ends at the first "return;" after the isNsm block
  const branchStart = appSrc.indexOf('if (isNsm) {', fnStart);
  const branchEnd = appSrc.indexOf('\n    }', branchStart) + 6;
  const branchBody = appSrc.slice(branchStart, branchEnd);

  it('sets AppState.nsmSelectedQuestion from item.question_json', () => {
    expect(branchBody).toContain('AppState.nsmSelectedQuestion = item.question_json');
  });

  it('sets AppState.nsmDefinition from item.user_nsm', () => {
    expect(branchBody).toContain('AppState.nsmDefinition = item.user_nsm');
  });

  it('sets AppState.nsmBreakdown from item.user_breakdown', () => {
    expect(branchBody).toContain('AppState.nsmBreakdown = item.user_breakdown');
  });

  it('sets AppState.nsmEvalResult from item.scores_json', () => {
    expect(branchBody).toContain('AppState.nsmEvalResult = item.scores_json');
  });

  it('hardcodes nsmStep = 1 (NOT 4 — the regression)', () => {
    // After fix: AppState.nsmStep = 1;
    // Regression would be: AppState.nsmStep = 4;
    expect(branchBody).toContain('AppState.nsmStep = 1;');
    expect(branchBody).not.toContain('AppState.nsmStep = 4;');
  });
});
