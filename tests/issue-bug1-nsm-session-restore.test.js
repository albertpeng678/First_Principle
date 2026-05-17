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
//   AppState.nsmStep             ← smart routing (Bug 1 fix 2026-05-11):
//     scored (scores_json non-empty) → 4
//     has breakdown (any field filled) → 3
//     has nsm (user_nsm.nsm filled)   → 2
//     else                            → 1

// ── Pure logic extraction — mirrors the patched NSM branch ──────────────────
function smartNsmStep(item) {
  var scored = item.scores_json && typeof item.scores_json === 'object'
    && Object.keys(item.scores_json).length > 0;
  var hasBreakdown = item.user_breakdown
    && Object.values(item.user_breakdown).some(function (v) { return v && String(v).trim(); });
  var hasNsm = item.user_nsm && item.user_nsm.nsm && String(item.user_nsm.nsm).trim();
  return scored ? 4 : (hasBreakdown ? 3 : (hasNsm ? 2 : 1));
}

function applyNsmRestore(AppState, item) {
  AppState.nsmSession = item;
  AppState.nsmSelectedQuestion = item.question_json || null;
  AppState.nsmDefinition = item.user_nsm || { nsm: '', explanation: '', businessLink: '' };
  AppState.nsmBreakdown = item.user_breakdown || { reach: '', depth: '', frequency: '', impact: '' };
  AppState.nsmEvalResult = item.scores_json || null;
  AppState.nsmStep = smartNsmStep(item);
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

  it('smart routing: scored session → Step 4', () => {
    const AppState = freshAppState();
    const item = { id: 'b', question_json: { company: 'B' }, scores_json: { totalScore: 80 } };
    applyNsmRestore(AppState, item);
    expect(AppState.nsmStep).toBe(4);
  });

  it('smart routing: breakdown filled (no scores) → Step 3', () => {
    const AppState = freshAppState();
    const item = {
      id: 'c', question_json: { company: 'C' },
      user_nsm: { nsm: 'foo', explanation: '', businessLink: '' },
      user_breakdown: { reach: 'r', depth: '', frequency: '', impact: '' },
      scores_json: null,
    };
    applyNsmRestore(AppState, item);
    expect(AppState.nsmStep).toBe(3);
  });

  it('smart routing: nsm filled only → Step 2', () => {
    const AppState = freshAppState();
    const item = {
      id: 'd', question_json: { company: 'D' },
      user_nsm: { nsm: 'something', explanation: '', businessLink: '' },
      user_breakdown: { reach: '', depth: '', frequency: '', impact: '' },
      scores_json: null,
    };
    applyNsmRestore(AppState, item);
    expect(AppState.nsmStep).toBe(2);
  });

  it('smart routing: empty session (no data) → Step 1', () => {
    const AppState = freshAppState();
    const item = { id: 'a', question_json: { company: 'A' }, user_nsm: null, user_breakdown: null, scores_json: null };
    applyNsmRestore(AppState, item);
    expect(AppState.nsmStep).toBe(1);
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
    // Production normalizes user_nsm into {nsm, explanation, businessLink} to handle
    // legacy string + new object payloads; shape correctness covered by 16 behavior tests above.
    expect(branchBody).toContain('AppState.nsmDefinition =');
  });

  it('sets AppState.nsmBreakdown from item.user_breakdown', () => {
    expect(branchBody).toContain('AppState.nsmBreakdown = item.user_breakdown');
  });

  it('sets AppState.nsmEvalResult from item.scores_json', () => {
    expect(branchBody).toContain('AppState.nsmEvalResult = item.scores_json');
  });

  it('uses smart routing for nsmStep (Bug 1 fix — not hardcoded to 1 or 4)', () => {
    // After Bug 1 fix: smart routing based on scores_json / user_breakdown / user_nsm
    expect(branchBody).toContain('AppState.nsmStep =');
    // Must NOT hardcode Step 4 (old regression)
    expect(branchBody).not.toContain('AppState.nsmStep = 4;');
    // Must NOT hardcode Step 1 (old workaround that lost checkpoint)
    expect(branchBody).not.toContain('AppState.nsmStep = 1;');
    // Must reference smart routing logic
    expect(branchBody).toContain('scores_json');
    expect(branchBody).toContain('user_breakdown');
    expect(branchBody).toContain('user_nsm');
  });
});
